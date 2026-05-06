import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  AuthPayload,
  ClientToServerEvents,
  GameSnapshot,
  PokerActionPayload,
  ServerToClientEvents,
  SfxName,
  Card,
  HandHistoryEntry
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

const gameSocket: GameSocket = io(serverUrl, { autoConnect: false, transports: ["websocket"] });

export function App() {
  const socket = gameSocket;
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("player@example.com");
  const [displayName, setDisplayName] = useState("Ace");
  const [roomCode, setRoomCode] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(0.35);
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [gameSceneReady, setGameSceneReady] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const soundSettings = useRef({ enabled: soundEnabled, volume });
  const previousBoardReveal = useRef<{ roomCode?: string; count: number }>({ count: 0 });

  const room = snapshot?.room ?? null;
  const player = snapshot?.player ?? null;

  useEffect(() => {
    soundSettings.current = { enabled: soundEnabled, volume };
  }, [soundEnabled, volume]);

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    function handleSfx(name: SfxName) {
      const settings = soundSettings.current;
      if (settings.enabled) playSfx(name, settings.volume, audio);
    }

    socket.on("snapshot", setSnapshot);
    socket.on("notice", setNotice);
    socket.on("sfx", handleSfx);

    return () => {
      socket.off("snapshot", setSnapshot);
      socket.off("notice", setNotice);
      socket.off("sfx", handleSfx);
    };
  }, [socket]);

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

  useEffect(() => {
    setGameSceneReady(false);
  }, [room?.roomCode]);

  useEffect(() => {
    const roomCode = room?.roomCode;
    const boardCount = room?.communityCards.length ?? 0;
    const previous = previousBoardReveal.current;

    if (previous.roomCode !== roomCode) {
      previousBoardReveal.current = { roomCode, count: boardCount };
      return;
    }

    if (boardCount > previous.count) {
      const revealCount = boardCount - previous.count;
      const settings = soundSettings.current;
      if (settings.enabled) {
        for (let index = 0; index < revealCount; index += 1) {
          window.setTimeout(() => playSfx("card", settings.volume, audio), index * 90);
        }
      }
    }

    previousBoardReveal.current = { roomCode, count: boardCount };
  }, [room?.roomCode, room?.communityCards.length]);

  const handleCroupierReady = useCallback(() => {
    setGameSceneReady(true);
  }, []);

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

  const currentTurnSeat = room?.seats.find((seat) => seat.seatIndex === room.currentTurnSeat);

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
            <HistoryControl
              emptyDescription="Join a room to see completed hands, revealed cards, and your table result."
              entries={[]}
              open={historyOpen}
              playerUserId={player.userId}
              setOpen={setHistoryOpen}
            />
            <IconSoundButton setSoundEnabled={setSoundEnabled} setVolume={setVolume} soundEnabled={soundEnabled} volume={volume} />
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
                <span>Opening bets</span>
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
        <PokerTableScene room={room} playerSeat={player.seatIndex ?? null} onCroupierReady={handleCroupierReady} />
        <SeatRing room={room} localUserId={player.userId} />

        <div className="game-topbar">
          <BrandLockup title={`Room ${room.roomCode}`} compact />
          <div className="game-status-strip">
            <span>{room.street.toUpperCase()}</span>
            <BalanceAmount amount={player.accountBalance} />
            <button className="icon-toggle rules-button" onClick={() => setRulesOpen(true)} aria-label="Open poker rules" title="Poker rules">
              <RulesIcon />
            </button>
            <HistoryControl
              entries={room.history}
              open={historyOpen}
              playerUserId={player.userId}
              setOpen={setHistoryOpen}
            />
            <IconSoundButton setSoundEnabled={setSoundEnabled} setVolume={setVolume} soundEnabled={soundEnabled} volume={volume} />
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
          <ActionBar
            actionDeadlineAt={room.actionDeadlineAt}
            currentTurnName={currentTurnSeat?.displayName}
            isLocalTurn={room.currentTurnSeat === player.seatIndex}
            legalActions={player.legalActions}
            onAction={act}
          />
          <div className="game-button-row">
            <button className="ghost-button compact" onClick={() => socket.emit("ready")} disabled={player.isReady}>
              {player.isReady ? "In game" : "Ready"}
            </button>
            <button className="danger-button compact" onClick={() => socket.emit("leaveRoom")}>
              Leave
            </button>
          </div>
        </div>

        <div className="game-room-panel edge-panel">
          <span>Table</span>
          <strong>{room.seats.length}/6 seated</strong>
          <small>Opening bets ${room.smallBlind.toLocaleString()} / ${room.bigBlind.toLocaleString()}</small>
        </div>

        {notice ? <div className="notice game-notice">{notice}</div> : null}
        {!gameSceneReady ? <GameLoadingOverlay /> : null}
        {rulesOpen ? <RulesModal onClose={() => setRulesOpen(false)} /> : null}
      </section>
    </main>
  );
}

function GameLoadingOverlay() {
  return (
    <div className="game-loading-overlay" role="status" aria-live="polite">
      <div className="loading-card">
        <div className="loading-chip" />
        <strong>Preparing table</strong>
        <span>Loading croupier model, card deck, and table lighting.</span>
      </div>
    </div>
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

const handRankings: Array<{ name: string; description: string; cards: Card[] }> = [
  {
    name: "Royal flush",
    description: "A, K, Q, J, T in the same suit. The strongest possible hand.",
    cards: [
      { rank: "A", suit: "spades" },
      { rank: "K", suit: "spades" },
      { rank: "Q", suit: "spades" },
      { rank: "J", suit: "spades" },
      { rank: "T", suit: "spades" }
    ]
  },
  {
    name: "Straight flush",
    description: "Five connected cards in the same suit.",
    cards: [
      { rank: "9", suit: "hearts" },
      { rank: "8", suit: "hearts" },
      { rank: "7", suit: "hearts" },
      { rank: "6", suit: "hearts" },
      { rank: "5", suit: "hearts" }
    ]
  },
  {
    name: "Four of a kind",
    description: "Four cards with the same rank, plus one kicker.",
    cards: [
      { rank: "A", suit: "spades" },
      { rank: "A", suit: "hearts" },
      { rank: "A", suit: "diamonds" },
      { rank: "A", suit: "clubs" },
      { rank: "9", suit: "spades" }
    ]
  },
  {
    name: "Full house",
    description: "Three of one rank and two of another rank.",
    cards: [
      { rank: "K", suit: "spades" },
      { rank: "K", suit: "hearts" },
      { rank: "K", suit: "clubs" },
      { rank: "8", suit: "diamonds" },
      { rank: "8", suit: "clubs" }
    ]
  },
  {
    name: "Flush",
    description: "Five cards in the same suit, not connected in order.",
    cards: [
      { rank: "A", suit: "diamonds" },
      { rank: "J", suit: "diamonds" },
      { rank: "8", suit: "diamonds" },
      { rank: "4", suit: "diamonds" },
      { rank: "2", suit: "diamonds" }
    ]
  },
  {
    name: "Straight",
    description: "Five connected cards, mixed suits allowed.",
    cards: [
      { rank: "9", suit: "clubs" },
      { rank: "8", suit: "diamonds" },
      { rank: "7", suit: "spades" },
      { rank: "6", suit: "hearts" },
      { rank: "5", suit: "clubs" }
    ]
  },
  {
    name: "Three of a kind",
    description: "Three cards with the same rank, plus two kickers.",
    cards: [
      { rank: "Q", suit: "spades" },
      { rank: "Q", suit: "hearts" },
      { rank: "Q", suit: "clubs" },
      { rank: "7", suit: "diamonds" },
      { rank: "2", suit: "clubs" }
    ]
  },
  {
    name: "Two pair",
    description: "Two cards of one rank, two cards of another rank, plus one kicker.",
    cards: [
      { rank: "J", suit: "spades" },
      { rank: "J", suit: "diamonds" },
      { rank: "4", suit: "hearts" },
      { rank: "4", suit: "clubs" },
      { rank: "A", suit: "clubs" }
    ]
  },
  {
    name: "One pair",
    description: "Two cards with the same rank, plus three kickers.",
    cards: [
      { rank: "T", suit: "spades" },
      { rank: "T", suit: "hearts" },
      { rank: "9", suit: "clubs" },
      { rank: "5", suit: "diamonds" },
      { rank: "2", suit: "spades" }
    ]
  },
  {
    name: "High card",
    description: "No made combination. The highest card decides, then kickers.",
    cards: [
      { rank: "A", suit: "hearts" },
      { rank: "Q", suit: "clubs" },
      { rank: "9", suit: "diamonds" },
      { rank: "6", suit: "spades" },
      { rank: "3", suit: "clubs" }
    ]
  }
];

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
        <div className="rules-content">
          <div className="rules-grid">
            <div>
              <strong>Hole cards</strong>
              <span>Each player gets two private cards. Only you can see yours.</span>
            </div>
            <div>
              <strong>Community board</strong>
              <span>The table reveals flop, turn, and river for everyone to use.</span>
            </div>
            <div>
              <strong>Betting rounds</strong>
              <span>Pre-flop, flop, turn, river, then showdown if more than one player remains.</span>
            </div>
            <div>
              <strong>Best five cards</strong>
              <span>Use any five from your two cards and the five community cards.</span>
            </div>
          </div>

          <div className="hand-rankings" aria-label="Poker hand rankings from strongest to weakest">
            {handRankings.map((hand, index) => (
              <article className="hand-rank-row" key={hand.name}>
                <div className="hand-rank-copy">
                  <strong>
                    <span>{index + 1}</span>
                    {hand.name}
                  </strong>
                  <small>{hand.description}</small>
                </div>
                <div className="rule-card-samples" aria-label={`${hand.name} sample cards`}>
                  {hand.cards.map((card, cardIndex) => (
                    <CardView card={card} key={`${hand.name}-${card.rank}-${card.suit}-${cardIndex}`} />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryControl({
  emptyDescription = "Finished rounds will appear here with winners, revealed cards, and your result.",
  entries,
  open,
  playerUserId,
  setOpen
}: {
  emptyDescription?: string;
  entries: HandHistoryEntry[];
  open: boolean;
  playerUserId: string;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <div className="history-control">
      <button
        className={open ? "icon-toggle history-button active" : "icon-toggle history-button"}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Open game history"
        title="Game history"
      >
        <HistoryIcon />
      </button>
      {open ? (
        <div className="history-popover" role="dialog" aria-label="Game history">
          <div className="history-popover-heading">
            <div>
              <p className="micro-label">Table log</p>
              <h2>Game history</h2>
            </div>
            <button className="icon-toggle" onClick={() => setOpen(false)} aria-label="Close history" title="Close history">
              <CloseIcon />
            </button>
          </div>
          <div className="history-content">
            {entries.length ? (
              entries.map((entry) => <HistoryEntryRow entry={entry} key={entry.handNumber} playerUserId={playerUserId} />)
            ) : (
              <div className="empty-history">
                <strong>No completed hands yet</strong>
                <span>{emptyDescription}</span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HistoryEntryRow({ entry, playerUserId }: { entry: HandHistoryEntry; playerUserId: string }) {
  const playerResult = entry.participants.find((participant) => participant.userId === playerUserId);
  const resultClassName = playerResult ? (playerResult.delta >= 0 ? "history-result positive" : "history-result negative") : "history-result";

  return (
    <article className="history-row">
      <div className="history-row-heading">
        <div>
          <strong>Hand {entry.handNumber}</strong>
          <small>{entry.showdown ? "Showdown" : "Won without card reveal"}</small>
        </div>
        <span className={resultClassName}>{playerResult ? formatSignedCurrency(playerResult.delta) : "Sat out"}</span>
      </div>

      <div className="history-winners">
        {entry.winners.map((winner) => (
          <div className="history-winner" key={`${entry.handNumber}-${winner.userId}`}>
            <div>
              <strong>{winner.displayName}</strong>
              <span>
                ${winner.amount.toLocaleString()}
                {winner.handName ? ` · ${winner.handName}` : ""}
              </span>
            </div>
            {winner.holeCards?.length ? (
              <div className="history-card-pair" aria-label={`${winner.displayName} winning cards`}>
                {winner.holeCards.map((card) => (
                  <CardView card={card} key={`${winner.userId}-${card.rank}-${card.suit}`} />
                ))}
              </div>
            ) : (
              <small>No cards shown</small>
            )}
          </div>
        ))}
      </div>

      {entry.communityCards.length ? (
        <div className="history-board" aria-label="Community cards">
          {entry.communityCards.map((card, index) => (
            <CardView card={card} key={`${entry.handNumber}-board-${index}-${card.rank}-${card.suit}`} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function IconSoundButton({
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
    <div className="sound-control">
      <button
        className={soundEnabled ? "icon-toggle active" : "icon-toggle"}
        onClick={() => setSoundEnabled((value) => !value)}
        aria-label={soundEnabled ? "Mute SFX" : "Unmute SFX"}
        title={soundEnabled ? "Mute SFX" : "Unmute SFX"}
      >
        <SpeakerIcon muted={!soundEnabled} />
      </button>
      <div className="volume-popover" aria-label="SFX volume">
        <span>Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => {
            const nextVolume = Number(event.target.value);
            setVolume(nextVolume);
            if (nextVolume > 0) setSoundEnabled(true);
          }}
        />
        <strong>{Math.round(volume * 100)}%</strong>
      </div>
    </div>
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

function HistoryIcon() {
  return (
    <svg className="history-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.8 5.4h10.4a1.8 1.8 0 0 1 1.8 1.8v11.1H5V7.2a1.8 1.8 0 0 1 1.8-1.8Z" />
      <path d="M8.4 9h7.2M8.4 12h7.2M8.4 15h4.4" />
      <path d="M5 18.3h14" />
      <path d="M8 3.7h8" />
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
  if (name === "card") {
    playNoiseHit(ctx, volume, 0.09, 950, 0.28);
    return;
  }
  if (name === "chips-fly") {
    playChipFly(ctx, volume);
    return;
  }
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const map: Record<SfxName, [number, number]> = {
    deal: [520, 0.08],
    card: [520, 0.08],
    chip: [280, 0.1],
    "chips-fly": [520, 0.2],
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

function playNoiseHit(ctx: AudioContext, volume: number, duration: number, filterFrequency: number, gainScale = 0.12) {
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) {
    const decay = 1 - index / sampleCount;
    data[index] = (Math.random() * 2 - 1) * decay * decay;
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  filter.type = "bandpass";
  filter.frequency.value = filterFrequency;
  filter.Q.value = 3.2;
  gain.gain.value = volume * gainScale;
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

function playChipFly(ctx: AudioContext, volume: number) {
  [360, 470, 590, 720, 880].forEach((frequency, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + index * 0.032;
    osc.type = index % 2 ? "square" : "triangle";
    osc.frequency.setValueAtTime(frequency, start);
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.62, start + 0.11);
    gain.gain.setValueAtTime(volume * 0.075, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.18);
  });
  playNoiseHit(ctx, volume, 0.28, 2200, 0.24);
  window.setTimeout(() => playNoiseHit(ctx, volume, 0.18, 3200, 0.16), 70);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
