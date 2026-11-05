import Link from "next/link";
import { Suspense } from "react";
import StatsStrip from "@/components/StatsStrip";
import Filters from "@/components/Filters";
import {
  getAllMistakes,
  getAllTags,
  getDistinctSetups,
  getStats,
  getTrades,
  type TradeFilters,
} from "@/lib/queries";
import { dateOnly, num, rmult, signedMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

function parseFilters(sp: SP): TradeFilters {
  const s = (k: string) => {
    const v = sp[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const status = s("status");
  const grade = s("grade");
  const from = s("from");
  const to = s("to");
  return {
    status: status === "open" || status === "closed" ? status : undefined,
    symbol: s("symbol"),
    setup: s("setup"),
    tag: s("tag"),
    mistake: s("mistake"),
    grade:
      grade && ["a", "b", "c", "d", "f"].includes(grade) ? grade : undefined,
    q: s("q"),
    from: from ? new Date(from) : undefined,
    to: to ? new Date(`${to}T23:59:59`) : undefined,
  };
}

function pnlCls(n: number | null | undefined) {
  return n == null ? "" : n >= 0 ? "pos" : "neg";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [stats, rows, setups, tags, mistakes] = await Promise.all([
    getStats(filters),
    getTrades(filters),
    getDistinctSetups(),
    getAllTags(),
    getAllMistakes(),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <div className="row">
          <a className="btn sm ghost" href="/api/export">
            Export CSV
          </a>
          <Link className="btn sm primary" href="/new">
            + New Trade
          </Link>
        </div>
      </div>

      <StatsStrip s={stats} />

      <div className="panel">
        <Suspense fallback={<div className="muted">Loading filters…</div>}>
          <Filters setups={setups} tags={tags} mistakes={mistakes} />
        </Suspense>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          No trades match.{" "}
          <Link href="/new">Log your first trade →</Link>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th className="hide-sm"></th>
                <th className="hide-sm">Date</th>
                <th>Symbol</th>
                <th className="hide-sm">Setup</th>
                <th className="num">Qty</th>
                <th className="num">Entry</th>
                <th className="num">Exit</th>
                <th className="num">P&amp;L</th>
                <th className="num">R</th>
                <th className="hide-sm">Grade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="hide-sm">
                    {t.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="list-thumb"
                        src={`/api/img/${t.thumb}`}
                        alt=""
                      />
                    ) : null}
                  </td>
                  <td className="muted hide-sm">{dateOnly(t.entryAt)}</td>
                  <td>
                    <Link href={`/trades/${t.id}`} className="sym">
                      {t.symbol}
                    </Link>{" "}
                    <span className={"badge " + t.direction}>
                      {t.direction}
                    </span>
                    {t.instrumentType !== "stock" && (
                      <span className="badge it" style={{ marginLeft: 4 }}>
                        {t.instrumentType}
                      </span>
                    )}
                    {(t.tags.length > 0 || t.mistakes.length > 0) && (
                      <div style={{ marginTop: 4 }}>
                        {t.tags.map((tag) => (
                          <span className="tag" key={tag}>
                            {tag}
                          </span>
                        ))}
                        {t.mistakes.map((m) => (
                          <span className="tag mistake" key={`m-${m}`}>
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="muted hide-sm">{t.setup ?? "—"}</td>
                  <td className="num">{num(t.quantity)}</td>
                  <td className="num">{num(t.entryPrice)}</td>
                  <td className="num">
                    {t.exitPrice == null ? "—" : num(t.exitPrice)}
                  </td>
                  <td className={"num " + pnlCls(t.pnl)}>
                    {t.pnl == null ? "—" : signedMoney(t.pnl)}
                  </td>
                  <td className={"num " + pnlCls(t.rMultiple)}>
                    {rmult(t.rMultiple)}
                  </td>
                  <td className="hide-sm">
                    {t.grade ? (
                      <span className={"grade-pill grade-" + t.grade}>
                        {t.grade.toUpperCase()}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className={"badge " + t.status}>{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
