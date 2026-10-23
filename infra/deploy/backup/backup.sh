#!/bin/sh
# Dumps the whole Postgres server (the platform's data and Keycloak's) once a
# day to /backups, gzipped, and keeps the last $BACKUP_KEEP_DAYS days.
# Takes one at start too when today has none, so a fresh setup is covered at once.
# Once a week (and when none has run yet) it restores the newest one into a
# throwaway database to prove it works; see restore-test.sh.
# Apps' files (Garage, mounted read only at /objects) go beside it in objects-<date>.tar.gz:
# the blocks, and Garage's metadata as its newest hourly snapshot, never the live database.
# Each run's result goes in $BACKUP_DIR/last-backup.json for Admin's Status.
#   backup.sh --once           today's backup if there isn't one, then stops
#   backup.sh --now            a fresh backup whatever there is (the updater's, before an upgrade), then stops;
#                              fails when it can't be taken
#   backup.sh --restore-test   restores the newest backup into a throwaway database and checks it
set -eu
# Without it a failed pg_dumpall would look like success, since gzip ends the pipe.
set -o pipefail
: "${BACKUP_HOUR_UTC:=2}"
: "${BACKUP_KEEP_DAYS:=14}"
: "${BACKUP_DIR:=/backups}"
: "${OBJECTS_DIR:=/objects}"
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

# objects NAME: tars apps' files into objects-NAME.tar.gz. Nothing to do without object storage.
objects() {
  [ -d "$OBJECTS_DIR/data" ] || return 0
  tarball="$BACKUP_DIR/objects-$1.tar.gz"
  # Everything of Garage's metadata but its live database; the snapshots hold a consistent copy.
  if tar -czf "$tarball.partial" -C "$OBJECTS_DIR" --exclude='meta/db.sqlite*' meta data; then
    mv "$tarball.partial" "$tarball"
    echo "backup: wrote $tarball ($(du -h "$tarball" | cut -f1))"
  else
    rm -f "$tarball.partial"
    echo "backup: apps' files FAILED, keeping earlier backups" >&2
    return 1
  fi
}

# backup [NAME]: today's backup, or platform-NAME.sql.gz (and objects-NAME.tar.gz). Returns 1 when any of it failed.
backup() {
  name=${1:-$(date -u +%Y-%m-%d)}
  file="$BACKUP_DIR/platform-$name.sql.gz"
  # Written beside the final name, so a failed dump never replaces a good one.
  if pg_dumpall --clean --if-exists | gzip > "$file.partial"; then
    mv "$file.partial" "$file"
    echo "backup: wrote $file ($(du -h "$file" | cut -f1))"
    if objects "$name"; then
      noted true "$file" ""
    else
      noted false "$file" "The database was backed up, but apps' files could not be. Earlier backups are kept."
      failed=1
    fi
  else
    rm -f "$file.partial"
    echo "backup: FAILED, keeping earlier backups" >&2
    noted false "" "The database could not be dumped. Earlier backups are kept."
    failed=1
  fi
  find "$BACKUP_DIR" \( -name 'platform-*.sql.gz' -o -name 'objects-*.tar.gz' \) -mtime +"$((BACKUP_KEEP_DAYS - 1))" -print -delete | sed 's/^/backup: removed /'
  [ -z "${failed:-}" ]
}

restore_test() {
  /bin/sh "$here/restore-test.sh" || true
}

mkdir -p "$BACKUP_DIR"
if [ "${1:-}" = "--restore-test" ]; then
  /bin/sh "$here/restore-test.sh"
  exit $?
fi
# Named after the moment, so it sorts after today's and the restore test picks it.
if [ "${1:-}" = "--now" ]; then
  backup "$(date -u +%Y-%m-%dT%H%M%SZ)"
  exit $?
fi
[ -e "$BACKUP_DIR/platform-$(date -u +%Y-%m-%d).sql.gz" ] || backup || true
[ "${1:-}" = "--once" ] && exit 0
[ -e "$BACKUP_DIR/restore-test.json" ] || restore_test

while :; do
  now=$(date -u +%s)
  next=$(( now - now % 86400 + BACKUP_HOUR_UTC * 3600 ))
  [ "$next" -gt "$now" ] || next=$(( next + 86400 ))
  echo "backup: next at $(date -u -d "@$next" +'%Y-%m-%d %H:%M') UTC"
  sleep $(( next - now ))
  failed=
  backup || true
  [ "$(date -u +%w)" != "$RESTORE_TEST_WEEKDAY" ] || restore_test
done
