# Contract: Deployment on a Hostinger KVM VPS

**Feature**: `005-online-multiplayer`. Decisions are in research R-01, R-07, R-08 and R-11; the steps are in [quickstart.md](../quickstart.md).

## Machine

| Item | Value |
| --- | --- |
| Plan | Hostinger KVM 1 (1 vCPU, 4 GB RAM, 50 GB NVMe), EU data centre |
| OS | Ubuntu 24.04 LTS (plain template) |
| Runtime | Node.js 24 LTS (NodeSource apt repository), nginx, certbot (`python3-certbot-nginx`), ufw, unattended-upgrades |
| Users | `luka` (sudo, SSH key only); `rosada` (system user, no login, owns `/opt/rosada` and `/var/lib/rosada`) |
| Firewall | `ufw allow OpenSSH; ufw allow 'Nginx Full'; ufw enable` |
| SSH | `PasswordAuthentication no`, `PermitRootLogin no` |

## Files on the VPS

```text
/opt/rosada/
├── releases/<buildId>/
│   ├── dist/                 # static game (vite build)
│   ├── server/index.js       # game server bundle (vite build --ssr)
│   ├── package.json          # runtime deps only (colyseus …)
│   └── node_modules/         # npm ci --omit=dev
└── current -> releases/<buildId>
/var/lib/rosada/rooms/        # room files (research R-09), survive deploys
/etc/systemd/system/rosada.service
/etc/nginx/sites-available/rosada   (linked into sites-enabled)
```

## Environment of the game server

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `2567` | Listen port |
| `HOST` | `127.0.0.1` | Listen address (nginx is the only way in) |
| `ROSADA_ROOMS_DIR` | `/var/lib/rosada/rooms` | Room files |
| `ROSADA_TEST` | unset | `1` enables `forceNextRoll` (e2e only; never in production) |
| `NODE_ENV` | `production` | |

## systemd unit (outline)

```ini
[Unit]
Description=Rosada game server
After=network.target

[Service]
User=rosada
WorkingDirectory=/opt/rosada/current
ExecStart=/usr/bin/node server/index.js
Environment=NODE_ENV=production PORT=2567 ROSADA_ROOMS_DIR=/var/lib/rosada/rooms
Restart=always
RestartSec=2
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/rosada

[Install]
WantedBy=multi-user.target
```

## nginx site (outline)

```nginx
server {
  server_name <domain>;
  root /opt/rosada/current/dist;
  add_header Strict-Transport-Security "max-age=31536000" always;

  location = /index.html { add_header Cache-Control "no-cache"; }
  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
  location / { try_files $uri /index.html; }

  # Matchmaking (HTTP) and room sockets both live under /ws/; the prefix is stripped.
  location /ws/ {
    proxy_pass http://127.0.0.1:2567/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_read_timeout 1h;
  }
  location /api/ { proxy_pass http://127.0.0.1:2567; proxy_set_header X-Forwarded-For $remote_addr; }
  # No client addresses on disk (spec Clarifications 2026-11-10, FR-064): this format has no $remote_addr or
  # $http_x_forwarded_for. log_format rosada_noip is defined once in /etc/nginx/conf.d/rosada-log.conf:
  #   log_format rosada_noip '[$time_local] "$request" $status $body_bytes_sent $request_time';
  access_log /var/log/nginx/rosada.access.log rosada_noip;
  # listen 443 ssl + certificate lines are added by certbot --nginx; port 80 redirects to HTTPS
}
```

Large TTS assets under `public/tts/` are served by nginx with gzip on for JSON/JS/OBJ and long caching.

## Scripts in the repository

| Script | Does |
| --- | --- |
| `npm run build` | Type checks, `vite build` → `dist/`, `vite build --ssr server/index.ts` → `dist-server/` |
| `npm run dev:server` | `tsx watch server/index.ts` on port 2567 (Vite dev proxies `/ws` and `/api`) |
| `scripts/vps-setup.sh` | One-time, run on the VPS as root: users, packages, ufw, folders, systemd unit, nginx site, certbot |
| `scripts/deploy.ps1 -VpsHost <host> [-User luka]` | From Windows: test, build, pack, `scp`, unpack into a new release, `npm install --omit=dev`, switch `current`, restart, then `GET /api/health`. Step-by-step guide: [docs/deploy-hostinger.md](../../../docs/deploy-hostinger.md) |
| `scripts/rollback.ps1 -VpsHost <host>` | Point `current` at the previous release and restart |
| `scripts/smoke.ts <url>` | Deployment smoke test (research R-12) |

## Checks after deployment (US5)

1. `https://<domain>/` loads with a valid certificate; `http://` redirects.
2. `GET https://<domain>/api/health` → `{ ok: true, buildId }`, where `buildId` equals the local build.
3. `scripts/smoke.ts https://<domain>` passes.
4. `sudo reboot`; after about a minute, checks 1–2 pass again without logging in (FR-071).
5. `certbot renew --dry-run` succeeds (FR-070).
6. No client IPs on disk: `sudo grep -cE '([0-9]{1,3}\.){3}[0-9]{1,3}' /var/log/nginx/rosada.access.log` prints 0, and `journalctl -u rosada` shows no client addresses (FR-064).
