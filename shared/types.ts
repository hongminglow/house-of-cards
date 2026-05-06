export type Suit = "clubs" | "diamonds" | "hearts" | "spades";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";

export type Card = {
  rank: Rank;
  suit: Suit;
};

export type Street = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown" | "settled";
export type PlayerAction = "fold" | "check" | "call" | "bet" | "raise" | "all-in";

export type SeatPublic = {
  seatIndex: number;
  userId: string;
  displayName: string;
  stack: number;
  currentBet: number;
  hasCards: boolean;
  isFolded: boolean;
  isAllIn: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isConnected: boolean;
  isReady: boolean;
};

export type LegalAction = {
  type: PlayerAction;
  minAmount?: number;
  maxAmount?: number;
  callAmount?: number;
};

export type RoomPublicState = {
  roomCode: string;
  maxPlayers: number;
  buyIn: number;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  street: Street;
  seats: SeatPublic[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  currentTurnSeat: number | null;
  lastAction: string;
  winners: Array<{ userId: string; displayName: string; amount: number; handName?: string }>;
  actionDeadlineAt: number | null;
};

export type PlayerPrivateState = {
  userId: string;
  email: string;
  displayName: string;
  accountBalance: number;
  roomCode?: string;
  seatIndex?: number;
  isReady?: boolean;
  holeCards: Card[];
  legalActions: LegalAction[];
};

export type GameSnapshot = {
  room: RoomPublicState | null;
  player: PlayerPrivateState;
};

export type AuthPayload = {
  email: string;
  displayName?: string;
};

export type JoinRoomPayload = {
  roomCode?: string;
};

export type PokerActionPayload = {
  type: PlayerAction;
  amount?: number;
};

export type ServerToClientEvents = {
  snapshot: (snapshot: GameSnapshot) => void;
  notice: (message: string) => void;
  sfx: (name: SfxName) => void;
};

export type ClientToServerEvents = {
  auth: (payload: AuthPayload, ack: (snapshot: GameSnapshot) => void) => void;
  createRoom: (ack: (snapshot: GameSnapshot) => void) => void;
  joinRoom: (payload: JoinRoomPayload, ack: (snapshot: GameSnapshot) => void) => void;
  leaveRoom: () => void;
  ready: () => void;
  action: (payload: PokerActionPayload) => void;
};

export type SfxName =
  | "deal"
  | "chip"
  | "check"
  | "fold"
  | "all-in"
  | "winner"
  | "join"
  | "leave"
  | "warning";

export const formatCard = (card: Card): string => `${card.rank}${card.suit[0].toUpperCase()}`;
