import { CURRENCY } from "./constants";

export function money(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 2,
  }).format(n);
}

export function signedMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return (n > 0 ? "+" : "") + money(n);
}

export function num(n: number | null | undefined, dp = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: dp });
}

export function pct(n: number | null | undefined, dp = 1): string {
  if (n == null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(dp)}%`;
}

export function rmult(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}R`;
}

export function dt(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function dateOnly(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}

/** For <input type="datetime-local"> value binding (local time, no TZ suffix). */
export function toLocalInput(d: Date): string {
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
