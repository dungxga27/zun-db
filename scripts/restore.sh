#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ENV_FILE="${PLATFORM_ENV_FILE:-/opt/mongodb-platform/.env}"
LOCK_FILE="${BACKUP_LOCK_FILE:-/run/lock/mongodb-platform-backup.lock}"
ASSUME_YES=false

usage() {
  printf 'Usage: sudo %s [--yes] <backup.archive.gz>\n' "${0##*/}"
}
die() { printf 'Error: %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y) ASSUME_YES=true; shift ;;
    --help|-h) usage; exit 0 ;;
    --*) die "unknown option: $1" ;;
    *) [[ -z ${ARCHIVE:-} ]] || die "only one archive may be specified"; ARCHIVE=$1; shift ;;
  esac
done

[[ $EUID -eq 0 ]] || die "run this command as root"
[[ -n ${ARCHIVE:-} ]] || { usage >&2; exit 2; }
[[ -r "$ENV_FILE" ]] || die "cannot read $ENV_FILE"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
: "${MONGO_ROOT_USERNAME:?missing MONGO_ROOT_USERNAME in $ENV_FILE}"
: "${MONGO_ROOT_PASSWORD:?missing MONGO_ROOT_PASSWORD in $ENV_FILE}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mongodb-platform}"

command -v mongorestore >/dev/null || die "mongorestore is not installed"
command -v realpath >/dev/null || die "realpath is not installed"
archive_path=$(realpath -e -- "$ARCHIVE") || die "archive does not exist"
backup_root=$(realpath -e -- "$BACKUP_DIR") || die "backup directory does not exist"
[[ "$archive_path" == "$backup_root"/mongodb-platform-*.archive.gz ]] || die "archive must be a platform .archive.gz file inside $backup_root"
[[ -f "$archive_path" && ! -L "$ARCHIVE" ]] || die "archive must be a regular, non-symlink file"

if [[ -f "$archive_path.sha256" ]]; then
  (cd "$backup_root" && sha256sum --check --status "${archive_path##*/}.sha256") || die "backup checksum verification failed"
fi

if [[ "$ASSUME_YES" != true ]]; then
  [[ -r /dev/tty ]] || die "confirmation requires a terminal; pass --yes for noninteractive restore"
  printf 'This will drop and restore databases from %s. Continue? [y/N] ' "$archive_path" >/dev/tty
  IFS= read -r answer </dev/tty
  [[ "$answer" =~ ^[Yy]$ ]] || { printf 'Restore cancelled.\n'; exit 0; }
fi

exec 9>"$LOCK_FILE"
flock -n 9 || die "another backup or restore is already running"
tool_config=$(mktemp /run/mongodb-platform-tools.XXXXXX)
trap 'rm -f "$tool_config"' EXIT INT TERM
cat >"$tool_config" <<EOF
uri: mongodb://${MONGO_ROOT_USERNAME}@127.0.0.1:27017/admin?authSource=admin
password: ${MONGO_ROOT_PASSWORD}
EOF
chmod 0600 "$tool_config"

mongorestore --config="$tool_config" --archive="$archive_path" --gzip --drop
printf 'Restore completed from: %s\n' "$archive_path"
