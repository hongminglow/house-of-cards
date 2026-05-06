import { useEffect, useMemo, useState } from "react";
import { TURN_ACTION_MS, type LegalAction, type PokerActionPayload } from "../../../shared/types";

type Props = {
  legalActions: LegalAction[];
  actionDeadlineAt?: number | null;
  currentTurnName?: string;
  isLocalTurn?: boolean;
  onAction: (action: PokerActionPayload) => void;
};

export function ActionBar({ legalActions, actionDeadlineAt, currentTurnName, isLocalTurn = false, onAction }: Props) {
  const [amount, setAmount] = useState(1000);
  const [now, setNow] = useState(Date.now());
  const byType = useMemo(() => new Map(legalActions.map((action) => [action.type, action])), [legalActions]);
  const wager = byType.get("bet") ?? byType.get("raise") ?? byType.get("all-in");
  const min = wager?.minAmount ?? 0;
  const max = wager?.maxAmount ?? 0;
  const remainingMs = actionDeadlineAt ? Math.max(0, actionDeadlineAt - now) : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const timerProgress = actionDeadlineAt ? Math.max(0, Math.min(1, remainingMs / TURN_ACTION_MS)) : 0;
  const timerLabel = isLocalTurn ? "Your turn" : currentTurnName ? `${currentTurnName}'s turn` : "Waiting for action";
  const timerClassName = [
    "turn-timer",
    isLocalTurn ? "active" : "",
    remainingMs > 0 && remainingMs <= 5_000 ? "urgent" : "",
    !actionDeadlineAt ? "idle" : ""
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    if (!actionDeadlineAt) return undefined;

    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [actionDeadlineAt]);

  return (
    <div className="action-bar">
      <div className={timerClassName} role="timer" aria-live={isLocalTurn ? "polite" : "off"}>
        <div className="turn-timer-copy">
          <span>{actionDeadlineAt ? timerLabel : "Waiting for next turn"}</span>
          <strong>{actionDeadlineAt ? `${remainingSeconds}s` : "--"}</strong>
        </div>
        <div className="turn-timer-track" aria-hidden="true">
          <span style={{ transform: `scaleX(${timerProgress})` }} />
        </div>
      </div>
      <div className="wager-row">
        <span>Wager</span>
        <input
          type="range"
          min={min}
          max={Math.max(min, max)}
          step="500"
          value={Math.min(Math.max(amount, min), Math.max(min, max))}
          disabled={!wager || max <= 0}
          onChange={(event) => setAmount(Number(event.target.value))}
        />
        <strong>{Math.min(Math.max(amount, min), Math.max(min, max)).toLocaleString()}</strong>
      </div>
      <div className="action-grid">
        <button disabled={!byType.has("fold")} onClick={() => onAction({ type: "fold" })}>
          Fold
        </button>
        <button disabled={!byType.has("check")} onClick={() => onAction({ type: "check" })}>
          Check
        </button>
        <button disabled={!byType.has("call")} onClick={() => onAction({ type: "call" })}>
          {byType.get("call")?.callAmount ? `Call ${byType.get("call")?.callAmount?.toLocaleString()}` : "Call"}
        </button>
        <button disabled={!byType.has("bet")} onClick={() => onAction({ type: "bet", amount })}>
          Bet
        </button>
        <button disabled={!byType.has("raise")} onClick={() => onAction({ type: "raise", amount })}>
          Raise
        </button>
        <button className="all-in" disabled={!byType.has("all-in")} onClick={() => onAction({ type: "all-in" })}>
          All in
        </button>
      </div>
    </div>
  );
}
