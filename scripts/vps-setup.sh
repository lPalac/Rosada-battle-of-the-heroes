#!/usr/bin/env bash
# 005 T047: one-time setup of a Hostinger KVM VPS (Ubuntu 24.04) for Rošada (specs/005-online-multiplayer/contracts/deployment.md).
# Run on the VPS as root:   sudo bash vps-setup.sh --domain game.example.com --email you@example.com [--user luka]
# It installs Node.js 24, nginx, certbot, ufw and unattended-upgrades; creates the `rosada` service user, the folders,
# the systemd unit and the nginx site; and gets a Let's Encrypt certificate. It contains no secrets and can be re-run.
set -euo pipefail

DOMAIN=""
EMAIL=""
ADMIN_USER="${SUDO_USER:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --user) ADMIN_USER="$2"; shift 2 ;;
    *) echo "Unknown argument $1"; exit 1 ;;
  esac
done
if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: sudo bash vps-setup.sh --domain <domain> --email <email for Let's Encrypt> [--user <your ssh user>]"
  exit 1
fi
if [[ $EUID -ne 0 ]]; then echo "Run as root (sudo)."; exit 1; fi

echo "== Packages"
apt-get update
apt-get install -y ca-certificates curl gnupg nginx certbot python3-certbot-nginx ufw unattended-upgrades
if ! command -v node >/dev/null || [[ "$(node -v)" != v24* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== Firewall (SSH, HTTP, HTTPS only; the game server listens on localhost)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "== Users and folders"
id rosada >/dev/null 2>&1 || useradd --system --home /opt/rosada --shell /usr/sbin/nologin rosada
mkdir -p /opt/rosada/releases /var/lib/rosada/rooms
chown -R rosada:rosada /var/lib/rosada
if [[ -n "$ADMIN_USER" ]]; then
  # The deploy user uploads releases; the service only reads them.
  chown -R "$ADMIN_USER":"$ADMIN_USER" /opt/rosada
  # Let the deploy script restart the service without a password prompt.
  echo "$ADMIN_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart rosada, /usr/bin/systemctl status rosada, /usr/bin/systemctl is-active rosada" > /etc/sudoers.d/rosada-deploy
  chmod 440 /etc/sudoers.d/rosada-deploy
fi

echo "== systemd unit"
cat > /etc/systemd/system/rosada.service <<'UNIT'
[Unit]
Description=Rosada game server
After=network.target

[Service]
User=rosada
WorkingDirectory=/opt/rosada/current
ExecStart=/usr/bin/node server/index.js
Environment=NODE_ENV=production PORT=2567 HOST=127.0.0.1 ROSADA_ROOMS_DIR=/var/lib/rosada/rooms
Restart=always
RestartSec=2
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/rosada

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable rosada

echo "== nginx site for $DOMAIN"
cat > /etc/nginx/sites-available/rosada <<NGINX
server {
  listen 80;
  listen [::]:80;
  server_name $DOMAIN;
  root /opt/rosada/current/dist;
  index index.html;

  gzip on;
  gzip_types application/javascript application/json text/css image/svg+xml text/plain application/octet-stream;

  add_header Strict-Transport-Security "max-age=31536000" always;
  add_header X-Content-Type-Options nosniff always;

  location = /index.html { add_header Cache-Control "no-cache"; }
  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; try_files \$uri =404; }
  location /tts/ { add_header Cache-Control "public, max-age=604800"; try_files \$uri =404; }
  location / { try_files \$uri /index.html; }

  # Game server: WebSockets and matchmaking under /ws/ (the prefix is stripped), health under /api/.
  location /ws/ {
    proxy_pass http://127.0.0.1:2567/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 1h;
    client_max_body_size 1m;
  }
  location /api/ {
    proxy_pass http://127.0.0.1:2567;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$remote_addr;
  }
}
NGINX
ln -sf /etc/nginx/sites-available/rosada /etc/nginx/sites-enabled/rosada
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "== HTTPS certificate (Let's Encrypt). The domain's A record must already point to this server."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
certbot renew --dry-run

echo "== Done. Next: run scripts/deploy.ps1 -VpsHost $DOMAIN from your computer."
