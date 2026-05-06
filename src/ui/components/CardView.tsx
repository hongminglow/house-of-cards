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

type PipPosition = {
  x: number;
  y: number;
  inverted?: boolean;
  scale?: number;
};

const pipLayouts: Partial<Record<Card["rank"], PipPosition[]>> = {
  A: [{ x: 50, y: 50, scale: 1.9 }],
  "2": [
    { x: 50, y: 24 },
    { x: 50, y: 76, inverted: true }
  ],
  "3": [
    { x: 50, y: 22 },
    { x: 50, y: 50 },
    { x: 50, y: 78, inverted: true }
  ],
  "4": [
    { x: 34, y: 24 },
    { x: 66, y: 24 },
    { x: 34, y: 76, inverted: true },
    { x: 66, y: 76, inverted: true }
  ],
  "5": [
    { x: 34, y: 24 },
    { x: 66, y: 24 },
    { x: 50, y: 50 },
    { x: 34, y: 76, inverted: true },
    { x: 66, y: 76, inverted: true }
  ],
  "6": [
    { x: 34, y: 20 },
    { x: 66, y: 20 },
    { x: 34, y: 50 },
    { x: 66, y: 50 },
    { x: 34, y: 80, inverted: true },
    { x: 66, y: 80, inverted: true }
  ],
  "7": [
    { x: 34, y: 18 },
    { x: 66, y: 18 },
    { x: 50, y: 36 },
    { x: 34, y: 50 },
    { x: 66, y: 50 },
    { x: 34, y: 82, inverted: true },
    { x: 66, y: 82, inverted: true }
  ],
  "8": [
    { x: 34, y: 18 },
    { x: 66, y: 18 },
    { x: 50, y: 36 },
    { x: 34, y: 50 },
    { x: 66, y: 50 },
    { x: 50, y: 64, inverted: true },
    { x: 34, y: 82, inverted: true },
    { x: 66, y: 82, inverted: true }
  ],
  "9": [
    { x: 34, y: 16 },
    { x: 66, y: 16 },
    { x: 34, y: 36 },
    { x: 66, y: 36 },
    { x: 50, y: 50 },
    { x: 34, y: 64, inverted: true },
    { x: 66, y: 64, inverted: true },
    { x: 34, y: 84, inverted: true },
    { x: 66, y: 84, inverted: true }
  ],
  T: [
    { x: 34, y: 14 },
    { x: 66, y: 14 },
    { x: 34, y: 32 },
    { x: 66, y: 32 },
    { x: 34, y: 50 },
    { x: 66, y: 50 },
    { x: 34, y: 68, inverted: true },
    { x: 66, y: 68, inverted: true },
    { x: 34, y: 86, inverted: true },
    { x: 66, y: 86, inverted: true }
  ]
};

export function CardView({ card }: { card: Card }) {
  const red = card.suit === "hearts" || card.suit === "diamonds";
  const label = rankLabels[card.rank];

  return (
    <div className={red ? "card-view red" : "card-view"} aria-label={`${label} of ${card.suit}`}>
      <CardCorner rank={label} suit={card.suit} />
      <div className={isCourtRank(card.rank) ? "card-center face" : "card-center"}>
        {isCourtRank(card.rank) ? (
          <FaceCard rank={card.rank} suit={card.suit} />
        ) : (
          <PipLayout rank={card.rank} suit={card.suit} />
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

function isCourtRank(rank: Card["rank"]): rank is "J" | "Q" | "K" {
  return rank === "J" || rank === "Q" || rank === "K";
}

function PipLayout({ rank, suit }: { rank: Card["rank"]; suit: Suit }) {
  const pips = pipLayouts[rank] ?? pipLayouts.A ?? [];

  return (
    <div className={rank === "A" ? "pip-layout ace-layout" : "pip-layout"}>
      {pips.map((pip, index) => (
        <span
          className={pip.inverted ? "pip-position inverted" : "pip-position"}
          key={`${rank}-${index}`}
          style={{
            left: `${pip.x}%`,
            top: `${pip.y}%`,
            transform: `translate(-50%, -50%) rotate(${pip.inverted ? 180 : 0}deg) scale(${pip.scale ?? 1})`
          }}
        >
          <SuitMark suit={suit} />
        </span>
      ))}
    </div>
  );
}

function FaceCard({ rank, suit }: { rank: "J" | "Q" | "K"; suit: Suit }) {
  const crownPoints = rank === "K" ? 5 : rank === "Q" ? 4 : 3;

  return (
    <div className={`face-card court-${rank.toLowerCase()}`}>
      <div className="court-half court-top">
        <div className="court-crown">
          {Array.from({ length: crownPoints }, (_, index) => (
            <span key={index} />
          ))}
        </div>
        <div className="court-face" />
        <div className="court-robe">
          <SuitMark suit={suit} />
        </div>
      </div>
      <div className="court-band">
        <SuitMark suit={suit} />
      </div>
      <div className="court-half court-bottom">
        <div className="court-crown">
          {Array.from({ length: crownPoints }, (_, index) => (
            <span key={index} />
          ))}
        </div>
        <div className="court-face" />
        <div className="court-robe">
          <SuitMark suit={suit} />
        </div>
      </div>
      <strong>{rank}</strong>
    </div>
  );
}

function SuitMark({ suit, className = "" }: { suit: Suit; className?: string }) {
  const markClassName = className ? `suit-mark ${className}` : "suit-mark";

  if (suit === "hearts") {
    return (
      <svg className={markClassName} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.6C7.8 16.6 4 13.2 4 8.9 4 6.3 5.8 4.5 8.2 4.5c1.5 0 2.9.8 3.8 2.1.9-1.3 2.3-2.1 3.8-2.1 2.4 0 4.2 1.8 4.2 4.4 0 4.3-3.8 7.7-8 11.7Z" />
      </svg>
    );
  }

  if (suit === "diamonds") {
    return (
      <svg className={markClassName} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.8 20.2 12 12 21.2 3.8 12 12 2.8Z" />
      </svg>
    );
  }

  if (suit === "clubs") {
    return (
      <svg className={markClassName} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9.4 10.5a4.1 4.1 0 1 1 5.2 0 4.4 4.4 0 1 1-2.6 7.5 4.4 4.4 0 1 1-2.6-7.5Z" />
        <path d="M12 14.6c.4 2.2.9 4 2.4 5.9H9.6c1.5-1.9 2-3.7 2.4-5.9Z" />
      </svg>
    );
  }

  return (
    <svg className={markClassName} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.4c4.2 4 8 7.4 8 11.7 0 2.6-1.8 4.4-4.2 4.4-1.5 0-2.9-.8-3.8-2.1-.9 1.3-2.3 2.1-3.8 2.1-2.4 0-4.2-1.8-4.2-4.4 0-4.3 3.8-7.7 8-11.7Z" />
      <path d="M12 14.2c.4 2.2.9 4.2 2.5 6.3h-5c1.6-2.1 2.1-4.1 2.5-6.3Z" />
    </svg>
  );
}
