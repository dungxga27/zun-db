#!/usr/bin/env bash
set -Eeuo pipefail

ENV_FILE=/opt/mongodb-platform/.env

[[ $EUID -eq 0 ]] || { printf 'Run this script as root.\n' >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { printf 'MongoDB Platform environment not found: %s\n' "$ENV_FILE" >&2; exit 1; }

read_tty() {
  local prompt=$1 value
  printf '%s' "$prompt" >/dev/tty
  IFS= read -r value </dev/tty
  printf '%s' "$value"
}

PUBLIC_HOST="${PROJECT_MONGODB_HOST:-}"
if [[ -z "$PUBLIC_HOST" || "$PUBLIC_HOST" == 127.0.0.1 || "$PUBLIC_HOST" == localhost ]]; then
  PUBLIC_HOST=$(curl -4fsSL --max-time 10 https://api.ipify.org 2>/dev/null || true)
fi
PUBLIC_HOST=${PUBLIC_HOST:-$(hostname -I | awk '{ print $1 }')}
PUBLIC_HOST=$(read_tty "Public MongoDB host/IP [$PUBLIC_HOST]: ") || true
PUBLIC_HOST=${PUBLIC_HOST:-$(curl -4fsSL --max-time 10 https://api.ipify.org 2>/dev/null || hostname -I | awk '{ print $1 }')}
ALLOWED_CIDR=$(read_tty 'Allowed client IP/CIDR (use 0.0.0.0/0 only for temporary testing): ')

[[ -n "$PUBLIC_HOST" ]] || { printf 'Public host is required.\n' >&2; exit 1; }
python3 - "$ALLOWED_CIDR" <<'PY'
import ipaddress, sys
ipaddress.ip_network(sys.argv[1], strict=False)
PY

if [[ "$ALLOWED_CIDR" == 0.0.0.0/0 || "$ALLOWED_CIDR" == ::/0 ]]; then
  printf 'WARNING: MongoDB has no direct TLS and will be reachable from the Internet.\n' >/dev/tty
  confirmation=$(read_tty 'Type OPEN to continue: ')
  [[ "$confirmation" == OPEN ]] || { printf 'Cancelled.\n'; exit 1; }
fi

cp /etc/mongod.conf "/etc/mongod.conf.pre-external.$(date +%s)"
python3 - <<'PY'
import pathlib, re
p = pathlib.Path('/etc/mongod.conf')
s = p.read_text()
if re.search(r'(?m)^\s*bindIp:', s):
    s = re.sub(r'(?m)^\s*bindIp:\s*.*$', '  bindIp: 0.0.0.0', s)
else:
    s = re.sub(r'(?m)^net:\s*$', 'net:\n  bindIp: 0.0.0.0', s, count=1)
p.write_text(s)
PY

if grep -q '^PROJECT_MONGODB_HOST=' "$ENV_FILE"; then
  sed -i "s|^PROJECT_MONGODB_HOST=.*|PROJECT_MONGODB_HOST=${PUBLIC_HOST}|" "$ENV_FILE"
else
  printf 'PROJECT_MONGODB_HOST=%s\n' "$PUBLIC_HOST" >>"$ENV_FILE"
fi
if grep -q '^EXPOSE_MONGODB=' "$ENV_FILE"; then sed -i 's/^EXPOSE_MONGODB=.*/EXPOSE_MONGODB=true/' "$ENV_FILE"; else printf 'EXPOSE_MONGODB=true\n' >>"$ENV_FILE"; fi
if grep -q '^MONGODB_ALLOWED_CIDR=' "$ENV_FILE"; then sed -i "s|^MONGODB_ALLOWED_CIDR=.*|MONGODB_ALLOWED_CIDR=${ALLOWED_CIDR}|" "$ENV_FILE"; else printf 'MONGODB_ALLOWED_CIDR=%s\n' "$ALLOWED_CIDR" >>"$ENV_FILE"; fi
chmod 0600 "$ENV_FILE"

while ufw --force delete allow 27017/tcp >/dev/null 2>&1; do :; done
ufw allow from "$ALLOWED_CIDR" to any port 27017 proto tcp comment 'MongoDB Platform external access'
ufw reload
systemctl restart mongod
systemctl restart mongodb-platform-api
sleep 3

if ! ss -lnt | grep -qE '(^|[[:space:]])0\.0\.0\.0:27017'; then
  printf 'MongoDB is not listening externally. Check: journalctl -u mongod -n 50\n' >&2
  exit 1
fi

printf '\nMongoDB external access configured.\n'
printf 'Host: %s:27017\n' "$PUBLIC_HOST"
printf 'Allowed CIDR: %s\n' "$ALLOWED_CIDR"
printf 'Rotate project credentials in the dashboard to generate a new URI.\n'
