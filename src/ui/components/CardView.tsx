import { useState } from "react";
import type { Card, Rank, Suit } from "../../../shared/types";

const rankLabels: Record<Rank, string> = {
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
  size?: number;
};

const pipLayouts: Partial<Record<Rank, PipPosition[]>> = {
  A: [{ x: 60, y: 84, size: 34 }],
  "2": [
    { x: 60, y: 48 },
    { x: 60, y: 120, inverted: true }
  ],
  "3": [
    { x: 60, y: 44 },
    { x: 60, y: 84 },
    { x: 60, y: 124, inverted: true }
  ],
  "4": [
    { x: 42, y: 46 },
    { x: 78, y: 46 },
    { x: 42, y: 122, inverted: true },
    { x: 78, y: 122, inverted: true }
  ],
  "5": [
    { x: 42, y: 46 },
    { x: 78, y: 46 },
    { x: 60, y: 84 },
    { x: 42, y: 122, inverted: true },
    { x: 78, y: 122, inverted: true }
  ],
  "6": [
    { x: 42, y: 42 },
    { x: 78, y: 42 },
    { x: 42, y: 84 },
    { x: 78, y: 84 },
    { x: 42, y: 126, inverted: true },
    { x: 78, y: 126, inverted: true }
  ],
  "7": [
    { x: 42, y: 38 },
    { x: 78, y: 38 },
    { x: 60, y: 60 },
    { x: 42, y: 84 },
    { x: 78, y: 84 },
    { x: 42, y: 128, inverted: true },
    { x: 78, y: 128, inverted: true }
  ],
  "8": [
    { x: 42, y: 38 },
    { x: 78, y: 38 },
    { x: 60, y: 60 },
    { x: 42, y: 84 },
    { x: 78, y: 84 },
    { x: 60, y: 108, inverted: true },
    { x: 42, y: 128, inverted: true },
    { x: 78, y: 128, inverted: true }
  ],
  "9": [
    { x: 42, y: 34 },
    { x: 78, y: 34 },
    { x: 42, y: 58 },
    { x: 78, y: 58 },
    { x: 60, y: 84 },
    { x: 42, y: 110, inverted: true },
    { x: 78, y: 110, inverted: true },
    { x: 42, y: 134, inverted: true },
    { x: 78, y: 134, inverted: true }
  ],
  T: [
    { x: 42, y: 34 },
    { x: 78, y: 34 },
    { x: 42, y: 58 },
    { x: 78, y: 58 },
    { x: 60, y: 72 },
    { x: 60, y: 96, inverted: true },
    { x: 42, y: 110, inverted: true },
    { x: 78, y: 110, inverted: true },
    { x: 42, y: 134, inverted: true },
    { x: 78, y: 134, inverted: true }
  ]
};

export function CardView({ card }: { card: Card }) {
  const red = card.suit === "hearts" || card.suit === "diamonds";
  const label = rankLabels[card.rank];
  const [courtImageFailed, setCourtImageFailed] = useState(false);

  if (isCourtRank(card.rank) && !courtImageFailed) {
    return (
      <div className={red ? "card-view court-image-card red" : "card-view court-image-card"} aria-label={`${label} of ${card.suit}`}>
        <img
          alt=""
          className="court-card-image"
          decoding="async"
          draggable={false}
          onError={() => setCourtImageFailed(true)}
          referrerPolicy="no-referrer"
          src={courtCardUrl(card.rank, card.suit)}
        />
      </div>
    );
  }

  return (
    <div className={red ? "card-view red" : "card-view"} aria-label={`${label} of ${card.suit}`}>
      <svg className="playing-card-svg" viewBox="0 0 120 168" aria-hidden="true">
        <rect className="card-paper" x="2" y="2" width="116" height="164" rx="10" />
        <rect className="card-inner-line" x="6.5" y="6.5" width="107" height="155" rx="7.5" />
        <CardIndex rank={label} suit={card.suit} />
        {isCourtRank(card.rank) ? <CourtFace rank={card.rank} suit={card.suit} /> : <PipFace rank={card.rank} suit={card.suit} />}
        <CardIndex rank={label} suit={card.suit} bottom />
      </svg>
    </div>
  );
}

function courtCardUrl(rank: "J" | "Q" | "K", suit: Suit) {
  const rankName = rank === "J" ? "jack" : rank === "Q" ? "queen" : "king";
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/English_pattern_${rankName}_of_${suit}.svg`;
}

function PipFace({ rank, suit }: { rank: Rank; suit: Suit }) {
  const pips = pipLayouts[rank] ?? pipLayouts.A ?? [];

  return (
    <g className="card-pips">
      {pips.map((pip, index) => (
        <SuitPip
          inverted={pip.inverted}
          key={`${rank}-${suit}-${index}`}
          size={pip.size ?? 18}
          suit={suit}
          x={pip.x}
          y={pip.y}
        />
      ))}
    </g>
  );
}

function CourtFace({ rank, suit }: { rank: "J" | "Q" | "K"; suit: Suit }) {
  const accent = suit === "hearts" || suit === "diamonds" ? "#b51f2c" : "#111816";
  const secondary = suit === "spades" || suit === "clubs" ? "#2f5f99" : "#bf3342";
  const crown = rank === "K" ? "M 42 52 L 50 40 L 60 53 L 70 40 L 78 52 L 76 62 L 44 62 Z" : "M 43 53 L 50 43 L 60 54 L 70 43 L 77 53 L 73 62 L 47 62 Z";

  return (
    <g className="court-face">
      <rect className="court-frame" x="27" y="30" width="66" height="108" rx="7" />
      <path className="court-rail" d="M31 84H89" />
      <g>
        <path className="court-cloak" d="M36 128C41 103 47 82 60 72c13 10 19 31 24 56Z" fill={secondary} />
        <path className="court-cloak-trim" d="M45 128c3-19 8-35 15-45 7 10 12 26 15 45" />
        <path className="court-crown" d={crown} fill="#d7a33d" />
        <ellipse className="court-face-skin" cx="60" cy="66" rx="13" ry="16" />
        <path className="court-hair" d="M47 63c1-15 25-15 26 0-4-6-22-6-26 0Z" fill={accent} />
        <path className="court-line" d="M52 67h4M64 67h4M55 76c3 2 7 2 10 0" />
        <SuitPip size={17} suit={suit} x={60} y={103} />
      </g>
      <g transform="translate(120 168) rotate(180)">
        <path className="court-cloak" d="M36 128C41 103 47 82 60 72c13 10 19 31 24 56Z" fill={secondary} />
        <path className="court-cloak-trim" d="M45 128c3-19 8-35 15-45 7 10 12 26 15 45" />
        <path className="court-crown" d={crown} fill="#d7a33d" />
        <ellipse className="court-face-skin" cx="60" cy="66" rx="13" ry="16" />
        <path className="court-hair" d="M47 63c1-15 25-15 26 0-4-6-22-6-26 0Z" fill={accent} />
        <path className="court-line" d="M52 67h4M64 67h4M55 76c3 2 7 2 10 0" />
        <SuitPip size={17} suit={suit} x={60} y={103} />
      </g>
      <text className="court-rank-mark" x="60" y="89" textAnchor="middle">
        {rank}
      </text>
    </g>
  );
}

function CardIndex({ rank, suit, bottom = false }: { rank: string; suit: Suit; bottom?: boolean }) {
  const transform = bottom ? "translate(104 148) rotate(180)" : "translate(16 20)";

  return (
    <g className="card-index" transform={transform}>
      <text className="card-index-rank" x="0" y="0" textAnchor="middle">
        {rank}
      </text>
      <SuitPip size={10} suit={suit} x={0} y={13} />
    </g>
  );
}

function SuitPip({
  suit,
  x,
  y,
  size,
  inverted = false
}: {
  suit: Suit;
  x: number;
  y: number;
  size: number;
  inverted?: boolean;
}) {
  const scale = size / 24;
  const transform = `translate(${x} ${y}) rotate(${inverted ? 180 : 0}) scale(${scale}) translate(-12 -12)`;

  if (suit === "hearts") {
    return (
      <g className="suit-pip" transform={transform}>
        <path d="M12 20.6C7.8 16.6 4 13.2 4 8.9 4 6.3 5.8 4.5 8.2 4.5c1.5 0 2.9.8 3.8 2.1.9-1.3 2.3-2.1 3.8-2.1 2.4 0 4.2 1.8 4.2 4.4 0 4.3-3.8 7.7-8 11.7Z" />
      </g>
    );
  }

  if (suit === "diamonds") {
    return (
      <g className="suit-pip" transform={transform}>
        <path d="M12 2.8 20.2 12 12 21.2 3.8 12 12 2.8Z" />
      </g>
    );
  }

  if (suit === "clubs") {
    return (
      <g className="suit-pip" transform={transform}>
        <path d="M9.4 10.5a4.1 4.1 0 1 1 5.2 0 4.4 4.4 0 1 1-2.6 7.5 4.4 4.4 0 1 1-2.6-7.5Z" />
        <path d="M12 14.6c.4 2.2.9 4 2.4 5.9H9.6c1.5-1.9 2-3.7 2.4-5.9Z" />
      </g>
    );
  }

  return (
    <g className="suit-pip" transform={transform}>
      <path d="M12 3.4c4.2 4 8 7.4 8 11.7 0 2.6-1.8 4.4-4.2 4.4-1.5 0-2.9-.8-3.8-2.1-.9 1.3-2.3 2.1-3.8 2.1-2.4 0-4.2-1.8-4.2-4.4 0-4.3 3.8-7.7 8-11.7Z" />
      <path d="M12 14.2c.4 2.2.9 4.2 2.5 6.3h-5c1.6-2.1 2.1-4.1 2.5-6.3Z" />
    </g>
  );
}

function isCourtRank(rank: Rank): rank is "J" | "Q" | "K" {
  return rank === "J" || rank === "Q" || rank === "K";
}
