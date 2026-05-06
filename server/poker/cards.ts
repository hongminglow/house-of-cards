import type { Card, Rank, Suit } from "../../shared/types";

export const suits: Suit[] = ["clubs", "diamonds", "hearts", "spades"];
export const ranks: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];

export const rankValue = (rank: Rank): number => ranks.indexOf(rank) + 2;

export function createDeck(): Card[] {
  return suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));
}

export function shuffleDeck(seed = `${Date.now()}-${Math.random()}`): Card[] {
  const deck = createDeck();
  let state = hashSeed(seed);

  for (let index = deck.length - 1; index > 0; index -= 1) {
    state = mulberry32(state);
    const swapIndex = Math.floor((state / 0xffffffff) * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(value: number): number {
  let next = (value + 0x6d2b79f5) >>> 0;
  next = Math.imul(next ^ (next >>> 15), next | 1);
  next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
  return (next ^ (next >>> 14)) >>> 0;
}
