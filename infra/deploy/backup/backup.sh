#!/bin/sh
# Dumps the whole Postgres server (the platform's data and Keycloak's) once a
# day to /backups, gzipped, and keeps the last $BACKUP_KEEP_DAYS days.
# Takes one at start too when today has none, so a fresh setup is covered at once.
set -eu
# Without it a failed pg_dumpall would look like success, since gzip ends the pipe.
set -o pipefail
: "${BACKUP_HOUR_UTC:=2}"
: "${BACKUP_KEEP_DAYS:=14}"
: "${BACKUP_DIR:=/backups}"

backup() {
  file="$BACKUP_DIR/platform-$(date -u +%Y-%m-%d).sql.gz"
  # Written beside the final name, so a failed dump never replaces a good one.
  if pg_dumpall --clean --if-exists | gzip > "$file.partial"; then
    mv "$file.partial" "$file"
    echo "backup: wrote $file ($(du -h "$file" | cut -f1))"
  else
    rm -f "$file.partial"
    echo "backup: FAILED, keeping earlier backups" >&2
  fi
  find "$BACKUP_DIR" -name 'platform-*.sql.gz' -mtime +"$((BACKUP_KEEP_DAYS - 1))" -print -delete | sed 's/^/backup: removed /'
}

mkdir -p "$BACKUP_DIR"
[ -e "$BACKUP_DIR/platform-$(date -u +%Y-%m-%d).sql.gz" ] || backup
[ "${1:-}" = "--once" ] && exit 0

while :; do
  now=$(date -u +%s)
  next=$(( now - now % 86400 + BACKUP_HOUR_UTC * 3600 ))
  [ "$next" -gt "$now" ] || next=$(( next + 86400 ))
  echo "backup: next at $(date -u -d "@$next" +'%Y-%m-%d %H:%M') UTC"
  sleep $(( next - now ))
  backup
done
