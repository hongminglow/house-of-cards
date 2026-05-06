import {
  TURN_ACTION_MS,
  type Card,
  type GameSnapshot,
  type LegalAction,
  type PlayerPrivateState,
  type PokerActionPayload,
  type RoomPublicState,
  type SeatPublic,
  type Street
} from "../../shared/types";
import { shuffleDeck } from "./cards";
import { evaluateSeven } from "./evaluator";

export const MAX_PLAYERS = 6;
export const DEFAULT_BUY_IN = 100_000;
export const DEFAULT_SMALL_BLIND = 500;
export const DEFAULT_BIG_BLIND = 1_000;
export const ACTION_MS = TURN_ACTION_MS;

export type EngineUser = {
  id: string;
  email: string;
  displayName: string;
  chipBalance: number;
};

type SeatState = {
  seatIndex: number;
  userId: string;
  email: string;
  displayName: string;
  accountBalance: number;
  stack: number;
  currentBet: number;
  committed: number;
  holeCards: Card[];
  hasFolded: boolean;
  isAllIn: boolean;
  isReady: boolean;
  isConnected: boolean;
  actedThisStreet: boolean;
  leaveAfterHand: boolean;
};

export type SettlementDelta = {
  userId: string;
  delta: number;
  resultingStack: number;
};

export type HandRecord = {
  roomCode: string;
  handNumber: number;
  communityCards: Card[];
  snapshot: RoomPublicState;
  settlements: SettlementDelta[];
};

export type RoomEvent =
  | { type: "none" }
  | { type: "sfx"; name: "deal" | "card" | "chip" | "chips-fly" | "check" | "fold" | "all-in" | "winner" }
  | { type: "settled"; record: HandRecord };

export type LeaveResult = {
  returned: SettlementDelta | null;
  event: RoomEvent;
};

export class PokerRoom {
  readonly code: string;
  readonly maxPlayers = MAX_PLAYERS;
  readonly buyIn = DEFAULT_BUY_IN;
  readonly smallBlind = DEFAULT_SMALL_BLIND;
  readonly bigBlind = DEFAULT_BIG_BLIND;

  private seats = new Map<number, SeatState>();
  private deck: Card[] = [];
  private communityCards: Card[] = [];
  private street: Street = "waiting";
  private handNumber = 0;
  private dealerSeat = -1;
  private smallBlindSeat: number | null = null;
  private bigBlindSeat: number | null = null;
  private currentTurnSeat: number | null = null;
  private currentBet = 0;
  private lastAction = "Waiting for players";
  private winners: RoomPublicState["winners"] = [];
  private actionDeadlineAt: number | null = null;
  private history: RoomPublicState["history"] = [];

  constructor(code: string) {
    this.code = code;
  }

  join(user: EngineUser): SeatState {
    const existing = this.findSeatByUser(user.id);
    if (existing) {
      existing.isConnected = true;
      existing.leaveAfterHand = false;
      return existing;
    }

    if (user.chipBalance < this.buyIn) {
      throw new Error("You need at least 100,000 chips to sit at this table.");
    }

    const openSeat = Array.from({ length: this.maxPlayers }, (_, index) => index).find((index) => !this.seats.has(index));
    if (openSeat === undefined) {
      throw new Error("This room is full.");
    }

    const seat: SeatState = {
      seatIndex: openSeat,
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      accountBalance: user.chipBalance - this.buyIn,
      stack: this.buyIn,
      currentBet: 0,
      committed: 0,
      holeCards: [],
      hasFolded: false,
      isAllIn: false,
      isReady: false,
      isConnected: true,
      actedThisStreet: false,
      leaveAfterHand: false
    };
    this.seats.set(openSeat, seat);
    this.lastAction = `${seat.displayName} joined the table`;
    return seat;
  }

  leave(userId: string): LeaveResult {
    const seat = this.findSeatByUser(userId);
    if (!seat) return { returned: null, event: { type: "none" } };

    if (this.street !== "waiting" && this.street !== "settled") {
      const wasCurrentTurn = this.currentTurnSeat === seat.seatIndex;
      seat.isConnected = false;
      seat.isReady = false;
      seat.leaveAfterHand = true;

      if (seat.holeCards.length > 0 && !seat.hasFolded) {
        seat.hasFolded = true;
        seat.actedThisStreet = true;
        this.lastAction = `${seat.displayName} left and folded`;

        if (this.contenders().length === 1) {
          return {
            returned: null,
            event: this.settle([{ seat: this.contenders()[0], amount: this.pot(), handName: "Uncontested" }])
          };
        }

        if (wasCurrentTurn) {
          return { returned: null, event: this.progressAfterAction() ?? { type: "sfx", name: "fold" } };
        }

        return { returned: null, event: { type: "sfx", name: "fold" } };
      }

      this.lastAction = `${seat.displayName} left the table`;
      return { returned: null, event: { type: "none" } };
    }

    this.seats.delete(seat.seatIndex);
    const delta = seat.stack;
    seat.accountBalance += delta;
    this.lastAction = `${seat.displayName} left the room`;
    return {
      returned: {
        userId: seat.userId,
        delta,
        resultingStack: 0
      },
      event: { type: "none" }
    };
  }

  disconnect(userId: string): void {
    const seat = this.findSeatByUser(userId);
    if (!seat) return;
    seat.isConnected = false;
    this.lastAction = `${seat.displayName} disconnected`;
  }

  ready(userId: string): RoomEvent {
    const seat = this.requireSeat(userId);
    seat.isReady = true;
    this.lastAction = `${seat.displayName} joined the game`;

    if ((this.street === "waiting" || this.street === "settled") && this.readySeats().length >= 2) {
      return this.startHand();
    }
    return { type: "none" };
  }

  act(userId: string, action: PokerActionPayload): RoomEvent {
    const seat = this.requireSeat(userId);
    if (this.currentTurnSeat !== seat.seatIndex) {
      throw new Error("It is not your turn.");
    }

    const legal = this.legalActionsFor(seat);
    const legalAction = legal.find((item) => item.type === action.type);
    if (!legalAction) {
      throw new Error("That action is not legal right now.");
    }

    const callAmount = Math.max(0, this.currentBet - seat.currentBet);
    const requestedAmount = Math.floor(action.amount ?? 0);
    let event: RoomEvent = { type: "none" };

    switch (action.type) {
      case "fold":
        seat.hasFolded = true;
        seat.actedThisStreet = true;
        this.lastAction = `${seat.displayName} folded`;
        event = { type: "sfx", name: "fold" };
        break;
      case "check":
        if (callAmount > 0) throw new Error("Cannot check while facing a bet.");
        seat.actedThisStreet = true;
        this.lastAction = `${seat.displayName} checked`;
        event = { type: "sfx", name: "check" };
        break;
      case "call":
        this.commit(seat, callAmount);
        seat.actedThisStreet = true;
        this.lastAction = `${seat.displayName} called ${callAmount.toLocaleString()}`;
        event = { type: "sfx", name: "chip" };
        break;
      case "bet":
      case "raise": {
        const minAmount = legalAction.minAmount ?? this.bigBlind;
        const maxAmount = legalAction.maxAmount ?? seat.stack + seat.currentBet;
        const targetBet = Math.max(minAmount, Math.min(requestedAmount, maxAmount));
        const extra = targetBet - seat.currentBet;
        this.commit(seat, extra);
        this.currentBet = seat.currentBet;
        this.activeSeats().forEach((candidate) => {
          if (candidate.userId !== seat.userId && !candidate.hasFolded && !candidate.isAllIn) {
            candidate.actedThisStreet = false;
          }
        });
        seat.actedThisStreet = true;
        this.lastAction = `${seat.displayName} ${action.type === "bet" ? "bet" : "raised to"} ${targetBet.toLocaleString()}`;
        event = { type: "sfx", name: "chip" };
        break;
      }
      case "all-in": {
        this.commit(seat, seat.stack);
        if (seat.currentBet > this.currentBet) {
          this.currentBet = seat.currentBet;
          this.activeSeats().forEach((candidate) => {
            if (candidate.userId !== seat.userId && !candidate.hasFolded && !candidate.isAllIn) {
              candidate.actedThisStreet = false;
            }
          });
        }
        seat.actedThisStreet = true;
        this.lastAction = `${seat.displayName} is all-in`;
        event = { type: "sfx", name: "all-in" };
        break;
      }
    }

    const settled = this.progressAfterAction();
    return settled ?? event;
  }

  autoAct(): RoomEvent {
    if (this.currentTurnSeat === null) return { type: "none" };
    const seat = this.seats.get(this.currentTurnSeat);
    if (!seat) return { type: "none" };
    return this.act(seat.userId, { type: "fold" });
  }

  timeoutCurrentTurn(): RoomEvent {
    if (this.currentTurnSeat === null) return { type: "none" };
    const seat = this.seats.get(this.currentTurnSeat);
    if (!seat) return { type: "none" };
    seat.isReady = false;
    seat.isConnected = false;
    seat.leaveAfterHand = true;
    const event = this.autoAct();
    if (event.type !== "settled") {
      this.lastAction = `${seat.displayName} timed out and left the seat`;
    }
    return event;
  }

  continueIfReady(): RoomEvent {
    if (this.street !== "waiting" && this.street !== "settled") return { type: "none" };
    if (this.readySeats().length < 2) {
      this.street = "waiting";
      this.lastAction = "Waiting for at least two players in the game";
      return { type: "none" };
    }
    return this.startHand();
  }

  releaseTimedOutSeats(): SettlementDelta[] {
    if (this.street !== "waiting" && this.street !== "settled") return [];
    const leaving = this.activeSeats().filter((seat) => seat.leaveAfterHand);
    if (leaving.length === 0) return [];

    const deltas = leaving.map((seat) => {
      this.seats.delete(seat.seatIndex);
      const delta = seat.stack;
      seat.accountBalance += delta;
      return {
        userId: seat.userId,
        delta,
        resultingStack: 0
      };
    });

    this.lastAction = `${leaving.map((seat) => seat.displayName).join(", ")} left the table`;
    return deltas;
  }

  snapshotFor(userId: string): GameSnapshot {
    const seat = this.findSeatByUser(userId);
    const privateState: PlayerPrivateState = seat
      ? {
          userId: seat.userId,
          email: seat.email,
          displayName: seat.displayName,
          accountBalance: seat.accountBalance,
          roomCode: this.code,
          seatIndex: seat.seatIndex,
          isReady: seat.isReady,
          holeCards: seat.holeCards,
          legalActions: this.currentTurnSeat === seat.seatIndex ? this.legalActionsFor(seat) : []
        }
      : {
          userId,
          email: "",
          displayName: "",
          accountBalance: 0,
          holeCards: [],
          legalActions: []
        };

    return {
      room: this.publicState(),
      player: privateState
    };
  }

  publicState(): RoomPublicState {
    const seats = this.publicSeats().map((seat) => this.toPublicSeat(seat));
    return {
      roomCode: this.code,
      maxPlayers: this.maxPlayers,
      buyIn: this.buyIn,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      handNumber: this.handNumber,
      street: this.street,
      seats,
      communityCards: this.communityCards,
      pot: this.pot(),
      currentBet: this.currentBet,
      currentTurnSeat: this.currentTurnSeat,
      lastAction: this.lastAction,
      winners: this.winners,
      actionDeadlineAt: this.actionDeadlineAt,
      history: this.history
    };
  }

  hasUser(userId: string): boolean {
    return Boolean(this.findSeatByUser(userId));
  }

  isEmpty(): boolean {
    return this.seats.size === 0;
  }

  private startHand(): RoomEvent {
    const participants = this.readySeats();
    if (participants.length < 2) {
      this.street = "waiting";
      this.lastAction = "Waiting for at least two players";
      return { type: "none" };
    }

    this.handNumber += 1;
    this.deck = shuffleDeck(`${this.code}-${this.handNumber}-${Date.now()}`);
    this.communityCards = [];
    this.street = "preflop";
    this.currentBet = 0;
    this.winners = [];
    participants.forEach((seat) => {
      seat.currentBet = 0;
      seat.committed = 0;
      seat.holeCards = [this.draw(), this.draw()];
      seat.hasFolded = false;
      seat.isAllIn = false;
      seat.actedThisStreet = false;
    });

    this.dealerSeat = this.nextOccupiedSeat(this.dealerSeat);
    this.smallBlindSeat = participants.length === 2 ? this.dealerSeat : this.nextOccupiedSeat(this.dealerSeat);
    this.bigBlindSeat = this.nextOccupiedSeat(this.smallBlindSeat);
    this.postBlind(this.smallBlindSeat, this.smallBlind);
    this.postBlind(this.bigBlindSeat, this.bigBlind);
    this.currentBet = Math.max(...participants.map((seat) => seat.currentBet));
    this.currentTurnSeat = this.nextActionableSeat(this.bigBlindSeat);
    this.armTimer();
    this.lastAction = `Hand ${this.handNumber} started`;
    return { type: "sfx", name: "deal" };
  }

  private progressAfterAction(): RoomEvent | null {
    const contenders = this.contenders();
    if (contenders.length === 1) {
      return this.settle([{ seat: contenders[0], amount: this.pot(), handName: "Uncontested" }]);
    }

    if (this.everyoneDone()) {
      return this.advanceStreet();
    }

    this.currentTurnSeat = this.nextActionableSeat(this.currentTurnSeat);
    this.armTimer();
    return null;
  }

  private advanceStreet(): RoomEvent {
    this.activeSeats().forEach((seat) => {
      seat.currentBet = 0;
      seat.actedThisStreet = false;
    });
    this.currentBet = 0;

    if (this.contenders().filter((seat) => !seat.isAllIn).length <= 1) {
      while (this.communityCards.length < 5) this.communityCards.push(this.draw());
      return this.showdown();
    }

    if (this.street === "preflop") {
      this.communityCards.push(this.draw(), this.draw(), this.draw());
      this.street = "flop";
    } else if (this.street === "flop") {
      this.communityCards.push(this.draw());
      this.street = "turn";
    } else if (this.street === "turn") {
      this.communityCards.push(this.draw());
      this.street = "river";
    } else {
      return this.showdown();
    }

    this.currentTurnSeat = this.nextActionableSeat(this.dealerSeat);
    this.armTimer();
    this.lastAction = `${this.street.toUpperCase()} dealt`;
    return { type: "none" };
  }

  private showdown(): RoomEvent {
    this.street = "showdown";
    const contenders = this.contenders();
    const evaluated = contenders.map((seat) => ({
      seat,
      result: evaluateSeven([...seat.holeCards, ...this.communityCards])
    }));
    const pots = buildPots(this.activeSeats());
    const payouts = new Map<string, { amount: number; handName?: string; bestCards?: Card[] }>();

    for (const pot of pots) {
      const eligible = evaluated.filter((item) => pot.eligibleUserIds.has(item.seat.userId));
      const bestScore = Math.max(...eligible.map((item) => item.result.score));
      const winners = eligible.filter((item) => item.result.score === bestScore);
      const share = Math.floor(pot.amount / winners.length);
      const remainder = pot.amount - share * winners.length;
      winners.forEach((winner, index) => {
        const existing = payouts.get(winner.seat.userId) ?? { amount: 0, handName: winner.result.name, bestCards: winner.result.cards };
        existing.amount += share + (index === 0 ? remainder : 0);
        existing.handName = winner.result.name;
        existing.bestCards = winner.result.cards;
        payouts.set(winner.seat.userId, existing);
      });
    }

    return this.settle(
      [...payouts.entries()].map(([userId, payout]) => ({
        seat: this.requireSeat(userId),
        amount: payout.amount,
        handName: payout.handName,
        bestCards: payout.bestCards
      })),
      true
    );
  }

  private settle(results: Array<{ seat: SeatState; amount: number; handName?: string; bestCards?: Card[] }>, showdown = false): RoomEvent {
    results.forEach(({ seat, amount }) => {
      seat.stack += amount;
    });

    this.winners = results.map(({ seat, amount, handName }) => ({
      userId: seat.userId,
      displayName: seat.displayName,
      amount,
      handName
    }));
    this.lastAction =
      this.winners.length > 1
        ? `${this.winners.map((winner) => winner.displayName).join(", ")} split the pot`
        : `${this.winners[0]?.displayName ?? "A player"} won the pot`;
    this.street = "settled";
    this.currentTurnSeat = null;
    this.actionDeadlineAt = null;
    const settlements = this.settlementDeltas(results);
    this.history = [
      {
        handNumber: this.handNumber,
        endedAt: Date.now(),
        communityCards: [...this.communityCards],
        showdown,
        winners: results.map(({ seat, amount, handName, bestCards }) => ({
          userId: seat.userId,
          displayName: seat.displayName,
          amount,
          handName,
          ...(showdown ? { holeCards: [...seat.holeCards], bestCards: bestCards ? [...bestCards] : undefined } : {})
        })),
        participants: settlements.map((settlement) => {
          const seat = this.requireSeat(settlement.userId);
          return {
            userId: seat.userId,
            displayName: seat.displayName,
            delta: settlement.delta
          };
        })
      },
      ...this.history
    ].slice(0, 20);

    const record: HandRecord = {
      roomCode: this.code,
      handNumber: this.handNumber,
      communityCards: this.communityCards,
      snapshot: this.publicState(),
      settlements
    };

    this.activeSeats().forEach((seat) => {
      seat.currentBet = 0;
      seat.committed = 0;
      seat.actedThisStreet = false;
      seat.hasFolded = false;
      seat.isAllIn = false;
      seat.holeCards = [];
    });

    return { type: "settled", record };
  }

  private settlementDeltas(results: Array<{ seat: SeatState; amount: number; handName?: string; bestCards?: Card[] }>): SettlementDelta[] {
    const payoutByUser = new Map(results.map(({ seat, amount }) => [seat.userId, amount]));
    return this.activeSeats()
      .filter((seat) => seat.holeCards.length > 0 || seat.committed > 0)
      .map((seat) => ({
        userId: seat.userId,
        delta: (payoutByUser.get(seat.userId) ?? 0) - seat.committed,
        resultingStack: seat.stack
      }));
  }

  private legalActionsFor(seat: SeatState): LegalAction[] {
    if (this.currentTurnSeat !== seat.seatIndex || seat.hasFolded || seat.isAllIn) return [];
    const callAmount = Math.max(0, this.currentBet - seat.currentBet);
    const maxTotalBet = seat.currentBet + seat.stack;
    const actions: LegalAction[] = [{ type: "fold" }, { type: "all-in", maxAmount: maxTotalBet }];

    if (callAmount === 0) {
      actions.push({ type: "check" });
      if (seat.stack > 0) {
        actions.push({ type: "bet", minAmount: Math.min(this.bigBlind, maxTotalBet), maxAmount: maxTotalBet });
      }
    } else {
      actions.push({ type: "call", callAmount: Math.min(callAmount, seat.stack) });
      const minRaise = this.currentBet + this.bigBlind;
      if (maxTotalBet > this.currentBet) {
        actions.push({ type: "raise", minAmount: Math.min(minRaise, maxTotalBet), maxAmount: maxTotalBet });
      }
    }

    return actions;
  }

  private commit(seat: SeatState, amount: number): void {
    const committed = Math.max(0, Math.min(amount, seat.stack));
    seat.stack -= committed;
    seat.currentBet += committed;
    seat.committed += committed;
    if (seat.stack === 0) seat.isAllIn = true;
  }

  private postBlind(seatIndex: number, blind: number): void {
    const seat = this.seats.get(seatIndex);
    if (!seat) return;
    this.commit(seat, blind);
  }

  private everyoneDone(): boolean {
    return this.contenders().every((seat) => seat.isAllIn || (seat.actedThisStreet && seat.currentBet === this.currentBet));
  }

  private activeSeats(): SeatState[] {
    return [...this.seats.values()].sort((a, b) => a.seatIndex - b.seatIndex);
  }

  private readySeats(): SeatState[] {
    return this.activeSeats().filter((seat) => seat.isReady && seat.isConnected && seat.stack > 0 && !seat.leaveAfterHand);
  }

  private publicSeats(): SeatState[] {
    return this.activeSeats().filter((seat) => !seat.leaveAfterHand);
  }

  private contenders(): SeatState[] {
    return this.activeSeats().filter((seat) => seat.holeCards.length > 0 && !seat.hasFolded);
  }

  private nextOccupiedSeat(afterSeat: number | null): number {
    const occupied = this.readySeats();
    if (occupied.length === 0) throw new Error("No occupied seats.");
    const sorted = occupied.map((seat) => seat.seatIndex);
    const current = afterSeat ?? -1;
    return sorted.find((seatIndex) => seatIndex > current) ?? sorted[0];
  }

  private nextActionableSeat(afterSeat: number | null): number | null {
    const seats = this.activeSeats().filter((seat) => !seat.hasFolded && !seat.isAllIn && seat.holeCards.length > 0);
    if (seats.length === 0) return null;
    const sorted = seats.map((seat) => seat.seatIndex);
    const current = afterSeat ?? -1;
    return sorted.find((seatIndex) => seatIndex > current) ?? sorted[0];
  }

  private armTimer(): void {
    this.actionDeadlineAt = this.currentTurnSeat === null ? null : Date.now() + ACTION_MS;
  }

  private pot(): number {
    return this.activeSeats().reduce((total, seat) => total + seat.committed, 0);
  }

  private draw(): Card {
    const card = this.deck.pop();
    if (!card) throw new Error("Deck is empty.");
    return card;
  }

  private toPublicSeat(seat: SeatState): SeatPublic {
    return {
      seatIndex: seat.seatIndex,
      userId: seat.userId,
      displayName: seat.displayName,
      stack: seat.stack,
      currentBet: seat.currentBet,
      hasCards: seat.holeCards.length > 0,
      isFolded: seat.hasFolded,
      isAllIn: seat.isAllIn,
      isDealer: seat.seatIndex === this.dealerSeat,
      isSmallBlind: seat.seatIndex === this.smallBlindSeat,
      isBigBlind: seat.seatIndex === this.bigBlindSeat,
      isConnected: seat.isConnected,
      isReady: seat.isReady
    };
  }

  private requireSeat(userId: string): SeatState {
    const seat = this.findSeatByUser(userId);
    if (!seat) throw new Error("You are not seated in this room.");
    return seat;
  }

  private findSeatByUser(userId: string): SeatState | undefined {
    return [...this.seats.values()].find((seat) => seat.userId === userId);
  }
}

function buildPots(seats: SeatState[]): Array<{ amount: number; eligibleUserIds: Set<string> }> {
  const committedSeats = seats.filter((seat) => seat.committed > 0);
  const levels = [...new Set(committedSeats.map((seat) => seat.committed))].sort((a, b) => a - b);
  const pots: Array<{ amount: number; eligibleUserIds: Set<string> }> = [];
  let previous = 0;

  for (const level of levels) {
    const contributors = committedSeats.filter((seat) => seat.committed >= level);
    const amount = (level - previous) * contributors.length;
    if (amount > 0) {
      pots.push({
        amount,
        eligibleUserIds: new Set(contributors.filter((seat) => !seat.hasFolded).map((seat) => seat.userId))
      });
    }
    previous = level;
  }

  return pots;
}
