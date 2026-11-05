# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

A single-user, self-hosted **trading journal**. Capture a trade in seconds (ticker,
direction, prices, qty, fees, optional stop/target, setup, tags, markdown notes,
screenshots), review it later with auto P&L / R-multiple and stats. Stocks + options +
futures, one account, **JPY** (user mostly trades TSE stocks and Nikkei futures;
multiplier defaults reflect Nikkei contracts). Runs on this VPS, reached over Tailscale.

Decisions of record: **`SPEC.md`**. Deploy/backup: **`DEPLOY.md`**.

## Status (2026-06-10)

v1 is **built, schema applied, and smoke-tested** (production build passes; create /
close / delete, stats, image pipeline, CSV all verified). The **review loop** shipped
the same day (SPEC §3a): execution **grade** (A–F, process not outcome), a normalized
**mistakes** dimension, one-line **lesson**, and **full trade editing**
(`/trades/[id]/edit`) — smoke-tested end-to-end through the real server actions
(create / update / close / revert-to-open / delete, grade+mistake filters, CSV).

**Deployed 2026-06-10:** `trading-diary.service` (systemd, enabled on boot, loopback
:3000) + `tailscale serve --https=8443` →
**https://openclaw-vps.tail0d53dc.ts.net:8443/** (tailnet-only; 443 still belongs to
the OpenClaw dashboard). Nightly backup cron at 03:15 → `data/backups/`, 14-day
retention (`crontab -l`). Offsite backup target still undecided.

## Commands

```bash
npm run dev        # dev server (hot reload)
npm run build      # production build (also type-checks — run before declaring done)
npm run start      # production server, binds 127.0.0.1:3000 (loopback only)
npm run db:push    # sync SQLite schema to the Drizzle schema (use after editing schema.ts)
npm run db:studio  # browse the DB
bash scripts/backup.sh   # consistent snapshot + screenshots tar (wire to cron)
```

Schema changes: edit `src/db/schema.ts`, then `npm run db:push`. (Initial tables were
created via `drizzle-kit generate` + apply; `db:push` is the ongoing workflow.)

## Architecture

- `src/db/schema.ts` — Drizzle schema: `trades` (one unified row per trade, net pricing,
  `instrumentType` + `multiplier`, optional strike/expiry/right/stop/target, plus review
  fields `grade` a–f + `lesson`), `tags` + `trade_tags`, `mistakes` + `trade_mistakes`
  (separate from tags so process errors are independently queryable), `screenshots`.
  Plus relations.
- `src/db/index.ts` — better-sqlite3 client (WAL, FK on). **server-only.**
- `src/lib/` — `pnl.ts` (P&L / R math — single source of truth), `queries.ts` (all server
  reads + filters/stats), `images.ts` (sharp → webp full+thumb), `tv.ts` (TradingView
  deep-link), `format.ts`, `constants.ts` (incl. `GRADES`, `COMMON_MISTAKES`), `paths.ts`
  (data dir layout).
- `src/app/actions.ts` — **all writes** go through these server actions (create/close/
  **update**/delete trade, add/delete screenshots). Returns `{ ok, ... } | { ok:false, error }`.
- `src/app/page.tsx` (dashboard), `new/page.tsx` (capture), `trades/[id]/page.tsx`
  (detail + review panel), `trades/[id]/edit/page.tsx` (full edit — renders TradeForm in
  edit mode). `api/img/[...path]` serves screenshots; `api/export` emits CSV.
- `src/components/` — client components: `TradeForm` (create **and** edit — pass `trade`
  prop for edit mode), `CloseForm`, `ReviewFields` (grade/mistakes/lesson, shared by
  both forms), `ScreenshotDropzone` (clipboard/drag/file), `ScreenshotGallery` (thumbs +
  lightbox), `Filters`, `StatsStrip`, `DeleteTradeButton`.
- `data/` — gitignored: `journal.db` + `screenshots/<tradeId>/`. `drizzle/` — migrations.

## Conventions & gotchas

- **Reads** → `src/lib/queries.ts`. **Writes** → `src/app/actions.ts`. Keep that split.
- All DB-backed pages set `export const dynamic = "force-dynamic"` (live data, no static
  cache). Server actions call `revalidatePath` after writes.
- `better-sqlite3` and `sharp` are in `serverExternalPackages` (next.config.ts) and are
  **server-only** — never import them (or `@/db`, `@/lib/queries`, `@/lib/images`) into a
  client component.
- P&L / R live in `src/lib/pnl.ts`: `(exit−entry)×qty×multiplier×dir − fees`; recompute on
  any field change. P&L + R are stored denormalized on the row for fast stats.
- Screenshots are files on disk (webp), DB stores only relative paths; served via
  `/api/img/...` which is **path-traversal guarded** — keep that guard.
- **No app auth by design** (Tailscale-only). NEVER bind `0.0.0.0`, NEVER use Tailscale
  Funnel. `npm run start` is pinned to `127.0.0.1`.
- Single trusted user → notes markdown is rendered **unsanitized**. Add sanitization
  before any multi-user exposure.
- Trade IDs are integer autoincrement.
- **Review fields are closed-only**: grade / lesson / mistake links are stored only when
  `status = "closed"`; saving a trade as open nulls grade+lesson and clears its
  `trade_mistakes` links (mistake vocabulary rows persist). Enforced in all three write
  paths (`createTrade`, `closeTrade`, `updateTrade`) — keep it that way.

## Next steps

1. **Pick offsite backup target** — rclone bucket vs rsync to a tailnet host
   (`scripts/backup.sh` has the commented hook; local 14-day cron already running).
2. **"What's working" review analytics** — natural next feature now that grade/mistakes
   exist: ranked P&L/R breakdown by setup, tag, mistake, and grade (e.g. "expectancy of
   clean trades vs. trades with `moved stop`").
3. **Phase-2 backlog** (`SPEC.md` §5): analytics dashboard + equity curve (TradingView
   Lightweight Charts on own data), calendar P&L heatmap, broker CSV import, price
   auto-fill, live TV embed, multi-account, options leg-level modeling.

After code changes: `npm run build && sudo systemctl restart trading-diary`.
