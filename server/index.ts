import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { z } from "zod";
import type {
  AuthPayload,
  ClientToServerEvents,
  GameSnapshot,
  JoinRoomPayload,
  PokerActionPayload,
  ServerToClientEvents
} from "../shared/types";
import { DEFAULT_BUY_IN, PokerRoom, type EngineUser, type RoomEvent } from "./poker/engine";
import { createPresenceStore } from "./presence";
import { createStore, type StoredUser } from "./store";

type SocketData = {
  user?: StoredUser;
  roomCode?: string;
};

const authSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(24).optional()
});

const joinSchema = z.object({
  roomCode: z.string().min(3).max(8).optional()
});

const actionSchema = z.object({
  type: z.enum(["fold", "check", "call", "bet", "raise", "all-in"]),
  amount: z.number().int().nonnegative().optional()
});

const store = createStore();
const presence = createPresenceStore();
const rooms = new Map<string, PokerRoom>();

const app = express();
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    persistence: process.env.DATABASE_URL ? "postgres" : "memory",
    presence: process.env.REDIS_URL ? "redis" : "memory"
  });
});

app.get("/api/rooms", (_request, response) => {
  response.json(
    [...rooms.values()].map((room) => ({
      code: room.code,
      seats: room.publicState().seats.length,
      street: room.publicState().street
    }))
  );
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
  cors: {
    origin: ["http://127.0.0.1:5173", "http://localhost:5173"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  socket.on("auth", async (payload: AuthPayload, ack) => {
    try {
      const input = authSchema.parse(payload);
      const user = await store.upsertUser(input.email, input.displayName);
      socket.data.user = user;
      ack(emptySnapshot(user));
    } catch (error) {
      socket.emit("notice", getErrorMessage(error));
    }
  });

  socket.on("createRoom", async (ack) => {
    try {
      const user = requireUser(socket);
      const room = createRoom();
      await sit(socket, room, user);
      ack(room.snapshotFor(user.id));
      emitRoom(room);
      io.to(room.code).emit("sfx", "join");
    } catch (error) {
      socket.emit("notice", getErrorMessage(error));
    }
  });

  socket.on("joinRoom", async (payload: JoinRoomPayload, ack) => {
    try {
      const user = requireUser(socket);
      const input = joinSchema.parse(payload);
      const room = input.roomCode ? rooms.get(input.roomCode.toUpperCase()) : [...rooms.values()].find((candidate) => candidate.publicState().seats.length < candidate.maxPlayers);
      if (!room) throw new Error("Room not found.");
      await sit(socket, room, user);
      ack(room.snapshotFor(user.id));
      emitRoom(room);
      io.to(room.code).emit("sfx", "join");
    } catch (error) {
      socket.emit("notice", getErrorMessage(error));
    }
  });

  socket.on("ready", async () => {
    try {
      const { room, user } = requireRoom(socket);
      const event = room.ready(user.id);
      await handleEvent(room, event);
      emitRoom(room);
    } catch (error) {
      socket.emit("notice", getErrorMessage(error));
    }
  });

  socket.on("action", async (payload: PokerActionPayload) => {
    try {
      const { room, user } = requireRoom(socket);
      const input = actionSchema.parse(payload);
      const event = room.act(user.id, input);
      await handleEvent(room, event);
      emitRoom(room);
    } catch (error) {
      socket.emit("notice", getErrorMessage(error));
    }
  });

  socket.on("leaveRoom", async () => {
    await leave(socket);
  });

  socket.on("disconnect", async () => {
    const user = socket.data.user;
    const room = socket.data.roomCode ? rooms.get(socket.data.roomCode) : undefined;
    if (user && room) {
      room.disconnect(user.id);
      await presence.removeRoomUser(room.code, user.id).catch(() => undefined);
      emitRoom(room);
    }
  });
});

setInterval(async () => {
  for (const room of rooms.values()) {
    const state = room.publicState();
    if (state.actionDeadlineAt && state.actionDeadlineAt < Date.now()) {
      const event = room.timeoutCurrentTurn();
      await handleEvent(room, event);
      emitRoom(room);
    }
  }
}, 1_000);

const port = Number(process.env.SERVER_PORT ?? 8787);
httpServer.listen(port, "127.0.0.1", () => {
  console.log(`House of Cards server listening on http://127.0.0.1:${port}`);
});

function createRoom(): PokerRoom {
  let code = "";
  do {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(code));
  const room = new PokerRoom(code);
  rooms.set(code, room);
  return room;
}

async function sit(socket: Parameters<typeof io.on>[1] extends (socket: infer T) => void ? T : never, room: PokerRoom, user: StoredUser): Promise<void> {
  const reconnecting = room.hasUser(user.id);
  if (!reconnecting && user.chipBalance < DEFAULT_BUY_IN) {
    throw new Error("Your persistent balance is below the 100,000 buy-in.");
  }

  const seatedUser: EngineUser = reconnecting ? user : await store.adjustBalance(user.id, -DEFAULT_BUY_IN);
  socket.data.user = seatedUser;
  socket.data.roomCode = room.code;
  room.join(seatedUser);
  await socket.join(room.code);
  await presence.setRoomUser(room.code, user.id).catch(() => undefined);
}

async function leave(socket: Parameters<typeof io.on>[1] extends (socket: infer T) => void ? T : never): Promise<void> {
  const user = socket.data.user;
  const roomCode = socket.data.roomCode;
  if (!user || !roomCode) return;

  const room = rooms.get(roomCode);
  if (!room) return;

  const result = room.leave(user.id);
  if (result.returned) {
    socket.data.user = await store.adjustBalance(user.id, result.returned.delta);
  }
  await handleEvent(room, result.event);
  await socket.leave(roomCode);
  await presence.removeRoomUser(room.code, user.id).catch(() => undefined);
  socket.data.roomCode = undefined;
  socket.emit("snapshot", emptySnapshot(socket.data.user ?? user));
  emitRoom(room);
  io.to(room.code).emit("sfx", "leave");

  if (room.isEmpty()) {
    rooms.delete(room.code);
  }
}

async function handleEvent(room: PokerRoom, event: RoomEvent): Promise<void> {
  if (event.type === "sfx") {
    io.to(room.code).emit("sfx", event.name);
  }
  if (event.type === "settled") {
    await store.saveHand(event.record).catch((error) => {
      console.error("Failed to save hand", error);
    });
    io.to(room.code).emit("sfx", "winner");
    setTimeout(() => {
      emitRoom(room);
    }, 250);
    setTimeout(() => {
      void continueRoomFlow(room);
    }, 2_400);
  }
}

async function continueRoomFlow(room: PokerRoom): Promise<void> {
  if (rooms.get(room.code) !== room) return;

  await releaseTimedOutSeats(room);
  if (room.isEmpty()) {
    rooms.delete(room.code);
    return;
  }

  const event = room.continueIfReady();
  await handleEvent(room, event);
  emitRoom(room);
}

async function releaseTimedOutSeats(room: PokerRoom): Promise<void> {
  const returnedStacks = room.releaseTimedOutSeats();
  if (returnedStacks.length === 0) return;

  for (const returned of returnedStacks) {
    const updatedUser = await store.adjustBalance(returned.userId, returned.delta);
    await presence.removeRoomUser(room.code, returned.userId).catch(() => undefined);

    io.sockets.sockets.forEach((socket) => {
      if (socket.data.user?.id !== returned.userId) return;
      socket.data.user = updatedUser;
      if (socket.data.roomCode === room.code) {
        socket.data.roomCode = undefined;
        socket.leave(room.code);
        socket.emit("snapshot", emptySnapshot(updatedUser));
      } else if (!socket.data.roomCode) {
        socket.emit("snapshot", emptySnapshot(updatedUser));
      }
    });
  }

  io.to(room.code).emit("sfx", "leave");
}

function emitRoom(room: PokerRoom): void {
  const sockets = io.sockets.adapter.rooms.get(room.code);
  if (!sockets) return;

  sockets.forEach((socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    const user = socket?.data.user;
    if (!socket || !user) return;
    socket.emit("snapshot", room.snapshotFor(user.id));
  });
}

function requireUser(socket: Parameters<typeof io.on>[1] extends (socket: infer T) => void ? T : never): StoredUser {
  if (!socket.data.user) throw new Error("Sign in with email first.");
  return socket.data.user;
}

function requireRoom(socket: Parameters<typeof io.on>[1] extends (socket: infer T) => void ? T : never): { user: StoredUser; room: PokerRoom } {
  const user = requireUser(socket);
  const roomCode = socket.data.roomCode;
  if (!roomCode) throw new Error("Join a room first.");
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Room not found.");
  return { user, room };
}

function emptySnapshot(user: StoredUser): GameSnapshot {
  return {
    room: null,
    player: {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      accountBalance: user.chipBalance,
      holeCards: [],
      legalActions: []
    }
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
