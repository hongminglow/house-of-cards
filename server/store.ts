import { customAlphabet } from "nanoid";
import type { Card } from "../shared/types";
import type { HandRecord } from "./poker/engine";

export type StoredUser = {
  id: string;
  email: string;
  displayName: string;
  chipBalance: number;
};

export interface GameStore {
  upsertUser(email: string, displayName?: string): Promise<StoredUser>;
  adjustBalance(userId: string, delta: number): Promise<StoredUser>;
  saveHand(record: HandRecord): Promise<void>;
}

const id = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

export class MemoryStore implements GameStore {
  private users = new Map<string, StoredUser>();

  async upsertUser(email: string, displayName?: string): Promise<StoredUser> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = [...this.users.values()].find((user) => user.email === normalizedEmail);
    if (existing) return existing;

    const user: StoredUser = {
      id: id(),
      email: normalizedEmail,
      displayName: displayName?.trim() || normalizedEmail.split("@")[0] || "Player",
      chipBalance: 1_000_000
    };
    this.users.set(user.id, user);
    return user;
  }

  async adjustBalance(userId: string, delta: number): Promise<StoredUser> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found.");
    user.chipBalance += delta;
    return user;
  }

  async saveHand(_record: HandRecord): Promise<void> {
    return;
  }
}

export class PrismaGameStore implements GameStore {
  private prismaPromise: Promise<import("@prisma/client").PrismaClient>;

  constructor() {
    this.prismaPromise = import("@prisma/client").then(({ PrismaClient }) => new PrismaClient());
  }

  async upsertUser(email: string, displayName?: string): Promise<StoredUser> {
    const prisma = await this.prismaPromise;
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: { displayName: displayName?.trim() || undefined },
      create: {
        email: normalizedEmail,
        displayName: displayName?.trim() || normalizedEmail.split("@")[0] || "Player",
        chipBalance: 1_000_000
      }
    });
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      chipBalance: Number(user.chipBalance)
    };
  }

  async adjustBalance(userId: string, delta: number): Promise<StoredUser> {
    const prisma = await this.prismaPromise;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { chipBalance: { increment: delta } }
    });
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      chipBalance: Number(user.chipBalance)
    };
  }

  async saveHand(record: HandRecord): Promise<void> {
    const prisma = await this.prismaPromise;
    const room = await prisma.room.upsert({
      where: { code: record.roomCode },
      update: { status: "ACTIVE" },
      create: {
        code: record.roomCode,
        status: "ACTIVE"
      }
    });

    await prisma.hand.upsert({
      where: {
        roomId_handNumber: {
          roomId: room.id,
          handNumber: record.handNumber
        }
      },
      update: {
        communityCards: cardsToJson(record.communityCards),
        snapshot: record.snapshot,
        completedAt: new Date()
      },
      create: {
        roomId: room.id,
        handNumber: record.handNumber,
        deckSeed: `${record.roomCode}-${record.handNumber}`,
        communityCards: cardsToJson(record.communityCards),
        snapshot: record.snapshot,
        completedAt: new Date(),
        settlements: {
          create: record.settlements.map((settlement) => ({
            userId: settlement.userId,
            amount: settlement.delta,
            resultingStack: settlement.resultingStack
          }))
        }
      }
    });
  }
}

export function createStore(): GameStore {
  if (process.env.DATABASE_URL) {
    return new PrismaGameStore();
  }
  return new MemoryStore();
}

function cardsToJson(cards: Card[]): Array<{ rank: string; suit: string }> {
  return cards.map((card) => ({ rank: card.rank, suit: card.suit }));
}
