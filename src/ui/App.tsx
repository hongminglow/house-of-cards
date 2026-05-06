import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
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

type RoomListItem = {
  code: string;
  seats: number;
  street: string;
};

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
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const audio = useRef<AudioContext | null>(null);

  const room = snapshot?.room ?? null;
  const player = snapshot?.player ?? null;

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

  useEffect(() => {
    if (!player || room) return;
    let active = true;

    async function loadRooms() {
      try {
        const response = await fetch("/api/rooms");
        if (!response.ok) return;
        const data = (await response.json()) as RoomListItem[];
        if (active) setRooms(data);
      } catch {
        if (active) setRooms([]);
      }
    }

    loadRooms();
    const interval = window.setInterval(loadRooms, 3500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [player, room]);

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

  const audioPanel = (
    <AudioPanel
      soundEnabled={soundEnabled}
      setSoundEnabled={setSoundEnabled}
      volume={volume}
      setVolume={setVolume}
    />
  );

  if (!player) {
    return (
      <main className="app-shell login-shell">
        <section className="table-stage hero-mode" aria-label="House of Cards login">
          <PokerTableScene room={null} playerSeat={null} />
          <HeroArt />
          <BrandTopbar title="Online Poker" status="LOBBY" right="No account" />
        </section>
        <aside className="control-dock login-dock" aria-label="Login controls">
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
          {audioPanel}
          {notice ? <div className="notice">{notice}</div> : null}
        </aside>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="home-shell">
        <header className="home-header">
          <BrandLockup title="Lobby" />
          <div className="home-header-actions">
            <BalanceAmount amount={player.accountBalance} />
            <IconSoundButton soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} />
          </div>
        </header>

        <section className="home-grid" aria-label="Poker lobby">
          <div className="lobby-column">
            <div className="section-heading">
              <p className="micro-label">Rooms</p>
              <h1>Choose a table</h1>
            </div>

            <div className="lobby-command-row">
              <button className="primary-button" onClick={createRoom}>
                Create room
              </button>
              <button className="ghost-button compact" onClick={() => joinRoom()}>
                Quick join
              </button>
            </div>

            <div className="join-row room-code-row">
              <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="Room no" />
              <button onClick={() => joinRoom(roomCode)}>Join</button>
            </div>

            <div className="room-list" aria-label="Available rooms">
              {rooms.length ? (
                rooms.map((listedRoom) => (
                  <button className="room-row" key={listedRoom.code} onClick={() => joinRoom(listedRoom.code)}>
                    <span>
                      <strong>Room {listedRoom.code}</strong>
                      <small>{listedRoom.street.toUpperCase()}</small>
                    </span>
                    <span className="room-capacity">{listedRoom.seats}/6</span>
                  </button>
                ))
              ) : (
                <div className="empty-rooms">
                  <strong>No open rooms yet</strong>
                  <span>Create a room and the lobby list will update here.</span>
                </div>
              )}
            </div>
          </div>

          <aside className="player-column" aria-label="Player summary">
            <div className="panel player-card">
              <p className="micro-label">Player</p>
              <h2>{player.displayName}</h2>
              <div className="summary-stat main">
                <span>Bankroll</span>
                <strong>
                  <BalanceAmount amount={player.accountBalance} />
                </strong>
              </div>
              <div className="summary-grid">
                <div className="summary-stat">
                  <span>Net result</span>
                  <strong>{formatSignedCurrency(player.accountBalance - 1_000_000)}</strong>
                </div>
                <div className="summary-stat">
                  <span>Buy-ins ready</span>
                  <strong>{Math.floor(player.accountBalance / 100_000)}</strong>
                </div>
                <div className="summary-stat">
                  <span>Open tables</span>
                  <strong>{rooms.length}</strong>
                </div>
                <div className="summary-stat">
                  <span>Last result</span>
                  <strong>Pending</strong>
                </div>
              </div>
            </div>

            <div className="panel tips-card">
              <p className="micro-label">Table flow</p>
              <div className="flow-list">
                <span>Join or create a room</span>
                <span>Ready up with 2+ players</span>
                <span>Play preflop, flop, turn, river</span>
                <span>Server settles chips</span>
              </div>
            </div>

            {audioPanel}
            {notice ? <div className="notice">{notice}</div> : null}
          </aside>
        </section>
      </main>
    );
  }

  return (
    <main className="game-shell">
      <section className="game-stage" aria-label="Poker game room">
        <PokerTableScene room={room} playerSeat={player.seatIndex ?? null} />
        <SeatRing room={room} localUserId={player.userId} />

        <div className="game-topbar">
          <BrandLockup title={`Room ${room.roomCode}`} compact />
          <div className="game-status-strip">
            <span>{room.street.toUpperCase()}</span>
            <BalanceAmount amount={player.accountBalance} />
            <IconSoundButton soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} />
          </div>
        </div>

        <div className="pot-display game-pot">
          <span>Pot</span>
          <strong>${room.pot.toLocaleString()}</strong>
          <small>{room.lastAction}</small>
        </div>

        <div className="game-hand-panel edge-panel">
          <span>Your cards</span>
          <div className="card-pair">
            {player.holeCards.length ? player.holeCards.map((card) => <CardView card={card} key={`${card.rank}-${card.suit}`} />) : <em>No active hand</em>}
          </div>
        </div>

        <div className="game-action-panel edge-panel">
          <ActionBar legalActions={player.legalActions} onAction={act} />
          <div className="game-button-row">
            <button className="ghost-button compact" onClick={() => socket.emit("ready")}>
              Ready
            </button>
            <button className="danger-button compact" onClick={() => socket.emit("leaveRoom")}>
              Leave
            </button>
          </div>
        </div>

        <div className="game-room-panel edge-panel">
          <span>Table</span>
          <strong>{room.seats.length}/6 seated</strong>
          <small>Blinds ${room.smallBlind.toLocaleString()} / ${room.bigBlind.toLocaleString()}</small>
        </div>

        {notice ? <div className="notice game-notice">{notice}</div> : null}
      </section>
    </main>
  );
}

function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <img src="/assets/house-of-cards-croupier.png" alt="" />
    </div>
  );
}

function BrandTopbar({ title, status, right }: { title: string; status: string; right: ReactNode }) {
  return (
    <div className="table-topbar">
      <BrandLockup title={title} />
      <div className="status-cluster">
        <span>{status}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

function BrandLockup({ title, compact = false }: { title: string; compact?: boolean }) {
  return (
    <div className={compact ? "brand-lockup compact-brand" : "brand-lockup"}>
      <img className="brand-mark" src="/assets/house-of-cards-croupier.png" alt="" />
      <p className="micro-label">House of Cards</p>
      <h1>{title}</h1>
    </div>
  );
}

function AudioPanel({
  soundEnabled,
  setSoundEnabled,
  volume,
  setVolume
}: {
  soundEnabled: boolean;
  setSoundEnabled: Dispatch<SetStateAction<boolean>>;
  volume: number;
  setVolume: Dispatch<SetStateAction<number>>;
}) {
  return (
    <div className="panel audio-panel">
      <div className="switch-line">
        <span>SFX</span>
        <IconSoundButton soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} />
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
  );
}

function IconSoundButton({
  soundEnabled,
  setSoundEnabled
}: {
  soundEnabled: boolean;
  setSoundEnabled: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <button
      className={soundEnabled ? "icon-toggle active" : "icon-toggle"}
      onClick={() => setSoundEnabled((value) => !value)}
      aria-label={soundEnabled ? "Mute SFX" : "Unmute SFX"}
      title={soundEnabled ? "Mute SFX" : "Unmute SFX"}
    >
      <SpeakerIcon muted={!soundEnabled} />
    </button>
  );
}

function BalanceAmount({ amount }: { amount: number }) {
  return (
    <span className="balance-amount">
      ${amount.toLocaleString()}
      <ChipIcon />
    </span>
  );
}

function ChipIcon() {
  return (
    <svg className="chip-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.1" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg className="speaker-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.5v5h4l5 4.2V5.3l-5 4.2H4Z" />
      {muted ? (
        <>
          <path d="M17 9l4 6M21 9l-4 6" />
        </>
      ) : (
        <>
          <path d="M16.5 9a4.2 4.2 0 0 1 0 6" />
          <path d="M18.8 6.8a7.4 7.4 0 0 1 0 10.4" />
        </>
      )}
    </svg>
  );
}

function formatSignedCurrency(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString()}`;
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
