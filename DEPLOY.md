# Deploy — self-hosted on this VPS, reached over Tailscale

The app binds to **loopback only** and is exposed to your tailnet via **Tailscale
Serve**. It is never on a public port. Do **not** use `tailscale funnel` — there is no
app login, so a public URL would be wide open.

## 1. First-time setup

```bash
cd /home/ubuntu/trading-diary
npm install
npm run db:push          # create / sync the SQLite schema
npm run build
```

## 2. Run as a systemd service

Create `/etc/systemd/system/trading-diary.service`:

```ini
[Unit]
Description=Trading Journal (Next.js)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/trading-diary
# next start binds 127.0.0.1:3000 (see package.json "start")
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=3
Environment=NODE_ENV=production
# Optional: store data elsewhere
# Environment=DATA_DIR=/home/ubuntu/trading-diary/data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now trading-diary
systemctl status trading-diary
journalctl -u trading-diary -f      # live logs
```

## 3. Expose on the tailnet (HTTPS, tailnet-only)

**Note:** HTTPS 443 on this host already proxies the OpenClaw dashboard
(`tailscale serve status` shows `/ → 127.0.0.1:18789`). Do **not** serve the diary on
443 — that would replace the OpenClaw mapping. Use the second HTTPS port instead:

```bash
sudo tailscale serve --bg --https=8443 3000
sudo tailscale serve status
```

This serves `https://openclaw-vps.<your-tailnet>.ts.net:8443` to your devices only
(Mac, iPhone). TLS is terminated by Tailscale. To stop serving:

```bash
sudo tailscale serve --https=8443 off
```

## 4. Nightly backup (DB + screenshots) → offsite

`scripts/backup.sh` (already in the repo) takes a consistent SQLite snapshot, tars the
screenshots, keeps the last 14 days locally, and (optionally) pushes offsite. Wire it to
cron:

```bash
crontab -e
# 03:15 every night
15 3 * * * /home/ubuntu/trading-diary/scripts/backup.sh >> /home/ubuntu/trading-diary/data/backup.log 2>&1
```

Set an offsite target in the script: either `rclone` to a cloud bucket, or `rsync` to
another always-on machine on your tailnet.

## Upgrades

```bash
cd /home/ubuntu/trading-diary
git pull            # if you put it under git
npm install
npm run db:push
npm run build
sudo systemctl restart trading-diary
```
