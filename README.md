# trading-diary

A fast, single-user, self-hosted trading journal. Log a trade in seconds — ticker, long/short, prices, size, fees, optional stop/target, setup + tags, markdown notes, and **clipboard-pasted chart screenshots** — then review it with automatic P&L, %-return, and R-multiple, plus win-rate / expectancy / profit-factor stats, an execution grade (A–F), tagged mistakes and a one-line lesson per closed trade. Handles stocks, options, and futures (net pricing) in one account, JPY — TSE stocks and Nikkei derivatives. Built for personal use (one trader) on a private VPS, reached over Tailscale.

**URL:** https://openclaw-vps.tail0d53dc.ts.net:8449/ (tailnet only; also listed on the `/apps` hub)

## How it works

```
browser on the tailnet ──HTTPS──▶ tailscale serve :8449 ──▶ next start 127.0.0.1:3000
                                                                │ reads:  src/lib/queries.ts
                                                                │ writes: src/app/actions.ts (server actions)
                                                                ▼
                                  data/journal.db (SQLite, WAL)    data/screenshots/<tradeId>/*.webp
```

- Entry-first capture: save **Open** with your live thesis, one-click **Close** later — or log a finished trade in one shot
- Instrument-aware form (option strike/expiry/right, future expiry appear as needed); defaults tuned for Japan (Nikkei mini future ×100, option ×1000, exchange prefixes TSE/OSE)
- Clipboard paste / drag-drop / file-picker screenshots, multiple per trade, auto-webp thumbnails with click-to-zoom
- Auto P&L + R-multiple from a planned stop (`(exit−entry)×qty×multiplier×dir − fees`, stored on the row); setup + tag autocomplete from your history
- Review loop: execution grade A–F (process, not outcome), a mistakes dimension separate from tags, a one-line lesson, full trade editing; review fields exist only on closed trades
- Dashboard stats strip + searchable/filterable trade table (ticker, setup, tag, mistake, grade, dates, status)
- "Open in TradingView" deep-link · CSV export (`/api/export`)

**Stack:** Next.js 15 (App Router + Server Actions) · Drizzle ORM + better-sqlite3 (one-file DB) · sharp · marked · plain CSS (Anthropic-style light theme: ivory + terracotta).

**Code map:** `src/db/schema.ts` (tables: `trades`, `tags`/`trade_tags`, `mistakes`/`trade_mistakes`, `screenshots`) · `src/lib/pnl.ts` (P&L/R math, single source of truth) · `src/lib/queries.ts` (all reads) · `src/app/actions.ts` (all writes) · `src/lib/images.ts` (sharp → webp full + thumb) · routes `/`, `/new`, `/trades/[id]`, `/trades/[id]/edit`, `/api/img/[...path]`, `/api/export`.

**Status:** v1 built 2026-06-10, review loop and trade editing shipped the same day, deployed and running. Next: pick an offsite backup target, "what's working" review analytics, then the phase-2 backlog (`SPEC.md` §5).

## Setup

Needs Node >= 18.18 (box: Node 24). `better-sqlite3` and `sharp` are native modules (see Gotchas). The `sqlite3` CLI is optional: `scripts/backup.sh` prefers it and falls back to better-sqlite3.

```bash
cd /home/ubuntu/trading-diary
npm ci                 # lockfile is committed; package.json uses "latest" ranges, so the lockfile is the real pin
npm run db:push        # create / sync the SQLite schema from src/db/schema.ts
npm run build
npm run start          # http://127.0.0.1:3000 (loopback only)
```

Other scripts: `npm run dev` (hot reload) · `npm run db:studio` · `bash scripts/backup.sh`.

## Run / deploy

Live as the **systemd user unit** `trading-diary.service` (`~/.config/systemd/user/`, enabled, linger on so it starts at boot; `npm start` = `next start -H 127.0.0.1 -p 3000`). The unit file lives only on the box, so here is the whole thing:

```ini
[Unit]
Description=Trading Journal — self-hosted trade log (loopback 127.0.0.1:3000, via tailscale serve :8449)
Documentation=file:///home/ubuntu/trading-diary/README.md
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/ubuntu/trading-diary
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/ubuntu/.npm-global/bin
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload && systemctl --user enable --now trading-diary   # first install
systemctl --user status trading-diary ; journalctl --user -u trading-diary -f
npm run build && systemctl --user restart trading-diary                         # after any code change
```

- **`next start` needs `next build` first.** With no `.next` the unit crash-loops (`Restart=always`); check for a build before debugging anything else.
- **Tailnet:** `tailscale serve --bg --https=8449 http://127.0.0.1:3000`. Port 443 belongs to the OpenClaw dashboard: never serve the diary there. Gateway restarts and reboots wipe Tailscale serve mappings; `tailscale-serve-apps.timer` (user unit) re-asserts `:8449` within 3 min (`systemctl --user start tailscale-serve-apps.service` forces it).
- **Never** bind `0.0.0.0` and never use `tailscale funnel`: there is no login by design, security is Tailscale's device auth.
- **Nightly backup:** crontab `15 3 * * * /home/ubuntu/trading-diary/scripts/backup.sh >> /home/ubuntu/trading-diary/data/backup.log 2>&1` writes `data/backups/journal-<stamp>.db` (`sqlite3 .backup`) and `screenshots-<stamp>.tar.gz`, keeping the newest 14 of each. Offsite push (rclone bucket or rsync to a tailnet host) is a commented hook in the script; no target chosen yet.

## Configuration

- `DATA_DIR`: optional; where `journal.db`, `screenshots/` and `backups/` live (default `./data`). Read by `src/lib/paths.ts` (Next loads `.env*`) and by `scripts/backup.sh`, which only sees the process environment (cron does not read `.env`). Template: `.env.example`.
- `NODE_ENV=production`: set by the unit (outside production the dev server caches the DB handle across hot-reloads).
- Host and port are pinned in the `start` script in `package.json` (`-H 127.0.0.1 -p 3000`).
- No API keys, tokens or other secrets, and no app login.

## Data

| Path | What | In git? |
|---|---|---|
| `data/journal.db` (+ `-wal`, `-shm`) | the trade journal (SQLite, WAL) | no: private trading records |
| `data/screenshots/<tradeId>/` | chart screenshots, `<base>.webp` + `<base>.thumb.webp`; the DB stores relative paths only | no: private |
| `data/backups/`, `data/backup.log` | 14 days of nightly DB snapshots + screenshot tarballs, cron output | no: copies of the above |
| `drizzle/` | migration SQL + snapshots | **yes**, but see Gotchas: it only holds the initial schema |
| `.next/`, `node_modules/` | build output, dependencies | no |

The whole of `data/` is ignored (`/data/`), so the repo carries code and schema only.

## Related

- Docs: [`SPEC.md`](SPEC.md) (decisions of record + phase-2 backlog) · [`DEPLOY.md`](DEPLOY.md) (older recipe: still shows a system unit and `:8443`, which is now ledger-web; its backup section is still accurate) · [`CLAUDE.md`](CLAUDE.md) (architecture, conventions, current state).
- **granger** (`/home/ubuntu/granger`) ATTACHes `data/journal.db` read-only (`lib/book.py`, path overridable with `GRANGER_BOOK_DB`) to see open and recent trades; keep schema changes backward-compatible.
- Shares the tailnet with the other box apps via the `/apps` hub and `tailscale-serve-apps.timer`.

## Gotchas

- **`better-sqlite3` is a native module.** After a Node upgrade the app fails with `ERR_DLOPEN_FAILED` / `Module did not self-register`; fix with `npm rebuild better-sqlite3`, then restart the unit. (`sharp` is native too.)
- **`drizzle/` is behind the schema.** It holds only `0000_clean_veda` (no `grade`, `lesson`, `mistakes`, `trade_mistakes`); the ongoing workflow is edit `src/db/schema.ts` then `npm run db:push`, so `drizzle-kit migrate` from a fresh clone will not produce the current schema. Use `db:push`.
- **Stale system unit.** `/etc/systemd/system/trading-diary.service` (first deploy) is still enabled but stopped since 2026-07-17; at the next reboot it would race the user unit for `:3000`. `sudo systemctl disable trading-diary` removes the risk (not done here).
- `better-sqlite3` and `sharp` are `serverExternalPackages`, server-only: never import `@/db`, `@/lib/queries` or `@/lib/images` into a client component.
- Reads live in `src/lib/queries.ts`, writes in `src/app/actions.ts`; DB-backed pages are `force-dynamic` and actions `revalidatePath` after writing.
- Review fields (grade, lesson, mistake links) are stored only when `status = "closed"`; saving a trade as open nulls them. Enforced in `createTrade`, `closeTrade` and `updateTrade`: keep it that way.
- `/api/img/[...path]` is path-traversal guarded: keep the guard. Trade notes are rendered as markdown **unsanitized** (single trusted user); add sanitization before any multi-user exposure.

## License

MIT. See [LICENSE](LICENSE).
