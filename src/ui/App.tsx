import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
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
  const [rulesOpen, setRulesOpen] = useState(false);
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

  if (!player) {
    return (
      <main className="login-full-shell" aria-label="House of Cards login">
        <HeroArt />
        <div className="login-brand">
          <BrandLockup title="Online Poker" compact />
        </div>
        <section className="login-center">
          <form
            className="panel login-panel"
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
          {notice ? <div className="notice">{notice}</div> : null}
        </section>
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
            <button className="icon-toggle rules-button" onClick={() => setRulesOpen(true)} aria-label="Open poker rules" title="Poker rules">
              <RulesIcon />
            </button>
            <IconSoundButton soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} />
          </div>
        </header>

        <section className="home-grid" aria-label="Poker lobby">
          <div className="lobby-column">
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

            <div className="room-list-header">
              <span>Open rooms</span>
              <small>{rooms.length} available</small>
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

            <div className="panel promo-card">
              <p className="micro-label">Featured table</p>
              <h2>Midnight felt</h2>
              <div className="promo-row">
                <span>Buy-in</span>
                <strong>$100,000</strong>
              </div>
              <div className="promo-row">
                <span>Blinds</span>
                <strong>$500 / $1,000</strong>
              </div>
              <button className="ghost-button compact" onClick={createRoom}>
                Start a private table
              </button>
            </div>

            <div className="panel progress-card">
              <p className="micro-label">Career pulse</p>
              <div className="pulse-meter">
                <span style={{ width: `${Math.min(100, Math.max(8, (player.accountBalance / 1_000_000) * 100))}%` }} />
              </div>
              <div className="progress-list">
                <div>
                  <span>Bankroll health</span>
                  <strong>{player.accountBalance >= 1_000_000 ? "Ahead" : player.accountBalance >= 500_000 ? "Stable" : "Rebuild"}</strong>
                </div>
                <div>
                  <span>Preferred seat</span>
                  <strong>Button</strong>
                </div>
                <div>
                  <span>Next milestone</span>
                  <strong>$1,250,000</strong>
                </div>
              </div>
            </div>

            {notice ? <div className="notice">{notice}</div> : null}
          </aside>
        </section>
        {rulesOpen ? <RulesModal onClose={() => setRulesOpen(false)} /> : null}
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

function BrandLockup({ title, compact = false }: { title: string; compact?: boolean }) {
  return (
    <div className={compact ? "brand-lockup compact-brand" : "brand-lockup"}>
      <img className="brand-mark" src="/assets/house-of-cards-croupier.png" alt="" />
      <p className="micro-label">House of Cards</p>
      <h1>{title}</h1>
    </div>
  );
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <div className="rules-modal">
        <div className="modal-heading">
          <div>
            <p className="micro-label">Texas Hold'em</p>
            <h2 id="rules-title">Poker rules</h2>
          </div>
          <button className="icon-toggle" onClick={onClose} aria-label="Close rules" title="Close rules">
            <CloseIcon />
          </button>
        </div>
        <div className="rules-grid">
          <div>
            <strong>1. Hole cards</strong>
            <span>Each player gets two private cards. Only you can see yours.</span>
          </div>
          <div>
            <strong>2. Community board</strong>
            <span>The table reveals flop, turn, and river for everyone to use.</span>
          </div>
          <div>
            <strong>3. Betting</strong>
            <span>Fold, check, call, bet, raise, or go all-in when it is your turn.</span>
          </div>
          <div>
            <strong>4. Showdown</strong>
            <span>The best five-card hand wins. Split pots are handled by the server.</span>
          </div>
        </div>
      </div>
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

function RulesIcon() {
  return (
    <svg className="rules-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6.3" y="3.4" width="11.4" height="17.2" rx="2.2" />
      <path className="rules-suit" d="M12 8.2c-1.35-1.82-4.1.2-2.17 2.24L12 12.8l2.17-2.36C16.1 8.4 13.35 6.38 12 8.2Z" />
      <path d="M10.1 15.9h3.8" />
      <path d="M12 12.8v3.1" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="speaker-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
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
