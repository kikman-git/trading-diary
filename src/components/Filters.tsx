"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { GRADES } from "@/lib/constants";

export default function Filters({
  setups,
  tags,
  mistakes,
}: {
  setups: string[];
  tags: string[];
  mistakes: string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string" && v.trim()) params.set(k, v.trim());
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  const g = (k: string) => sp.get(k) ?? "";

  return (
    <form
      ref={formRef}
      className="filters"
      key={sp.toString()}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="field">
        <label>Search</label>
        <input name="q" defaultValue={g("q")} placeholder="notes, symbol…" />
      </div>
      <div className="field">
        <label>Symbol</label>
        <input name="symbol" defaultValue={g("symbol")} placeholder="7203" />
      </div>
      <div className="field">
        <label>Status</label>
        <select name="status" defaultValue={g("status")} onChange={submit}>
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div className="field">
        <label>Setup</label>
        <select name="setup" defaultValue={g("setup")} onChange={submit}>
          <option value="">All</option>
          {setups.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Tag</label>
        <select name="tag" defaultValue={g("tag")} onChange={submit}>
          <option value="">All</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Grade</label>
        <select name="grade" defaultValue={g("grade")} onChange={submit}>
          <option value="">All</option>
          {GRADES.map((gr) => (
            <option key={gr.value} value={gr.value}>
              {gr.value.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Mistake</label>
        <select name="mistake" defaultValue={g("mistake")} onChange={submit}>
          <option value="">All</option>
          {mistakes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>From</label>
        <input type="date" name="from" defaultValue={g("from")} onChange={submit} />
      </div>
      <div className="field">
        <label>To</label>
        <input type="date" name="to" defaultValue={g("to")} onChange={submit} />
      </div>
      <button className="btn sm" type="submit">
        Filter
      </button>
      <a className="btn sm ghost" href="/">
        Clear
      </a>
    </form>
  );
}
