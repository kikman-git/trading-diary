"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTrade, updateTrade } from "@/app/actions";
import type { Trade } from "@/db/schema";
import {
  COMMON_EXCHANGES,
  DEFAULT_MULTIPLIERS,
  INSTRUMENTS,
  type Direction,
  type InstrumentType,
} from "@/lib/constants";
import { toLocalInput } from "@/lib/format";
import ReviewFields from "./ReviewFields";
import ScreenshotDropzone, { type PreviewFile } from "./ScreenshotDropzone";

export type EditableTrade = Trade & { tags: string[]; mistakes: string[] };

/** Create form by default; pass `trade` to switch to full-edit mode. */
export default function TradeForm({
  setups,
  allTags,
  allMistakes,
  trade,
}: {
  setups: string[];
  allTags: string[];
  allMistakes: string[];
  trade?: EditableTrade;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<"open" | "closed">(
    trade?.status ?? "open",
  );
  const [instrument, setInstrument] = useState<InstrumentType>(
    trade?.instrumentType ?? "stock",
  );
  const [direction, setDirection] = useState<Direction>(
    trade?.direction ?? "long",
  );
  const [multiplier, setMultiplier] = useState<number>(
    trade?.multiplier ?? DEFAULT_MULTIPLIERS.stock,
  );
  const [tags, setTags] = useState(trade?.tags.join(", ") ?? "");
  const [files, setFiles] = useState<PreviewFile[]>([]);

  const showExit = status === "closed";
  const isOption = instrument === "option";
  const showExpiry = instrument === "option" || instrument === "future";
  const reverting = trade?.status === "closed" && status === "open";

  function addFiles(list: File[]) {
    setFiles((prev) => [
      ...prev,
      ...list.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
  }
  function removeFile(i: number) {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, idx) => idx !== i);
    });
  }
  function addTag(t: string) {
    const cur = tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!cur.includes(t)) setTags([...cur, t].join(", "));
  }

  function onInstrument(v: InstrumentType) {
    setInstrument(v);
    setMultiplier(DEFAULT_MULTIPLIERS[v]);
  }

  function submit() {
    if (!formRef.current) return;
    setError(null);
    const fd = new FormData(formRef.current);
    fd.set("status", status);
    fd.set("direction", direction);
    fd.set("instrumentType", instrument);
    fd.set("multiplier", String(multiplier));
    fd.set("tags", tags);
    if (trade) fd.set("tradeId", String(trade.id));
    files.forEach((f) => fd.append("screenshots", f.file));
    start(async () => {
      const res = trade ? await updateTrade(fd) : await createTrade(fd);
      if (res.ok) router.push(`/trades/${res.id}`);
      else setError(res.error);
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {error && <div className="error">{error}</div>}

      <div className="panel">
        <div className="row" style={{ marginBottom: 16 }}>
          <div className="seg">
            <button
              type="button"
              className={status === "open" ? "active" : ""}
              onClick={() => setStatus("open")}
            >
              {trade ? "Open" : "Log Open"}
            </button>
            <button
              type="button"
              className={status === "closed" ? "active" : ""}
              onClick={() => setStatus("closed")}
            >
              {trade ? "Closed" : "Log Closed"}
            </button>
          </div>
          {reverting ? (
            <span className="hint" style={{ color: "var(--amber)" }}>
              Saving as open clears exit price, P&amp;L and review fields.
            </span>
          ) : (
            <span className="hint muted">
              {status === "open"
                ? "Capture the live thesis now; close it later."
                : "Fill entry + exit; P&L is computed on save."}
            </span>
          )}
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Instrument</label>
            <select
              name="instrumentType"
              value={instrument}
              onChange={(e) => onInstrument(e.target.value as InstrumentType)}
            >
              {INSTRUMENTS.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Direction</label>
            <div className="seg">
              <button
                type="button"
                className={direction === "long" ? "active long" : ""}
                onClick={() => setDirection("long")}
              >
                Long
              </button>
              <button
                type="button"
                className={direction === "short" ? "active short" : ""}
                onClick={() => setDirection("short")}
              >
                Short
              </button>
            </div>
          </div>

          <div className="field">
            <label>Symbol *</label>
            <input
              name="symbol"
              placeholder="7203, NK225M…"
              autoComplete="off"
              autoCapitalize="characters"
              defaultValue={trade?.symbol}
              required
            />
          </div>
          <div className="field">
            <label>Exchange (for TradingView link)</label>
            <input
              name="exchange"
              placeholder="TSE"
              list="exchanges"
              defaultValue={trade?.exchange ?? undefined}
            />
            <datalist id="exchanges">
              {COMMON_EXCHANGES.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </div>

          <div className="field">
            <label>Quantity * {instrument !== "stock" && "(contracts)"}</label>
            <input
              name="quantity"
              type="number"
              step="any"
              min="0"
              placeholder="100"
              defaultValue={trade?.quantity}
              required
            />
          </div>
          <div className="field">
            <label>Multiplier</label>
            <input
              name="multiplier"
              type="number"
              step="any"
              value={multiplier}
              onChange={(e) => setMultiplier(Number(e.target.value))}
            />
            <span className="hint">
              stock 1 · Nikkei fut: large 1000 / mini 100 / micro 10 · Nikkei
              opt: 1000 (mini 100)
            </span>
          </div>

          <div className="field">
            <label>Entry price *</label>
            <input
              name="entryPrice"
              type="number"
              step="any"
              placeholder="0.00"
              defaultValue={trade?.entryPrice}
              required
            />
          </div>
          <div className="field">
            <label>Fees</label>
            <input
              name="fees"
              type="number"
              step="any"
              placeholder="0.00"
              defaultValue={trade?.fees}
            />
            <span className="hint">Commissions — matters on options/futures.</span>
          </div>

          {showExit && (
            <>
              <div className="field">
                <label>Exit price *</label>
                <input
                  name="exitPrice"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  defaultValue={trade?.exitPrice ?? undefined}
                />
              </div>
              <div className="field">
                <label>Exit time</label>
                <input
                  name="exitAt"
                  type="datetime-local"
                  defaultValue={
                    trade?.exitAt
                      ? toLocalInput(trade.exitAt)
                      : toLocalInput(new Date())
                  }
                />
              </div>
            </>
          )}

          <div className="field">
            <label>Stop (enables R-multiple)</label>
            <input
              name="stopPrice"
              type="number"
              step="any"
              placeholder="0.00"
              defaultValue={trade?.stopPrice ?? undefined}
            />
          </div>
          <div className="field">
            <label>Target</label>
            <input
              name="targetPrice"
              type="number"
              step="any"
              placeholder="0.00"
              defaultValue={trade?.targetPrice ?? undefined}
            />
          </div>

          {isOption && (
            <>
              <div className="field">
                <label>Strike</label>
                <input
                  name="strike"
                  type="number"
                  step="any"
                  defaultValue={trade?.strike ?? undefined}
                />
              </div>
              <div className="field">
                <label>Right</label>
                <select name="right" defaultValue={trade?.right ?? ""}>
                  <option value="">—</option>
                  <option value="call">Call</option>
                  <option value="put">Put</option>
                </select>
              </div>
            </>
          )}
          {showExpiry && (
            <div className="field">
              <label>Expiry</label>
              <input
                name="expiry"
                type="date"
                defaultValue={trade?.expiry ?? undefined}
              />
            </div>
          )}

          <div className="field">
            <label>Entry time</label>
            <input
              name="entryAt"
              type="datetime-local"
              defaultValue={toLocalInput(trade?.entryAt ?? new Date())}
            />
          </div>
          <div className="field">
            <label>Setup</label>
            <input
              name="setup"
              list="setups"
              placeholder="breakout, pullback…"
              autoComplete="off"
              defaultValue={trade?.setup ?? undefined}
            />
            <datalist id="setups">
              {setups.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div className="field full">
            <label>Tags</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="FOMO, broke-rules, earnings (comma separated)"
              autoComplete="off"
            />
            {allTags.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {allTags.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className="tag"
                    style={{ cursor: "pointer" }}
                    onClick={() => addTag(t)}
                  >
                    + {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="field full">
            <label>Notes — what were you thinking? (markdown)</label>
            <textarea
              name="notes"
              placeholder="Thesis, plan, how you felt, what you saw…"
              defaultValue={trade?.notes}
            />
          </div>

          {showExit && (
            <ReviewFields
              allMistakes={allMistakes}
              defaultGrade={trade?.grade}
              defaultLesson={trade?.lesson}
              initialMistakes={trade?.mistakes}
            />
          )}

          <ScreenshotDropzone
            files={files}
            onAdd={addFiles}
            onRemove={removeFile}
            label={trade ? "Add screenshots" : "Screenshots"}
          />
        </div>

        <div className="form-actions">
          <button className="btn primary" type="submit" disabled={pending}>
            {pending
              ? "Saving…"
              : trade
                ? "Save Changes"
                : status === "open"
                  ? "Save Open Trade"
                  : "Save Trade"}
          </button>
          <a className="btn ghost" href={trade ? `/trades/${trade.id}` : "/"}>
            Cancel
          </a>
        </div>
      </div>
    </form>
  );
}
