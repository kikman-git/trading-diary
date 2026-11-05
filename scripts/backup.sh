#!/usr/bin/env bash
# Nightly backup: consistent SQLite snapshot + screenshots tar, 14-day retention,
# optional offsite push. Wire to cron (see DEPLOY.md).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${DATA_DIR:-$ROOT/data}"
DB="$DATA_DIR/journal.db"
BK="$DATA_DIR/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
SNAP="$BK/journal-$STAMP.db"
SHOTS="$BK/screenshots-$STAMP.tar.gz"

mkdir -p "$BK"

# Consistent snapshot — prefer sqlite3 CLI, fall back to better-sqlite3.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$SNAP'"
else
  node -e "const D=require('$ROOT/node_modules/better-sqlite3');(async()=>{const db=new D(process.argv[1],{readonly:true});await db.backup(process.argv[2]);db.close();})()" "$DB" "$SNAP"
fi

# Screenshots (skip silently if none yet).
tar -czf "$SHOTS" -C "$DATA_DIR" screenshots 2>/dev/null || true

# Retention: keep newest 14 of each.
ls -1t "$BK"/journal-*.db 2>/dev/null | tail -n +15 | xargs -r rm -f
ls -1t "$BK"/screenshots-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm -f

# OFFSITE — configure ONE of these (see DEPLOY.md §4):
# rclone copy "$SNAP"  remote:trading-diary/
# rclone copy "$SHOTS" remote:trading-diary/
# rsync -a "$SNAP" "$SHOTS" user@another-tailnet-host:~/trading-diary-backups/

echo "backup ok: $STAMP"
