import type { Stats } from "@/lib/queries";
import { signedMoney } from "@/lib/format";

function cls(n: number | null | undefined): string {
  if (n == null) return "";
  return n > 0 ? "pos" : n < 0 ? "neg" : "";
}

export default function StatsStrip({ s }: { s: Stats }) {
  return (
    <div className="stats">
      <div className="stat">
        <div className="label">Net P&amp;L</div>
        <div className={"value " + cls(s.net)}>{signedMoney(s.net)}</div>
      </div>
      <div className="stat">
        <div className="label">Win rate</div>
        <div className="value">
          {s.winRate == null ? "—" : `${s.winRate.toFixed(0)}%`}
        </div>
      </div>
      <div className="stat">
        <div className="label">Closed</div>
        <div className="value">
          {s.count}
          <span style={{ fontSize: 12, fontWeight: 400 }} className="muted">
            {" "}
            · {s.openCount} open
          </span>
        </div>
      </div>
      <div className="stat">
        <div className="label">Avg R</div>
        <div className={"value " + cls(s.avgR)}>
          {s.avgR == null
            ? "—"
            : `${s.avgR >= 0 ? "+" : ""}${s.avgR.toFixed(2)}R`}
        </div>
      </div>
      <div className="stat">
        <div className="label">Profit factor</div>
        <div className="value">
          {s.profitFactor == null ? "—" : s.profitFactor.toFixed(2)}
        </div>
      </div>
      <div className="stat">
        <div className="label">Expectancy</div>
        <div className={"value " + cls(s.expectancy)}>
          {s.expectancy == null ? "—" : signedMoney(s.expectancy)}
        </div>
      </div>
    </div>
  );
}
