import type { Card } from "../../shared/types";
import { rankValue } from "./cards";

export type HandResult = {
  score: number;
  name: string;
  ranks: number[];
};

const handRanks = [
  "High Card",
  "Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush"
] as const;

export function evaluateSeven(cards: Card[]): HandResult {
  if (cards.length < 5) {
    throw new Error("At least five cards are required to evaluate a poker hand.");
  }

  let best: HandResult | null = null;
  for (const combo of combinations(cards, 5)) {
    const result = evaluateFive(combo);
    if (!best || result.score > best.score) {
      best = result;
    }
  }

  return best!;
}

export function compareHands(left: Card[], right: Card[]): number {
  return evaluateSeven(left).score - evaluateSeven(right).score;
}

function evaluateFive(cards: Card[]): HandResult {
  const values = cards.map((card) => rankValue(card.rank)).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  const countGroups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const isFlush = cards.every((card) => card.suit === cards[0].suit);
  const straightHigh = getStraightHigh(values);

  if (isFlush && straightHigh) {
    return makeResult(8, [straightHigh]);
  }

  if (countGroups[0][1] === 4) {
    return makeResult(7, [countGroups[0][0], highestExcept(values, [countGroups[0][0]])]);
  }

  if (countGroups[0][1] === 3 && countGroups[1]?.[1] === 2) {
    return makeResult(6, [countGroups[0][0], countGroups[1][0]]);
  }

  if (isFlush) {
    return makeResult(5, values);
  }

  if (straightHigh) {
    return makeResult(4, [straightHigh]);
  }

  if (countGroups[0][1] === 3) {
    return makeResult(3, [countGroups[0][0], ...values.filter((value) => value !== countGroups[0][0])]);
  }

  if (countGroups[0][1] === 2 && countGroups[1]?.[1] === 2) {
    const pairs = countGroups.filter(([, count]) => count === 2).map(([value]) => value).sort((a, b) => b - a);
    return makeResult(2, [...pairs, highestExcept(values, pairs)]);
  }

  if (countGroups[0][1] === 2) {
    return makeResult(1, [countGroups[0][0], ...values.filter((value) => value !== countGroups[0][0])]);
  }

  return makeResult(0, values);
}

function makeResult(category: number, ranks: number[]): HandResult {
  const padded = [...ranks, 0, 0, 0, 0, 0].slice(0, 5);
  const score = category * 1_000_000_000 + padded.reduce((total, value, index) => total + value * 15 ** (4 - index), 0);
  return {
    score,
    name: handRanks[category],
    ranks: padded
  };
}

function getStraightHigh(values: number[]): number | null {
  const unique = [...new Set(values)];
  if (unique.includes(14)) unique.push(1);
  const sorted = unique.sort((a, b) => b - a);

  for (let index = 0; index <= sorted.length - 5; index += 1) {
    const slice = sorted.slice(index, index + 5);
    if (slice.every((value, sliceIndex) => sliceIndex === 0 || value === slice[sliceIndex - 1] - 1)) {
      return slice[0] === 1 ? 5 : slice[0];
    }
  }

  return null;
}

function highestExcept(values: number[], excluded: number[]): number {
  return values.find((value) => !excluded.includes(value)) ?? 0;
}

function combinations<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];

  function visit(start: number, combo: T[]): void {
    if (combo.length === size) {
      result.push([...combo]);
      return;
    }

    for (let index = start; index < items.length; index += 1) {
      combo.push(items[index]);
      visit(index + 1, combo);
      combo.pop();
    }
  }

  visit(0, []);
  return result;
}
