#!/usr/bin/env bash
set -Eeuo pipefail
umask 027

INSTALL_ROOT=/opt/mongodb-platform
APP_DIR="$INSTALL_ROOT/app"
SERVICE_USER=mongodb-platform
REPO_URL="${PLATFORM_REPO_URL:-https://github.com/dungxga27/zun-db.git}"
LOG_FILE=/var/log/mongodb-platform-update.log
STATUS_FILE=/run/mongodb-platform-update.status
LOCK_FILE=/run/mongodb-platform-update.lock
RELEASE_DIR=""
PREVIOUS_DIR="$INSTALL_ROOT/app.previous"
DEPLOYED=false

[[ $EUID -eq 0 ]] || { printf 'Run this updater as root.\n' >&2; exit 1; }
command -v flock >/dev/null || { printf 'flock is required.\n' >&2; exit 1; }
exec 9>"$LOCK_FILE"
flock -n 9 || { printf 'An update is already running.\n' >&2; exit 1; }
touch "$LOG_FILE"
chmod 0644 "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1

write_status() {
  printf '{"state":"%s","message":"%s","updatedAt":"%s"}\n' "$1" "$2" "$(date -u +%FT%TZ)" >"$STATUS_FILE"
  chmod 0644 "$STATUS_FILE"
}

cleanup() { [[ -z "$RELEASE_DIR" ]] || rm -rf "$RELEASE_DIR"; }
failed() {
  local line=$1
  if [[ "$DEPLOYED" == true && -d "$PREVIOUS_DIR" ]]; then
    printf 'Health/deployment failure detected; restoring previous release.\n'
    systemctl stop mongodb-platform-web.service mongodb-platform-api.service || true
    rm -rf "$APP_DIR"
    mv "$PREVIOUS_DIR" "$APP_DIR"
    systemctl daemon-reload
    systemctl restart mongodb-platform-api.service mongodb-platform-web.service || true
  fi
  write_status failed "Update failed at line $line"
  printf 'Update failed at line %s.\n' "$line"
  cleanup
}
trap 'failed $LINENO' ERR
trap cleanup EXIT

write_status running "Downloading release"
printf '\n[%s] Starting MongoDB Platform update\n' "$(date -u +%FT%TZ)"
RELEASE_DIR=$(mktemp -d /opt/mongodb-platform-release.XXXXXX)
git clone --depth 1 "$REPO_URL" "$RELEASE_DIR"
COMMIT=$(git -C "$RELEASE_DIR" rev-parse --short HEAD)
chown -R "$SERVICE_USER:$SERVICE_USER" "$RELEASE_DIR"

write_status running "Installing dependencies"
runuser -u "$SERVICE_USER" -- bash -c 'cd "$1" && HOME="$2" NEXT_PUBLIC_API_BASE_URL=/api pnpm install --no-frozen-lockfile' bash "$RELEASE_DIR" "$INSTALL_ROOT"

write_status running "Building API and web"
runuser -u "$SERVICE_USER" -- bash -c 'cd "$1" && HOME="$2" NEXT_PUBLIC_API_BASE_URL=/api NODE_OPTIONS=--max-old-space-size=1536 pnpm build' bash "$RELEASE_DIR" "$INSTALL_ROOT"

write_status running "Deploying release $COMMIT"
systemctl stop mongodb-platform-web.service mongodb-platform-api.service
rm -rf "$PREVIOUS_DIR"
mv "$APP_DIR" "$PREVIOUS_DIR"
mv "$RELEASE_DIR" "$APP_DIR"
RELEASE_DIR=""
DEPLOYED=true
install -m 0755 "$APP_DIR/scripts/update.sh" /usr/local/sbin/mongodb-platform-update
install -m 0755 "$APP_DIR/scripts/configure-mongodb-access.sh" /usr/local/sbin/mongodb-platform-configure-access
install -m 0644 "$APP_DIR/deploy/mongodb-platform-api.service" /etc/systemd/system/mongodb-platform-api.service
install -m 0644 "$APP_DIR/deploy/mongodb-platform-web.service" /etc/systemd/system/mongodb-platform-web.service
NODE_BIN=$(command -v node)
PNPM_BIN=$(command -v pnpm)
sed -i "s|^ExecStart=.*node dist/main.js$|ExecStart=${NODE_BIN} dist/main.js|" /etc/systemd/system/mongodb-platform-api.service
sed -i "s|^ExecStart=.*pnpm start$|ExecStart=${PNPM_BIN} start|" /etc/systemd/system/mongodb-platform-web.service
systemctl daemon-reload
systemctl restart mongodb-platform-api.service mongodb-platform-web.service

write_status running "Running health check"
healthy=false
for _ in $(seq 1 40); do
  if curl --fail --silent http://127.0.0.1:3001/api/health >/dev/null 2>&1 && curl --fail --silent http://127.0.0.1:3000 >/dev/null 2>&1; then
    healthy=true
    break
  fi
  sleep 2
done
[[ "$healthy" == true ]]
rm -rf "$PREVIOUS_DIR"
DEPLOYED=false
write_status completed "Updated successfully to $COMMIT"
printf '[%s] Update completed: %s\n' "$(date -u +%FT%TZ)" "$COMMIT"
