import type { Trade } from "@/db/schema";

export type InstrumentType = Trade["instrumentType"];
export type Direction = Trade["direction"];

export const INSTRUMENTS: { value: InstrumentType; label: string }[] = [
  { value: "stock", label: "Stock / ETF" },
  { value: "option", label: "Option" },
  { value: "future", label: "Future" },
];

// Defaults are tuned for the Japanese market (TSE stocks, Nikkei derivatives) —
// always editable per trade. Nikkei 225 futures: large ×1000, mini ×100, micro ×10.
// Nikkei 225 options: standard ×1000, mini ×100.
export const DEFAULT_MULTIPLIERS: Record<InstrumentType, number> = {
  stock: 1,
  option: 1000,
  future: 100, // Nikkei mini — the most common retail contract
};

// Execution grade — how well you followed your plan, INDEPENDENT of the P&L.
// This is the axis that builds skill: a good trade can lose, a bad trade can win.
export const GRADES = [
  { value: "a", label: "A — textbook execution" },
  { value: "b", label: "B — solid, minor slips" },
  { value: "c", label: "C — mediocre" },
  { value: "d", label: "D — sloppy" },
  { value: "f", label: "F — broke my rules" },
] as const;
export type Grade = (typeof GRADES)[number]["value"];
export const GRADE_VALUES = GRADES.map((g) => g.value);

// Starter vocabulary for the mistakes dimension. The list grows from your own use —
// rows are created on first use, exactly like tags. Surfacing recurring mistakes is
// the single highest-leverage review signal.
export const COMMON_MISTAKES = [
  "chased entry",
  "no stop",
  "moved stop",
  "oversized",
  "undersized",
  "revenge trade",
  "fomo entry",
  "exited early",
  "took profit too soon",
  "held too long",
  "no clear setup",
  "averaged down loser",
  "ignored plan",
  "hesitated on entry",
];

// TradingView exchange prefixes. TSE = Tokyo Stock Exchange (e.g. TSE:7203),
// OSE = Osaka Exchange (Nikkei futures/options). US ones kept for occasional trades.
export const COMMON_EXCHANGES = [
  "TSE",
  "OSE",
  "NASDAQ",
  "NYSE",
  "CME_MINI",
  "CBOE",
];

export const CURRENCY = "JPY";

// Cap stored screenshot dimensions to keep the data dir lean.
export const MAX_IMAGE_WIDTH = 1600;
export const THUMB_WIDTH = 360;
