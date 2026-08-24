#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy the My Diary Node API and SPA behind Nginx on Ubuntu 22.04/24.04.
# Example:
#   sudo bash deploy/ubuntu-deploy.sh --domain diary.example.com --email admin@example.com --https

REPO_URL="https://github.com/PuneetGOTO/Personal-log-website.git"
BRANCH="main"
DOMAIN=""
CERTBOT_EMAIL=""
APP_DIR="/var/www/my-diary"
APP_USER="${SUDO_USER:-${USER}}"
SERVICE_NAME="my-diary"
PORT="4173"
ENABLE_HTTPS="0"
ENABLE_WWW="0"
SKIP_FIREWALL="0"

log() { printf '\n[my-diary] %s\n' "$*"; }
die() { printf '\n[my-diary] ERROR: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage:
  sudo bash deploy/ubuntu-deploy.sh --domain diary.example.com [options]

Required:
  --domain NAME        Public domain name for Nginx.

Options:
  --repo-url URL       Git repository URL.
  --branch NAME        Git branch (default: main).
  --app-dir PATH       Install directory (default: /var/www/my-diary).
  --port NUMBER        Local Node application port (default: 4173).
  --email EMAIL        Email used by Certbot when --https is enabled.
  --https              Request/renew a Let's Encrypt certificate.
  --www                Also configure www.DOMAIN and request its certificate.
  --skip-firewall      Do not change UFW rules.
  -h, --help           Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:?Missing value for --domain}"; shift 2 ;;
    --repo-url) REPO_URL="${2:?Missing value for --repo-url}"; shift 2 ;;
    --branch) BRANCH="${2:?Missing value for --branch}"; shift 2 ;;
    --app-dir) APP_DIR="${2:?Missing value for --app-dir}"; shift 2 ;;
    --port) PORT="${2:?Missing value for --port}"; shift 2 ;;
    --email) CERTBOT_EMAIL="${2:?Missing value for --email}"; shift 2 ;;
    --https) ENABLE_HTTPS="1"; shift ;;
    --www) ENABLE_WWW="1"; shift ;;
    --skip-firewall) SKIP_FIREWALL="1"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

[[ "$(id -u)" -eq 0 ]] || die "Run this script with sudo or as root."
[[ -n "$DOMAIN" ]] || die "--domain is required."
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || die "DOMAIN contains unsupported characters."
[[ "$PORT" =~ ^[0-9]+$ ]] || die "PORT must be numeric."
if [[ "$ENABLE_HTTPS" == "1" && -z "$CERTBOT_EMAIL" ]]; then
  die "--email is required when --https is enabled."
fi

if [[ "$APP_USER" == "root" ]]; then
  APP_USER="diary"
  if ! id "$APP_USER" >/dev/null 2>&1; then
    useradd --create-home --shell /bin/bash "$APP_USER"
  fi
fi

if [[ "$ENABLE_WWW" == "1" ]]; then
  SERVER_NAMES="$DOMAIN www.$DOMAIN"
else
  SERVER_NAMES="$DOMAIN"
fi

export DEBIAN_FRONTEND=noninteractive
log "Installing system packages"
apt-get update
apt-get install -y ca-certificates curl git nginx openssl ufw

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]]; then
  log "Installing Node.js 20 LTS"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! command -v pnpm >/dev/null 2>&1; then
  log "Installing pnpm"
  npm install --global pnpm@9
fi

log "Preparing application directory"
install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch --prune origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
else
  if [[ -n "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    die "$APP_DIR exists and is not an empty Git checkout."
  fi
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

if [[ ! -f "$APP_DIR/.env" ]]; then
  if [[ -f "$APP_DIR/data/app.json" ]]; then
    die "$APP_DIR/data/app.json already exists but .env is missing. Restore the original .env before restarting so existing accounts keep working."
  fi
  log "Creating first-boot secrets"
  ADMIN_INITIAL_PASSWORD="$(openssl rand -hex 16)"
  DEMO_INITIAL_PASSWORD="$(openssl rand -hex 16)"
  umask 077
  printf 'NODE_ENV=production\nPORT=%s\nADMIN_INITIAL_PASSWORD=%s\nDEMO_INITIAL_PASSWORD=%s\n' "$PORT" "$ADMIN_INITIAL_PASSWORD" "$DEMO_INITIAL_PASSWORD" > "$APP_DIR/.env"
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
  printf '\nInitial admin credentials (store securely and change after login):\n  Email: admin@example.com\n  Password: %s\n' "$ADMIN_INITIAL_PASSWORD"
fi

log "Installing dependencies and building the production bundle"
runuser -u "$APP_USER" -- env HOME="$(getent passwd "$APP_USER" | cut -d: -f6)" bash -lc "cd '$APP_DIR' && pnpm install --frozen-lockfile && pnpm build"

PNPM_BIN="$(command -v pnpm)"
log "Creating systemd service"
cat > "/etc/systemd/system/$SERVICE_NAME.service" <<EOF
[Unit]
Description=My Diary production Node server
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PATH=/usr/local/bin:/usr/bin:/bin
EnvironmentFile=-$APP_DIR/.env
ExecStart=$PNPM_BIN start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

log "Creating Nginx configuration for $SERVER_NAMES"
cat > "/etc/nginx/sites-available/$SERVICE_NAME" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_NAMES;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
ln -sfn "/etc/nginx/sites-available/$SERVICE_NAME" "/etc/nginx/sites-enabled/$SERVICE_NAME"
rm -f /etc/nginx/sites-enabled/default
nginx -t

if [[ "$SKIP_FIREWALL" != "1" ]]; then
  log "Opening SSH and web ports in UFW"
  ufw allow OpenSSH
  ufw allow 'Nginx Full'
  ufw --force enable
fi

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"
systemctl reload nginx

if [[ "$ENABLE_HTTPS" == "1" ]]; then
  log "Installing Certbot and enabling HTTPS"
  apt-get install -y certbot python3-certbot-nginx
  CERTBOT_DOMAINS=(-d "$DOMAIN")
  if [[ "$ENABLE_WWW" == "1" ]]; then
    CERTBOT_DOMAINS+=(-d "www.$DOMAIN")
  fi
  certbot --nginx --non-interactive --agree-tos --redirect --email "$CERTBOT_EMAIL" "${CERTBOT_DOMAINS[@]}"
fi

log "Deployment complete"
printf 'Service: systemctl status %s\n' "$SERVICE_NAME"
printf 'Local health check: curl http://127.0.0.1:%s/api/health\n' "$PORT"
if [[ "$ENABLE_HTTPS" == "1" ]]; then
  printf 'Public URL: https://%s\n' "$DOMAIN"
else
  printf 'Public URL: http://%s\n' "$DOMAIN"
fi
