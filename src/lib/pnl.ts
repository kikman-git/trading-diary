import type { Direction } from "./constants";

export function dirSign(direction: Direction): 1 | -1 {
  return direction === "long" ? 1 : -1;
}

/** Net P&L = (exit − entry) × qty × multiplier × direction − fees. */
export function computePnl(p: {
  direction: Direction;
  entryPrice: number;
  exitPrice: number | null | undefined;
  quantity: number;
  multiplier: number;
  fees: number;
}): number | null {
  if (p.exitPrice == null) return null;
  return (
    (p.exitPrice - p.entryPrice) *
      p.quantity *
      p.multiplier *
      dirSign(p.direction) -
    (p.fees || 0)
  );
}

/** Initial risk in account currency from the planned stop. */
export function initialRisk(p: {
  entryPrice: number;
  stopPrice: number | null | undefined;
  quantity: number;
  multiplier: number;
}): number | null {
  if (p.stopPrice == null) return null;
  const risk =
    Math.abs(p.entryPrice - p.stopPrice) * p.quantity * p.multiplier;
  return risk > 0 ? risk : null;
}

export function computeR(
  pnl: number | null,
  risk: number | null,
): number | null {
  if (pnl == null || risk == null || risk === 0) return null;
  return pnl / risk;
}

export function pnlPct(p: {
  direction: Direction;
  entryPrice: number;
  exitPrice: number | null | undefined;
}): number | null {
  if (p.exitPrice == null || p.entryPrice === 0) return null;
  return ((p.exitPrice - p.entryPrice) / p.entryPrice) * dirSign(p.direction) * 100;
}
