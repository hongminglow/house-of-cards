import type { Card } from "../../../shared/types";

const suitGlyph = {
  clubs: "C",
  diamonds: "D",
  hearts: "H",
  spades: "S"
};

export function CardView({ card }: { card: Card }) {
  const red = card.suit === "hearts" || card.suit === "diamonds";
  return (
    <div className={red ? "card-view red" : "card-view"}>
      <strong>{card.rank}</strong>
      <span>{suitGlyph[card.suit]}</span>
    </div>
  );
}
