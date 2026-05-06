import { describe, expect, it } from "vitest";
import type { Card } from "../shared/types";
import { evaluateSeven } from "../server/poker/evaluator";
import { PokerRoom } from "../server/poker/engine";

const user = (index: number) => ({
  id: `u${index}`,
  email: `u${index}@example.com`,
  displayName: `Player ${index}`,
  chipBalance: 1_000_000
});

type TestSeat = {
  userId: string;
  holeCards: Card[];
  currentBet: number;
  committed: number;
  stack: number;
  hasFolded: boolean;
  isAllIn: boolean;
};

type TestableRoom = {
  seats: Map<number, TestSeat>;
  communityCards: Card[];
  currentBet: number;
  currentTurnSeat: number | null;
  showdown: () => ReturnType<PokerRoom["act"]>;
};

function forceShowdown(room: PokerRoom, hands: [Card[], Card[]], board: Card[]) {
  const testRoom = room as unknown as TestableRoom;
  const seats = [...testRoom.seats.values()];
  seats.forEach((seat, index) => {
    seat.holeCards = hands[index];
    seat.currentBet = 1_000;
    seat.committed = 1_000;
    seat.stack = 99_000;
    seat.hasFolded = false;
    seat.isAllIn = false;
  });
  testRoom.communityCards = board;
  testRoom.currentBet = 1_000;
  testRoom.currentTurnSeat = null;
  return testRoom.showdown();
}

describe("poker evaluator", () => {
  it("ranks a flush higher than a straight", () => {
    const flush: Card[] = [
      { rank: "A", suit: "hearts" },
      { rank: "J", suit: "hearts" },
      { rank: "8", suit: "hearts" },
      { rank: "5", suit: "hearts" },
      { rank: "2", suit: "hearts" },
      { rank: "K", suit: "clubs" },
      { rank: "3", suit: "spades" }
    ];
    const straight: Card[] = [
      { rank: "9", suit: "clubs" },
      { rank: "8", suit: "diamonds" },
      { rank: "7", suit: "hearts" },
      { rank: "6", suit: "spades" },
      { rank: "5", suit: "clubs" },
      { rank: "A", suit: "diamonds" },
      { rank: "2", suit: "spades" }
    ];

    expect(evaluateSeven(flush).score).toBeGreaterThan(evaluateSeven(straight).score);
  });

  it("handles wheel straights", () => {
    const cards: Card[] = [
      { rank: "A", suit: "clubs" },
      { rank: "2", suit: "diamonds" },
      { rank: "3", suit: "hearts" },
      { rank: "4", suit: "spades" },
      { rank: "5", suit: "clubs" },
      { rank: "K", suit: "diamonds" },
      { rank: "9", suit: "spades" }
    ];

    expect(evaluateSeven(cards).name).toBe("Straight");
  });
});

describe("poker room", () => {
  it("starts when two seated players are ready and only exposes local hole cards privately", () => {
    const room = new PokerRoom("TEST01");
    room.join(user(1));
    room.join(user(2));

    room.ready("u1");
    room.ready("u2");

    const first = room.snapshotFor("u1");
    const second = room.snapshotFor("u2");

    expect(first.room?.street).toBe("preflop");
    expect(first.player.holeCards).toHaveLength(2);
    expect(second.player.holeCards).toHaveLength(2);
    expect(first.player.holeCards).not.toEqual(second.player.holeCards);
    expect(first.room?.seats.every((seat) => seat.hasCards)).toBe(true);
  });

  it("rejects out-of-turn actions", () => {
    const room = new PokerRoom("TEST02");
    room.join(user(1));
    room.join(user(2));
    room.ready("u1");
    room.ready("u2");

    const turnSeat = room.publicState().currentTurnSeat;
    const nonTurnUser = room.publicState().seats.find((seat) => seat.seatIndex !== turnSeat)?.userId;

    expect(() => room.act(nonTurnUser!, { type: "fold" })).toThrow("It is not your turn.");
  });

  it("settles an uncontested pot when every opponent folds", () => {
    const room = new PokerRoom("TEST03");
    room.join(user(1));
    room.join(user(2));
    room.ready("u1");
    room.ready("u2");

    const turnUser = room.publicState().seats.find((seat) => seat.seatIndex === room.publicState().currentTurnSeat)!.userId;
    const event = room.act(turnUser, { type: "fold" });

    expect(event.type).toBe("settled");
    expect(room.publicState().street).toBe("settled");
    expect(room.publicState().winners).toHaveLength(1);
  });

  it("keeps ready players in the game and starts the next hand without another ready click", () => {
    const room = new PokerRoom("TEST04");
    room.join(user(1));
    room.join(user(2));
    room.ready("u1");
    room.ready("u2");

    const firstHand = room.publicState().handNumber;
    const turnUser = room.publicState().seats.find((seat) => seat.seatIndex === room.publicState().currentTurnSeat)!.userId;
    room.act(turnUser, { type: "fold" });

    expect(room.publicState().street).toBe("settled");
    expect(room.snapshotFor("u1").player.isReady).toBe(true);
    expect(room.snapshotFor("u2").player.isReady).toBe(true);

    const event = room.continueIfReady();

    expect(event.type).toBe("sfx");
    expect(room.publicState().street).toBe("preflop");
    expect(room.publicState().handNumber).toBe(firstHand + 1);
  });

  it("folds a timed-out player and releases their seat after the hand", () => {
    const room = new PokerRoom("TEST05");
    room.join(user(1));
    room.join(user(2));
    room.ready("u1");
    room.ready("u2");

    const timedOutUser = room.publicState().seats.find((seat) => seat.seatIndex === room.publicState().currentTurnSeat)!.userId;
    const event = room.timeoutCurrentTurn();

    expect(event.type).toBe("settled");
    expect(room.snapshotFor(timedOutUser).player.isReady).toBe(false);

    const returnedStacks = room.releaseTimedOutSeats();

    expect(returnedStacks).toHaveLength(1);
    expect(returnedStacks[0].userId).toBe(timedOutUser);
    expect(room.publicState().seats.some((seat) => seat.userId === timedOutUser)).toBe(false);
  });

  it("removes a leaving player from the public room count during an active hand", () => {
    const room = new PokerRoom("TEST06");
    room.join(user(1));
    room.join(user(2));
    room.ready("u1");
    room.ready("u2");

    const leavingUser = room.publicState().seats.find((seat) => seat.seatIndex === room.publicState().currentTurnSeat)!.userId;
    const result = room.leave(leavingUser);

    expect(result.returned).toBeNull();
    expect(room.publicState().seats).toHaveLength(1);
    expect(room.publicState().seats.some((seat) => seat.userId === leavingUser)).toBe(false);
    expect(room.publicState().street).toBe("settled");
  });

  it("records hand history without revealing winner cards on an uncontested fold", () => {
    const room = new PokerRoom("TEST07");
    room.join(user(1));
    room.join(user(2));
    room.ready("u1");
    room.ready("u2");

    const turnUser = room.publicState().seats.find((seat) => seat.seatIndex === room.publicState().currentTurnSeat)!.userId;
    room.act(turnUser, { type: "fold" });

    const [entry] = room.publicState().history;
    expect(entry.showdown).toBe(false);
    expect(entry.winners[0].holeCards).toBeUndefined();
    expect(entry.participants).toHaveLength(2);
    expect(entry.participants.reduce((total, participant) => total + participant.delta, 0)).toBe(0);
  });

  it("settles one winner when one showdown hand is stronger", () => {
    const room = new PokerRoom("TEST08");
    room.join(user(1));
    room.join(user(2));
    room.ready("u1");
    room.ready("u2");

    const event = forceShowdown(
      room,
      [
        [
          { rank: "A", suit: "clubs" },
          { rank: "3", suit: "diamonds" }
        ],
        [
          { rank: "K", suit: "clubs" },
          { rank: "4", suit: "diamonds" }
        ]
      ],
      [
        { rank: "Q", suit: "hearts" },
        { rank: "J", suit: "diamonds" },
        { rank: "9", suit: "clubs" },
        { rank: "7", suit: "spades" },
        { rank: "2", suit: "hearts" }
      ]
    );

    expect(event.type).toBe("settled");
    expect(room.publicState().winners).toHaveLength(1);
    expect(room.publicState().winners[0].userId).toBe("u1");
    expect(room.publicState().history[0].winners[0].bestCards).toHaveLength(5);
  });

  it("splits the pot when showdown hands tie exactly", () => {
    const room = new PokerRoom("TEST09");
    room.join(user(1));
    room.join(user(2));
    room.ready("u1");
    room.ready("u2");

    const event = forceShowdown(
      room,
      [
        [
          { rank: "2", suit: "clubs" },
          { rank: "3", suit: "diamonds" }
        ],
        [
          { rank: "4", suit: "clubs" },
          { rank: "5", suit: "diamonds" }
        ]
      ],
      [
        { rank: "A", suit: "hearts" },
        { rank: "K", suit: "diamonds" },
        { rank: "Q", suit: "clubs" },
        { rank: "J", suit: "spades" },
        { rank: "T", suit: "hearts" }
      ]
    );

    expect(event.type).toBe("settled");
    expect(room.publicState().winners).toHaveLength(2);
    expect(room.publicState().winners.map((winner) => winner.amount)).toEqual([1_000, 1_000]);
    expect(room.publicState().history[0].participants.map((participant) => participant.delta)).toEqual([0, 0]);
  });
});
