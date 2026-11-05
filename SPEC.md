# Trading Journal — Spec

A single-user, self-hosted trade journal. Capture-first (log a trade in seconds),
analytics-ready schema. Stocks + options/futures, one account, JPY. Self-hosted on
this VPS, reached over Tailscale.

This document is the source of truth for v1. Decisions below were resolved one by one;
"Deferred" items are explicitly out of v1 scope.

> **Status (2026-06-10):** v1 is built, schema applied, and smoke-tested. The **review
> loop** (execution grade + mistakes dimension + lesson + full trade editing, §3a) was
> added and verified the same day. **Deployed** the same day: systemd
> (`trading-diary.service`) + Tailscale Serve on HTTPS **8443** (443 stays with the
> OpenClaw dashboard) + nightly 03:15 backup cron. Offsite backup target still
> undecided. See `CLAUDE.md` for current state and next steps.

---

## 1. Data model (SQLite via Drizzle)

### `trades`
| column | type | notes |
|---|---|---|
| id | pk | |
| status | `'open' \| 'closed'` | entry-first lifecycle |
| instrument_type | `'stock' \| 'option' \| 'future'` | drives which optional fields show |
| symbol | text | e.g. `7203` (TSE code) / `NK225M` (underlying for options) |
| direction | `'long' \| 'short'` | long option = debit, short = credit |
| quantity | real | shares / contracts |
| multiplier | real | 1 stock, 100 option, contract-specific future |
| entry_price | real | |
| exit_price | real, NULL | null while open |
| stop_price | real, NULL | optional → enables R-multiple |
| target_price | real, NULL | optional |
| fees | real, default 0 | per-trade commissions, in yen |
| strike | real, NULL | option/future metadata |
| expiry | date, NULL | option/future metadata |
| right | `'call' \| 'put'`, NULL | option metadata |
| entry_at | datetime, default now | |
| exit_at | datetime, NULL | |
| setup | text, NULL | autocomplete from history |
| notes | text | **markdown** free-text ("what I was thinking") |
| grade | `'a'…'f'`, NULL | **execution grade — process quality, independent of P&L**; closed trades only |
| lesson | text, NULL | one-line takeaway; closed trades only |
| pnl | real, NULL | computed on close, stored for fast stats |
| r_multiple | real, NULL | `pnl ÷ (abs(entry−stop) × qty × multiplier)` |
| created_at, updated_at | datetime | |

### `tags` + `trade_tags`
Normalized many-to-many. Free-form tag names, autocomplete from history.
Enables clean "P&L by tag" analytics.

### `mistakes` + `trade_mistakes`
Normalized many-to-many, **deliberately separate from tags** so process errors are
independently filterable/aggregable ("how do clean trades compare to ones where I moved
my stop?"). Vocabulary grows from use exactly like tags; a starter list
(`COMMON_MISTAKES`) seeds the suggestion chips. Linked only while a trade is closed —
reverting a trade to open clears its links (the vocabulary rows persist).

### `screenshots`
`id, trade_id, file_path, thumb_path, width, height, sort_order, caption NULL, created_at`.
Image files live on disk under `data/screenshots/<trade_id>/…`, auto-downscaled.
Only paths are stored in the DB.

### P&L formula
```
pnl = (exit_price − entry_price) × quantity × multiplier × direction − fees
      (direction: long = +1, short = −1)
initial_risk = abs(entry_price − stop_price) × quantity × multiplier
r_multiple   = pnl ÷ initial_risk
```
Computed and stored on close; recomputed on any edit.

---

## 2. Capture UX
- **Entry-first, flexible.** Save as **Open** (exit blank — captures the live thesis in
  notes) → one-click **Close** later adds exit + retrospective note. *Or* fill everything
  and save **Closed** in one shot for a past trade.
- **Open Positions** view for everything still open.
- **Screenshots:** clipboard paste (Ctrl/Cmd+V) + drag-drop + file-picker, multiple per
  trade, thumbnails with click-to-zoom lightbox, large PNGs auto-downscaled.
- `setup` and `tags` autocomplete from your own history (de-facto controlled vocabulary,
  no upfront lists).
- **Desktop-first, responsive** — optimized for the desktop trading station; phone works
  for review and quick notes.

---

## 3. v1 features
- Trade capture (above) + Open Positions view.
- Searchable / filterable trade list (ticker, setup, tag, date range, status).
- **Stats strip:** total/period P&L, win rate, # trades, avg R, expectancy.
- **"Open in TradingView" deep-link** per trade (underlying for options;
  `tradingview.com/chart/?symbol=EXCHANGE:SYMBOL`).
- **CSV export** of all trades (incl. grade, lesson, tags, mistakes).

## 3a. Review loop (added 2026-06-10)

Built to serve the second core job: *review past trades to identify what worked and what
didn't.* Three pieces, designed together:

- **Execution grade (A–F)** on every closed trade — grades the **process, not the
  outcome** (a good trade can lose; a bad trade can win). Set at close or in edit;
  filterable on the dashboard, so the stats strip re-scopes to e.g. "all A trades" vs
  "all F trades".
- **Mistakes** — first-class many-to-many dimension (see §1), entered via suggestion
  chips + free text in the close/edit forms. Filterable on the dashboard; shown as red
  chips in the trade list and on the detail page.
- **Lesson** — one-line takeaway per closed trade, displayed as a callout on the detail
  page and included in the CSV.
- **Full trade editing** (`/trades/[id]/edit`) — every field of an existing trade can be
  corrected; P&L/R recompute on save. Saving a closed trade back to **open** clears
  exit, P&L, grade, lesson, and mistake links (closed-only semantics, enforced in all
  three write paths: create / close / update).
- Closed trades without a review show a **"Not reviewed yet — grade this trade →"**
  prompt on the detail page.

---

## 4. Infra
- **Stack:** Next.js (App Router) + Server Actions, SQLite + Drizzle ORM
  (`better-sqlite3` driver).
- **Auth / exposure:** Tailscale-only, **no app login**. App binds `127.0.0.1:3000`,
  exposed via **Tailscale Serve (HTTPS)**. Never `0.0.0.0`, never Tailscale Funnel —
  with no login screen, anything publicly reachable would be wide open.
- **Run:** systemd unit running `next start` (auto-restart, starts on boot, journald logs).
  Port 3000 avoids OpenClaw's 18789.
- **Backups:** nightly cron — consistent `sqlite3 .backup` + tar of the screenshots
  folder, retain ~14 locally, push a copy **offsite** (cloud bucket via rclone, or rsync
  to another always-on tailnet machine).

---

## 5. Deferred to phase 2+
- Analytics dashboard + **equity curve** (TradingView **Lightweight Charts** rendering
  your own data) — the genuinely valuable "TradingView" tech here.
- Calendar P&L heatmap.
- Broker CSV import.
- Market-data price auto-fill.
- Live TradingView Advanced-Chart embed on the trade detail page.
- Multi-account tracking.
- Options leg-level modeling (v1 logs net debit/credit as one row).

---

## 6. Assumptions (flag to change)
1. **Currency = JPY**, single currency. (Changed from USD on 2026-06-10 — user trades
   TSE stocks / Nikkei futures. DB was empty at the switch, so no conversion was needed.)
2. **Notes = markdown.**
3. **Timestamps stored UTC**, displayed in a configurable timezone; "session"
   time-of-day analytics map to **Asia/Tokyo (JST)**.
4. **Symbols** stored plainly (`7203`); an exchange prefix (`TSE`, `OSE`) is attached only for the
   TradingView deep-link.

## 7. Open detail
- **Offsite backup target:** cloud bucket (rclone creds) or another tailnet host (hostname).
  Start local-only; wire offsite when a target exists.
