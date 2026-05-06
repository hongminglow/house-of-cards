import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  AuthPayload,
  ClientToServerEvents,
  GameSnapshot,
  PokerActionPayload,
  ServerToClientEvents,
  SfxName
} from "../../shared/types";
import { PokerTableScene } from "./PokerTableScene";
import { ActionBar } from "./components/ActionBar";
import { CardView } from "./components/CardView";
import { SeatRing } from "./components/SeatRing";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const serverUrl =
  import.meta.env.VITE_SERVER_URL || (window.location.port === "5173" ? "http://127.0.0.1:8787" : window.location.origin);

export function App() {
  const socket = useMemo<GameSocket>(() => io(serverUrl, { autoConnect: true }), []);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("player@example.com");
  const [displayName, setDisplayName] = useState("Ace");
  const [roomCode, setRoomCode] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(0.35);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }
    socket.on("snapshot", setSnapshot);
    socket.on("notice", setNotice);
    socket.on("sfx", (name) => {
      if (soundEnabled) playSfx(name, volume, audio);
    });

    return () => {
      socket.off("snapshot", setSnapshot);
      socket.off("notice", setNotice);
      socket.off("sfx");
      socket.disconnect();
    };
  }, [socket, soundEnabled, volume]);

  const room = snapshot?.room ?? null;
  const player = snapshot?.player ?? null;

  function auth(payload: AuthPayload) {
    socket.emit("auth", payload, setSnapshot);
  }

  function createRoom() {
    socket.emit("createRoom", setSnapshot);
  }

  function joinRoom(code?: string) {
    socket.emit("joinRoom", { roomCode: code?.trim().toUpperCase() || undefined }, setSnapshot);
  }

  function act(payload: PokerActionPayload) {
    socket.emit("action", payload);
  }

  return (
    <main className="app-shell">
      <section className="table-stage" aria-label="Poker table">
        <PokerTableScene room={room} playerSeat={player?.seatIndex ?? null} />
        {room ? <SeatRing room={room} localUserId={player?.userId ?? ""} /> : null}
        <div className="table-topbar">
          <div>
            <p className="micro-label">House of Cards</p>
            <h1>{room ? `Room ${room.roomCode}` : "Online Poker"}</h1>
          </div>
          <div className="status-cluster">
            <span>{room ? room.street.toUpperCase() : "LOBBY"}</span>
            <span>{player ? `${player.accountBalance.toLocaleString()} chips` : "No account"}</span>
          </div>
        </div>
        {room ? (
          <div className="pot-display">
            <span>Pot</span>
            <strong>{room.pot.toLocaleString()}</strong>
            <small>{room.lastAction}</small>
          </div>
        ) : null}
      </section>

      <aside className="control-dock" aria-label="Game controls">
        {!player ? (
          <form
            className="panel"
            onSubmit={(event) => {
              event.preventDefault();
              auth({ email, displayName });
            }}
          >
            <h2>Sign in</h2>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </label>
            <label>
              Table name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={24} required />
            </label>
            <button className="primary-button" type="submit">
              Enter lobby
            </button>
          </form>
        ) : !room ? (
          <div className="panel">
            <h2>Lobby</h2>
            <p className="balance-line">{player.accountBalance.toLocaleString()} persistent chips</p>
            <button className="primary-button" onClick={createRoom}>
              Create room
            </button>
            <div className="join-row">
              <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="Room no" />
              <button onClick={() => joinRoom(roomCode)}>Join</button>
            </div>
            <button className="ghost-button" onClick={() => joinRoom()}>
              Quick join
            </button>
          </div>
        ) : (
          <div className="panel table-panel">
            <div className="private-hand">
              <span>Your cards</span>
              <div className="card-pair">
                {player.holeCards.length ? player.holeCards.map((card) => <CardView card={card} key={`${card.rank}-${card.suit}`} />) : <em>No active hand</em>}
              </div>
            </div>
            <ActionBar legalActions={player.legalActions} onAction={act} />
            <button className="ghost-button" onClick={() => socket.emit("ready")}>
              Ready next hand
            </button>
            <button className="danger-button" onClick={() => socket.emit("leaveRoom")}>
              Leave room
            </button>
          </div>
        )}

        <div className="panel audio-panel">
          <div className="switch-line">
            <span>SFX</span>
            <button className={soundEnabled ? "toggle active" : "toggle"} onClick={() => setSoundEnabled((value) => !value)}>
              {soundEnabled ? "On" : "Off"}
            </button>
          </div>
          <input
            aria-label="SFX volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </div>
        {notice ? <div className="notice">{notice}</div> : null}
      </aside>
    </main>
  );
}

function playSfx(name: SfxName, volume: number, ref: React.MutableRefObject<AudioContext | null>) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  ref.current ??= new AudioContextClass();
  const ctx = ref.current;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const map: Record<SfxName, [number, number]> = {
    deal: [520, 0.08],
    chip: [280, 0.1],
    check: [360, 0.07],
    fold: [160, 0.12],
    "all-in": [740, 0.2],
    winner: [660, 0.35],
    join: [440, 0.1],
    leave: [180, 0.1],
    warning: [880, 0.06]
  };
  const [frequency, duration] = map[name];
  osc.frequency.value = frequency;
  osc.type = name === "winner" ? "triangle" : "sine";
  gain.gain.value = volume * 0.18;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.stop(ctx.currentTime + duration);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
