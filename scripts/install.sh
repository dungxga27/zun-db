#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

INSTALL_ROOT=/opt/mongodb-platform
APP_DIR="$INSTALL_ROOT/app"
ENV_FILE="$INSTALL_ROOT/.env"
SERVICE_USER="${SERVICE_USER:-mongodb-platform}"
NONINTERACTIVE="${NONINTERACTIVE:-false}"
PLATFORM_REPO_URL="${PLATFORM_REPO_URL:-https://github.com/dungxga27/zun-db.git}"

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'Error: %s\n' "$*" >&2; exit 1; }
on_error() { printf 'Installation failed at line %s. Inspect the output above.\n' "$1" >&2; }
trap 'on_error $LINENO' ERR

[[ $EUID -eq 0 ]] || die "this installer must run as root"
[[ -r /etc/os-release ]] || die "cannot detect the operating system"
# shellcheck disable=SC1091
source /etc/os-release
[[ ${ID:-} == ubuntu ]] || die "only Ubuntu is supported"
case "${VERSION_ID:-}" in
  22.04) MONGO_CODENAME=jammy ;;
  24.04) MONGO_CODENAME=noble ;;
  *) die "Ubuntu 22.04 or 24.04 is required" ;;
esac
ARCH=$(dpkg --print-architecture)
[[ "$ARCH" == amd64 || "$ARCH" == arm64 ]] || die "unsupported architecture: $ARCH"

read_tty() {
  local prompt=$1 default=${2:-} secret=${3:-false} value
  [[ -r /dev/tty && -w /dev/tty ]] || die "interactive input needs /dev/tty; set NONINTERACTIVE=true and provide environment values"
  if [[ "$secret" == true ]]; then
    printf '%s' "$prompt" >/dev/tty
    IFS= read -r -s value </dev/tty
    printf '\n' >/dev/tty
  else
    printf '%s' "$prompt" >/dev/tty
    IFS= read -r value </dev/tty
  fi
  printf '%s' "${value:-$default}"
}

ask_value() {
  local name=$1 prompt=$2 default=${3:-} secret=${4:-false} required=${5:-true} value=${!name:-}
  if [[ -z "$value" && "$NONINTERACTIVE" != true ]]; then
    value=$(read_tty "$prompt" "$default" "$secret")
  fi
  value=${value:-$default}
  [[ "$required" != true || -n "$value" ]] || die "$name is required in noninteractive mode"
  printf -v "$name" '%s' "$value"
}

ask_bool() {
  local name=$1 prompt=$2 default=$3 value=${!name:-}
  if [[ -z "$value" && "$NONINTERACTIVE" != true ]]; then
    value=$(read_tty "$prompt" "$default")
  fi
  value=${value:-$default}
  case "${value,,}" in
    y|yes|true|1) printf -v "$name" '%s' true ;;
    n|no|false|0) printf -v "$name" '%s' false ;;
    *) die "$name must be yes or no" ;;
  esac
}

ask_value DOMAIN "Domain name (for example db.example.com): "
ask_value ADMIN_EMAIL "Initial admin email: "
ask_value ADMIN_PASSWORD "Initial admin password (hidden): " "" true
ask_bool ENABLE_HTTPS "Enable HTTPS with Let's Encrypt? [Y/n]: " Y
ask_bool EXPOSE_MONGODB "Expose MongoDB port 27017? [y/N]: " N
ask_bool ENABLE_BACKUPS "Enable automatic daily backups? [Y/n]: " Y
ask_value BACKUP_RETENTION_DAYS "Backup retention in days [14]: " 14 false

[[ "$DOMAIN" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)*[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$ ]] || die "DOMAIN is not a valid DNS hostname"
[[ "$ADMIN_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || die "ADMIN_EMAIL is invalid"
(( ${#ADMIN_PASSWORD} >= 8 )) || die "ADMIN_PASSWORD must contain at least 8 characters"
[[ "$BACKUP_RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]] || die "BACKUP_RETENTION_DAYS must be a positive integer"
if [[ "$EXPOSE_MONGODB" == true ]]; then
  [[ -n ${MONGODB_ALLOWED_CIDR:-} ]] || die "MONGODB_ALLOWED_CIDR is required when MongoDB is exposed"
fi
export DEBIAN_FRONTEND=noninteractive
log "Installing base packages"
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl gnupg nginx certbot python3-certbot-nginx ufw fail2ban git rsync jq openssl sudo util-linux
install -d -m 0755 /etc/apt/keyrings
if [[ "$EXPOSE_MONGODB" == true ]]; then
  python3 - "$MONGODB_ALLOWED_CIDR" <<'PY' || die "MONGODB_ALLOWED_CIDR must be a valid IPv4 or IPv6 CIDR"
import ipaddress, sys
ipaddress.ip_network(sys.argv[1], strict=False)
PY
fi

log "Installing Node.js 22 and pnpm"
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main\n' >/etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs
corepack enable
corepack prepare pnpm@10.15.0 --activate
PNPM_BIN=$(command -v pnpm)
[[ "$PNPM_BIN" == /usr/local/bin/pnpm ]] || ln -sf "$PNPM_BIN" /usr/local/bin/pnpm

log "Installing MongoDB 8.0 and Database Tools"
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg --dearmor --yes -o /etc/apt/keyrings/mongodb-server-8.0.gpg
printf 'deb [ arch=%s signed-by=/etc/apt/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu %s/mongodb-org/8.0 multiverse\n' "$ARCH" "$MONGO_CODENAME" >/etc/apt/sources.list.d/mongodb-org-8.0.list
apt-get update
apt-get install -y mongodb-org mongodb-database-tools

log "Installing Docker Engine and Compose plugin"
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu %s stable\n' "$ARCH" "$VERSION_CODENAME" >/etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

log "Acquiring application source"
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$INSTALL_ROOT" --shell /usr/sbin/nologin "$SERVICE_USER"
fi
install -d -m 0750 -o "$SERVICE_USER" -g "$SERVICE_USER" "$INSTALL_ROOT" "$APP_DIR"
rm -rf "$APP_DIR"
git clone --depth 1 "$PLATFORM_REPO_URL" "$APP_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

MONGO_ROOT_USERNAME=platform_admin
MONGO_ROOT_PASSWORD=""
JWT_SECRET=""
OLD_MONGODB_ALLOWED_CIDR=""
if [[ -f "$ENV_FILE" ]]; then
  # Preserve generated credentials on idempotent reruns.
  MONGO_ROOT_USERNAME=$(awk -F= '$1=="MONGO_ROOT_USERNAME" {sub(/^[^=]*=/, ""); print; exit}' "$ENV_FILE")
  MONGO_ROOT_PASSWORD=$(awk -F= '$1=="MONGO_ROOT_PASSWORD" {sub(/^[^=]*=/, ""); print; exit}' "$ENV_FILE")
  JWT_SECRET=$(awk -F= '$1=="JWT_SECRET" {sub(/^[^=]*=/, ""); print; exit}' "$ENV_FILE")
  OLD_MONGODB_ALLOWED_CIDR=$(awk -F= '$1=="MONGODB_ALLOWED_CIDR" {sub(/^[^=]*=/, ""); print; exit}' "$ENV_FILE")
fi
MONGO_ROOT_USERNAME=${MONGO_ROOT_USERNAME:-platform_admin}
MONGO_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD:-$(openssl rand -hex 32)}
JWT_SECRET=${JWT_SECRET:-$(openssl rand -hex 48)}

log "Configuring MongoDB authentication"
cp /etc/mongod.conf "/etc/mongod.conf.pre-platform.$(date +%s)"
python3 - "$EXPOSE_MONGODB" <<'PY'
import pathlib, re, sys
p = pathlib.Path('/etc/mongod.conf')
s = p.read_text()
bind = '0.0.0.0' if sys.argv[1] == 'true' else '127.0.0.1'
s = re.sub(r'(?m)^\s*bindIp:\s*.*$', f'  bindIp: {bind}', s)
s = re.sub(r'(?ms)^security:\s*(?:\n(?:[ \t]+.*|\s*))*(?=^[A-Za-z]|\Z)', '', s)
s = re.sub(r'(?ms)^storage:\s*\n', 'storage:\n  wiredTiger:\n    engineConfig:\n      cacheSizeGB: 0.5\n', s, count=1) if 'wiredTiger:' not in s else s
s += '\nsecurity:\n  authorization: enabled\n'
p.write_text(s)
PY
systemctl enable --now mongod
systemctl restart mongod
export MONGO_INIT_USER="$MONGO_ROOT_USERNAME" MONGO_INIT_PASS="$MONGO_ROOT_PASSWORD"
mongo_ready=false
for _ in $(seq 1 30); do
  if mongosh --quiet --eval 'db.adminCommand({ping:1}).ok' >/dev/null 2>&1 || \
     mongosh --quiet --eval 'quit(db.getSiblingDB("admin").auth(process.env.MONGO_INIT_USER,process.env.MONGO_INIT_PASS)?0:1)' >/dev/null 2>&1; then
    mongo_ready=true
    break
  fi
  sleep 2
done
[[ "$mongo_ready" == true ]] || die "MongoDB did not become ready"

if mongosh --quiet --eval 'quit(db.getSiblingDB("admin").auth(process.env.MONGO_INIT_USER,process.env.MONGO_INIT_PASS)?0:1)' >/dev/null 2>&1; then
  log "MongoDB administrator already exists"
else
  mongosh --quiet --eval 'db.getSiblingDB("admin").createUser({user:process.env.MONGO_INIT_USER,pwd:process.env.MONGO_INIT_PASS,roles:[{role:"root",db:"admin"}]})' >/dev/null
  mongosh --quiet --eval 'quit(db.getSiblingDB("admin").auth(process.env.MONGO_INIT_USER,process.env.MONGO_INIT_PASS)?0:1)' >/dev/null
fi
unset MONGO_INIT_USER MONGO_INIT_PASS

SCHEME=http
[[ "$ENABLE_HTTPS" == true ]] && SCHEME=https
PROJECT_MONGODB_HOST=127.0.0.1
[[ "$EXPOSE_MONGODB" == true ]] && PROJECT_MONGODB_HOST=$DOMAIN
install -d -m 0700 -o root -g root /var/backups/mongodb-platform
cat >"$ENV_FILE" <<EOF
NODE_ENV=production
PORT=3001
METADATA_MONGODB_URI=mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@127.0.0.1:27017/zun_metadata?authSource=admin
MONGO_ADMIN_URI=mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@127.0.0.1:27017/admin?authSource=admin
PROJECT_MONGODB_HOST=${PROJECT_MONGODB_HOST}
PROJECT_MONGODB_PORT=27017
MONGO_ROOT_USERNAME=${MONGO_ROOT_USERNAME}
MONGO_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_ACCESS_TTL=15m
REFRESH_TTL_DAYS=30
COOKIE_SECURE=${ENABLE_HTTPS}
CORS_ORIGINS=${SCHEME}://${DOMAIN}
BACKUP_DIR=/var/backups/mongodb-platform
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS}
EXPOSE_MONGODB=${EXPOSE_MONGODB}
MONGODB_ALLOWED_CIDR=${MONGODB_ALLOWED_CIDR:-}
MONGODUMP_BIN=/usr/bin/mongodump
MONGORESTORE_BIN=/usr/bin/mongorestore
MONGO_START_COMMAND='["sudo","/usr/bin/systemctl","start","mongod"]'
MONGO_STOP_COMMAND='["sudo","/usr/bin/systemctl","stop","mongod"]'
MONGO_RESTART_COMMAND='["sudo","/usr/bin/systemctl","restart","mongod"]'
NODE_OPTIONS=--max-old-space-size=512
EOF
chown root:root "$ENV_FILE"
chmod 0600 "$ENV_FILE"

log "Installing dependencies and building applications"
runuser -u "$SERVICE_USER" -- env NEXT_PUBLIC_API_BASE_URL=/api pnpm --dir "$APP_DIR" install --no-frozen-lockfile
runuser -u "$SERVICE_USER" -- env NEXT_PUBLIC_API_BASE_URL=/api NODE_OPTIONS=--max-old-space-size=1536 pnpm --dir "$APP_DIR" build
chmod 0750 "$APP_DIR/scripts/backup.sh" "$APP_DIR/scripts/restore.sh"

log "Installing native services"
install -m 0644 "$APP_DIR/deploy/mongodb-platform-api.service" /etc/systemd/system/mongodb-platform-api.service
install -m 0644 "$APP_DIR/deploy/mongodb-platform-web.service" /etc/systemd/system/mongodb-platform-web.service
install -m 0644 "$APP_DIR/deploy/mongodb-platform-backup.service" /etc/systemd/system/mongodb-platform-backup.service
install -m 0644 "$APP_DIR/deploy/mongodb-platform-backup.timer" /etc/systemd/system/mongodb-platform-backup.timer
cat >/etc/sudoers.d/mongodb-platform <<EOF
${SERVICE_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl start mongod, /usr/bin/systemctl stop mongod, /usr/bin/systemctl restart mongod
EOF
chmod 0440 /etc/sudoers.d/mongodb-platform
visudo -cf /etc/sudoers.d/mongodb-platform >/dev/null
systemctl daemon-reload
systemctl enable --now mongodb-platform-api.service mongodb-platform-web.service
if [[ "$ENABLE_BACKUPS" == true ]]; then
  systemctl enable --now mongodb-platform-backup.timer
else
  systemctl disable --now mongodb-platform-backup.timer 2>/dev/null || true
fi

log "Configuring Nginx, firewall, and intrusion protection"
sed "s/__DOMAIN__/$DOMAIN/g" "$APP_DIR/deploy/nginx-native.conf" >/etc/nginx/sites-available/mongodb-platform
ln -sf /etc/nginx/sites-available/mongodb-platform /etc/nginx/sites-enabled/mongodb-platform
rm -f /etc/nginx/sites-enabled/default
nginx -t
cat >/etc/fail2ban/jail.d/mongodb-platform.local <<'EOF'
[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-botsearch]
enabled = true
EOF
systemctl enable --now nginx fail2ban
systemctl restart fail2ban
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw delete allow 27017/tcp >/dev/null 2>&1 || true
if [[ -n "$OLD_MONGODB_ALLOWED_CIDR" ]]; then
  ufw --force delete allow from "$OLD_MONGODB_ALLOWED_CIDR" to any port 27017 proto tcp >/dev/null 2>&1 || true
fi
if [[ "$EXPOSE_MONGODB" == true ]]; then
  ufw allow from "$MONGODB_ALLOWED_CIDR" to any port 27017 proto tcp comment 'MongoDB restricted access'
fi
ufw --force enable

if [[ "$ENABLE_HTTPS" == true ]]; then
  log "Requesting Let's Encrypt certificate"
  certbot --nginx --non-interactive --agree-tos --redirect --keep-until-expiring -m "$ADMIN_EMAIL" -d "$DOMAIN"
fi

log "Creating initial platform administrator"
api_ready=false
for _ in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
    api_ready=true
    break
  fi
  sleep 2
done
[[ "$api_ready" == true ]] || die "API did not become ready; check journalctl -u mongodb-platform-api"
bootstrap_json=$(printf '%s\0%s' "$ADMIN_EMAIL" "$ADMIN_PASSWORD" | jq -Rs 'split("\u0000") | {email:.[0],password:.[1]}')
bootstrap_code=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --request POST --header 'Content-Type: application/json' --data-binary @- http://127.0.0.1:3001/api/auth/bootstrap <<<"$bootstrap_json" || true)
unset ADMIN_PASSWORD bootstrap_json
if [[ "$bootstrap_code" != 200 && "$bootstrap_code" != 201 && "$bootstrap_code" != 409 ]]; then
  die "admin bootstrap failed with HTTP $bootstrap_code; check journalctl -u mongodb-platform-api"
fi

log "Running health check"
health_url="${SCHEME}://${DOMAIN}/api/health"
health_port=80
[[ "$ENABLE_HTTPS" == true ]] && health_port=443
for _ in $(seq 1 30); do
  if curl --fail --silent --show-error --resolve "$DOMAIN:$health_port:127.0.0.1" "$health_url" >/dev/null 2>&1; then
    printf '\nMongoDB Platform installed successfully.\n'
    printf 'Dashboard: %s\n' "${SCHEME}://${DOMAIN}"
    printf 'Health:    %s\n' "$health_url"
    printf 'Admin:     %s\n' "$ADMIN_EMAIL"
    printf 'Open the dashboard URL above to sign in.\n'
    exit 0
  fi
  sleep 2
done
die "health check failed; inspect systemctl status mongodb-platform-api mongodb-platform-web nginx"
