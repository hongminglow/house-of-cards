import type { Card, Suit } from "../../../shared/types";

const rankLabels: Record<Card["rank"], string> = {
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  T: "10",
  J: "J",
  Q: "Q",
  K: "K",
  A: "A"
};

const pipCounts: Partial<Record<Card["rank"], number>> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  A: 1
};

export function CardView({ card }: { card: Card }) {
  const red = card.suit === "hearts" || card.suit === "diamonds";
  const label = rankLabels[card.rank];

  return (
    <div className={red ? "card-view red" : "card-view"} aria-label={`${label} of ${card.suit}`}>
      <CardCorner rank={label} suit={card.suit} />
      <div className={card.rank === "J" || card.rank === "Q" || card.rank === "K" ? "card-center face" : "card-center"}>
        {card.rank === "J" || card.rank === "Q" || card.rank === "K" ? (
          <FaceCard rank={card.rank} suit={card.suit} />
        ) : (
          <PipLayout count={pipCounts[card.rank] ?? 1} suit={card.suit} />
        )}
      </div>
      <CardCorner rank={label} suit={card.suit} bottom />
    </div>
  );
}

function CardCorner({ rank, suit, bottom = false }: { rank: string; suit: Suit; bottom?: boolean }) {
  return (
    <div className={bottom ? "card-corner bottom" : "card-corner"}>
      <strong>{rank}</strong>
      <SuitMark suit={suit} />
    </div>
  );
}

function PipLayout({ count, suit }: { count: number; suit: Suit }) {
  return (
    <div className={`pip-layout pips-${count}`}>
      {Array.from({ length: count }, (_, index) => (
        <SuitMark suit={suit} key={index} />
      ))}
    </div>
  );
}

function FaceCard({ rank, suit }: { rank: "J" | "Q" | "K"; suit: Suit }) {
  return (
    <div className="face-card">
      <div className="royal-crown">
        <span />
        <span />
        <span />
      </div>
      <div className="royal-head" />
      <div className="royal-body">
        <SuitMark suit={suit} />
      </div>
      <strong>{rank}</strong>
    </div>
  );
}

function SuitMark({ suit }: { suit: Suit }) {
  if (suit === "hearts") {
    return (
      <svg className="suit-mark" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.6C7.8 16.6 4 13.2 4 8.9 4 6.3 5.8 4.5 8.2 4.5c1.5 0 2.9.8 3.8 2.1.9-1.3 2.3-2.1 3.8-2.1 2.4 0 4.2 1.8 4.2 4.4 0 4.3-3.8 7.7-8 11.7Z" />
      </svg>
    );
  }

  if (suit === "diamonds") {
    return (
      <svg className="suit-mark" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.8 20.2 12 12 21.2 3.8 12 12 2.8Z" />
      </svg>
    );
  }

  if (suit === "clubs") {
    return (
      <svg className="suit-mark" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9.4 10.5a4.1 4.1 0 1 1 5.2 0 4.4 4.4 0 1 1-2.6 7.5 4.4 4.4 0 1 1-2.6-7.5Z" />
        <path d="M12 14.6c.4 2.2.9 4 2.4 5.9H9.6c1.5-1.9 2-3.7 2.4-5.9Z" />
      </svg>
    );
  }

  return (
    <svg className="suit-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.4c4.2 4 8 7.4 8 11.7 0 2.6-1.8 4.4-4.2 4.4-1.5 0-2.9-.8-3.8-2.1-.9 1.3-2.3 2.1-3.8 2.1-2.4 0-4.2-1.8-4.2-4.4 0-4.3 3.8-7.7 8-11.7Z" />
      <path d="M12 14.2c.4 2.2.9 4.2 2.5 6.3h-5c1.6-2.1 2.1-4.1 2.5-6.3Z" />
    </svg>
  );
}
