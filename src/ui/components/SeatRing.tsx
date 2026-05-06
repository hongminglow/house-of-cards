import type { RoomPublicState } from "../../../shared/types";

type Props = {
  room: RoomPublicState;
  localUserId: string;
};

const positions = [
  { left: "50%", top: "86%" },
  { left: "16%", top: "68%" },
  { left: "16%", top: "28%" },
  { left: "50%", top: "13%" },
  { left: "84%", top: "28%" },
  { left: "84%", top: "68%" }
];

export function SeatRing({ room, localUserId }: Props) {
  return (
    <div className="seat-ring" aria-label="Seats">
      {room.seats.map((seat) => (
        <div
          className={seat.userId === localUserId ? "seat-pill local" : seat.isFolded ? "seat-pill folded" : "seat-pill"}
          key={seat.userId}
          style={positions[seat.seatIndex]}
        >
          <div className="seat-main">
            <strong>{seat.displayName}</strong>
            <span>{seat.stack.toLocaleString()}</span>
          </div>
          <div className="seat-meta">
            {seat.isDealer ? "D " : ""}
            {seat.isSmallBlind ? "SB " : ""}
            {seat.isBigBlind ? "BB " : ""}
            {seat.currentBet
              ? `Bet ${seat.currentBet.toLocaleString()}`
              : seat.isAllIn
                ? "All in"
                : seat.hasCards
                  ? "In hand"
                  : !seat.isConnected
                    ? "Away"
                    : seat.isReady
                      ? "In game"
                      : "Waiting"}
          </div>
        </div>
      ))}
    </div>
  );
}
