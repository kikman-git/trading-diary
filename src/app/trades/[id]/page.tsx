import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { getAllMistakes, getTradeById } from "@/lib/queries";
import { tradingViewUrl } from "@/lib/tv";
import { GRADES } from "@/lib/constants";
import { initialRisk, pnlPct } from "@/lib/pnl";
import { dt, money, num, pct, rmult, signedMoney } from "@/lib/format";
import CloseForm from "@/components/CloseForm";
import ScreenshotGallery from "@/components/ScreenshotGallery";
import DeleteTradeButton from "@/components/DeleteTradeButton";

export const dynamic = "force-dynamic";

function cls(n: number | null | undefined) {
  return n == null ? "" : n >= 0 ? "pos" : "neg";
}

function KV({
  k,
  v,
  className,
}: {
  k: string;
  v: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="kv">
      <div className="k">{k}</div>
      <div className={"v " + (className ?? "")}>{v}</div>
    </div>
  );
}

export default async function TradeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tid = Number(id);
  const t = Number.isFinite(tid) ? await getTradeById(tid) : null;
  if (!t) notFound();

  const allMistakes = t.status === "open" ? await getAllMistakes() : [];
  const gradeInfo = t.grade ? GRADES.find((g) => g.value === t.grade) : null;
  const ret = pnlPct({
    direction: t.direction,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
  });
  const risk = initialRisk({
    entryPrice: t.entryPrice,
    stopPrice: t.stopPrice,
    quantity: t.quantity,
    multiplier: t.multiplier,
  });
  const notesHtml = t.notes ? await marked.parse(t.notes) : "";

  return (
    <>
      <div className="page-head">
        <div className="row">
          <h1 style={{ margin: 0 }}>{t.symbol}</h1>
          <span className={"badge " + t.direction}>{t.direction}</span>
          {t.instrumentType !== "stock" && (
            <span className="badge it">
              {t.instrumentType}
              {t.right ? ` ${t.right}` : ""}
            </span>
          )}
          <span className={"badge " + t.status}>{t.status}</span>
        </div>
        <div className="row">
          <a
            className="btn sm ghost"
            href={tradingViewUrl(t.symbol, t.exchange)}
            target="_blank"
            rel="noreferrer"
          >
            Open in TradingView ↗
          </a>
          <Link className="btn sm ghost" href={`/trades/${t.id}/edit`}>
            Edit
          </Link>
          <DeleteTradeButton tradeId={t.id} />
        </div>
      </div>

      <div className="panel">
        <div className="detail-grid">
          <KV
            k="P&L"
            v={t.pnl == null ? "—" : signedMoney(t.pnl)}
            className={cls(t.pnl)}
          />
          <KV
            k="Return"
            v={ret == null ? "—" : pct(ret)}
            className={cls(ret)}
          />
          <KV
            k="R-multiple"
            v={rmult(t.rMultiple)}
            className={cls(t.rMultiple)}
          />
          <KV
            k="Quantity"
            v={`${num(t.quantity)}${t.instrumentType !== "stock" ? " ctr" : ""}`}
          />
          <KV k="Entry" v={money(t.entryPrice)} />
          <KV k="Exit" v={t.exitPrice == null ? "—" : money(t.exitPrice)} />
          <KV k="Stop" v={t.stopPrice == null ? "—" : money(t.stopPrice)} />
          <KV k="Target" v={t.targetPrice == null ? "—" : money(t.targetPrice)} />
          <KV k="Initial risk" v={risk == null ? "—" : money(risk)} />
          <KV k="Fees" v={money(t.fees)} />
          <KV k="Multiplier" v={num(t.multiplier)} />
          <KV k="Setup" v={t.setup ?? "—"} />
          {t.strike != null && <KV k="Strike" v={num(t.strike)} />}
          {t.expiry && <KV k="Expiry" v={t.expiry} />}
          <KV k="Entry time" v={dt(t.entryAt)} />
          <KV k="Exit time" v={t.exitAt ? dt(t.exitAt) : "—"} />
        </div>
        {t.tags.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {t.tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {t.status === "closed" && (
        <div className="panel">
          <p className="panel-title">Review</p>
          {t.grade || t.lesson || t.mistakes.length > 0 ? (
            <>
              <div className="detail-grid">
                <KV
                  k="Execution grade"
                  v={
                    gradeInfo ? (
                      <span className={`grade-pill grade-${gradeInfo.value}`}>
                        {gradeInfo.label}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                <KV
                  k="Mistakes"
                  v={
                    t.mistakes.length ? (
                      <span>
                        {t.mistakes.map((m) => (
                          <span className="tag mistake" key={m}>
                            {m}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="pos">clean — none logged</span>
                    )
                  }
                />
              </div>
              {t.lesson && <p className="lesson">{t.lesson}</p>}
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Not reviewed yet —{" "}
              <Link href={`/trades/${t.id}/edit`}>grade this trade →</Link>
            </p>
          )}
        </div>
      )}

      {t.status === "open" && (
        <div className="panel">
          <CloseForm
            tradeId={t.id}
            defaultFees={t.fees}
            allMistakes={allMistakes}
          />
        </div>
      )}

      <div className="panel">
        <p className="panel-title">Screenshots</p>
        <ScreenshotGallery
          tradeId={t.id}
          shots={t.screenshots.map((s) => ({
            id: s.id,
            filePath: s.filePath,
            thumbPath: s.thumbPath,
          }))}
        />
      </div>

      <div className="panel">
        <p className="panel-title">Notes</p>
        {notesHtml ? (
          <div
            className="notes"
            dangerouslySetInnerHTML={{ __html: notesHtml }}
          />
        ) : (
          <span className="muted">No notes.</span>
        )}
      </div>

      <p>
        <Link href="/">← Back to dashboard</Link>
      </p>
    </>
  );
}
