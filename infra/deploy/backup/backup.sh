#!/bin/sh
# Dumps the whole Postgres server (the platform's data and Keycloak's) once a
# day to /backups, gzipped, and keeps the last $BACKUP_KEEP_DAYS days.
# Takes one at start too when today has none, so a fresh setup is covered at once.
# Once a week (and when none has run yet) it restores the newest one into a
# throwaway database to prove it works; see restore-test.sh.
# Each run's result goes in $BACKUP_DIR/last-backup.json for Admin's Status.
set -eu
# Without it a failed pg_dumpall would look like success, since gzip ends the pipe.
set -o pipefail
: "${BACKUP_HOUR_UTC:=2}"
: "${BACKUP_KEEP_DAYS:=14}"
: "${BACKUP_DIR:=/backups}"
# 0 is Sunday.
: "${RESTORE_TEST_WEEKDAY:=0}"
here=$(dirname "$0")

# noted OK FILE PROBLEM: writes last-backup.json beside the backups.
noted() {
  {
    printf '{"at":"%s","ok":%s' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1"
    [ -n "$2" ] && printf ',"file":"%s","bytes":%s' "$(basename "$2")" "$(wc -c < "$2" | tr -d ' ')"
    [ -n "$3" ] && printf ',"problem":"%s"' "$3"
    printf '}\n'
  } > "$BACKUP_DIR/last-backup.json.partial"
  mv "$BACKUP_DIR/last-backup.json.partial" "$BACKUP_DIR/last-backup.json"
}

backup() {
  file="$BACKUP_DIR/platform-$(date -u +%Y-%m-%d).sql.gz"
  # Written beside the final name, so a failed dump never replaces a good one.
  if pg_dumpall --clean --if-exists | gzip > "$file.partial"; then
    mv "$file.partial" "$file"
    echo "backup: wrote $file ($(du -h "$file" | cut -f1))"
    noted true "$file" ""
  else
    rm -f "$file.partial"
    echo "backup: FAILED, keeping earlier backups" >&2
    noted false "" "The database could not be dumped. Earlier backups are kept."
  fi
  find "$BACKUP_DIR" -name 'platform-*.sql.gz' -mtime +"$((BACKUP_KEEP_DAYS - 1))" -print -delete | sed 's/^/backup: removed /'
}

restore_test() {
  /bin/sh "$here/restore-test.sh" || true
}

mkdir -p "$BACKUP_DIR"
if [ "${1:-}" = "--restore-test" ]; then
  /bin/sh "$here/restore-test.sh"
  exit $?
fi
[ -e "$BACKUP_DIR/platform-$(date -u +%Y-%m-%d).sql.gz" ] || backup
[ "${1:-}" = "--once" ] && exit 0
[ -e "$BACKUP_DIR/restore-test.json" ] || restore_test

while :; do
  now=$(date -u +%s)
  next=$(( now - now % 86400 + BACKUP_HOUR_UTC * 3600 ))
  [ "$next" -gt "$now" ] || next=$(( next + 86400 ))
  echo "backup: next at $(date -u -d "@$next" +'%Y-%m-%d %H:%M') UTC"
  sleep $(( next - now ))
  backup
  [ "$(date -u +%w)" != "$RESTORE_TEST_WEEKDAY" ] || restore_test
done
