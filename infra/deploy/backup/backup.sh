#!/bin/sh
# Dumps the whole Postgres server (the platform's data and Keycloak's) once a
# day to /backups, gzipped, and keeps the last $BACKUP_KEEP_DAYS days.
# Takes one at start too when today has none, so a fresh setup is covered at once.
# Once a week (and when none has run yet) it restores the newest one into a
# throwaway database to prove it works; see restore-test.sh.
# Apps' files (Garage, mounted read only at /objects) go beside it in objects-<date>.tar.gz:
# the blocks, and Garage's metadata as its newest hourly snapshot, never the live database.
# Each run's result goes in $BACKUP_DIR/last-backup.json for Admin's Status.
# Off-server copy (ADR 0060): once RESTIC_REPOSITORY is set, each day's dump and apps' files are also
# copied with restic to that repository (an S3-compatible bucket), encrypted here before they leave, and
# OFFSITE_KEEP_DAILY days of them are kept there. The weekly restore test then restores from that copy.
# The result goes in $BACKUP_DIR/offsite.json. Without RESTIC_REPOSITORY nothing leaves the server, and
# Status says so.
#   backup.sh --once           today's backup if there isn't one, then stops
#   backup.sh --now            a fresh backup whatever there is (the updater's, before an upgrade), then stops;
#                              fails when it can't be taken
#   backup.sh --restore-test   restores the newest backup into a throwaway database and checks it
#   backup.sh --restore-test --offsite   the same, from the newest in the off-server copy
#   backup.sh --offsite        copies the newest backup and apps' files off the server now, then stops
set -eu
# Without it a failed pg_dumpall would look like success, since gzip ends the pipe.
set -o pipefail
: "${BACKUP_HOUR_UTC:=2}"
: "${BACKUP_KEEP_DAYS:=14}"
: "${BACKUP_DIR:=/backups}"
: "${OBJECTS_DIR:=/objects}"
# 0 is Sunday.
: "${RESTORE_TEST_WEEKDAY:=0}"
: "${OFFSITE_KEEP_DAILY:=30}"
# What restic files the snapshots under, so retention counts days: one repository per deployment.
: "${OFFSITE_HOST:=augur}"
export OFFSITE_HOST
# restic itself, which the backup-tools container puts here (compose.yml).
PATH="$PATH:/tools"
: "${RESTIC_CACHE_DIR:=/tmp/restic-cache}"
export RESTIC_CACHE_DIR
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

# offnoted OK SNAPSHOT PROBLEM: writes offsite.json beside the backups.
offnoted() {
  {
    printf '{"at":"%s","ok":%s' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1"
    [ -n "$2" ] && printf ',"snapshot":"%s"' "$2"
    [ -n "$3" ] && printf ',"problem":"%s"' "$3"
    printf ',"keepDays":%s}\n' "$OFFSITE_KEEP_DAILY"
  } > "$BACKUP_DIR/offsite.json.partial"
  mv "$BACKUP_DIR/offsite.json.partial" "$BACKUP_DIR/offsite.json"
}

offsite_on() { [ -n "${RESTIC_REPOSITORY:-}" ]; }

# restic's last word on a failure, safe to put in JSON.
said() { tail -n 1 "$1" | tr -d '"\\' | cut -c1-200; }

# offsite FILE: copies the dump FILE and apps' files off the server, then forgets copies older than
# OFFSITE_KEEP_DAILY days (and, on the restore test's day, frees their space). Returns 1 when it failed.
offsite() {
  offsite_on || return 0
  errors=$(mktemp)
  # A new repository is made on first use (10 is restic's "there is no repository there").
  code=0
  restic cat config >/dev/null 2>"$errors" || code=$?
  [ "$code" != 10 ] || { restic init >/dev/null 2>"$errors" && code=0 || code=$?; }
  if [ "$code" != 0 ]; then
    echo "backup: off-server copy FAILED: $(said "$errors")" >&2
    offnoted false "" "Backups could not be copied off this server: $(said "$errors"). Check OFFSITE_REPOSITORY, OFFSITE_PASSWORD and the bucket key in .env (docs/deploy.md, "Off-server copy")."
    rm -f "$errors"
    return 1
  fi
  # Two snapshots a day, so apps' files keep the same paths each day and restic only sends what changed.
  snapshot=$(restic backup --json --host "$OFFSITE_HOST" --tag augur-db "$1" 2>"$errors" | sed -n 's/.*"snapshot_id":"\([0-9a-f]\{8\}\).*/\1/p' | tail -n 1) || true
  if [ -z "$snapshot" ]; then
    echo "backup: off-server copy FAILED: $(said "$errors")" >&2
    offnoted false "" "The database backup could not be copied off this server: $(said "$errors"). Earlier copies are kept."
    rm -f "$errors"
    return 1
  fi
  if [ -d "$OBJECTS_DIR/data" ]; then
    # 3 is restic's "some files couldn't be read": Garage removed a block while it copied, which is fine.
    code=0
    restic backup --host "$OFFSITE_HOST" --tag augur-files --exclude "$OBJECTS_DIR/meta/db.sqlite*" "$OBJECTS_DIR/data" "$OBJECTS_DIR/meta" >/dev/null 2>"$errors" || code=$?
    if [ "$code" != 0 ] && [ "$code" != 3 ]; then
      echo "backup: off-server copy of apps' files FAILED: $(said "$errors")" >&2
      offnoted false "$snapshot" "The database was copied off this server, but apps' files could not be: $(said "$errors")."
      rm -f "$errors"
      return 1
    fi
  fi
  prune=""
  [ "$(date -u +%w)" != "$RESTORE_TEST_WEEKDAY" ] || prune=--prune
  if ! restic forget --host "$OFFSITE_HOST" --group-by host,tags --keep-daily "$OFFSITE_KEEP_DAILY" $prune >/dev/null 2>"$errors"; then
    # The copy is made; only the tidying failed, so it's said in the log and tried again tomorrow.
    echo "backup: off-server copy made, but older copies could not be forgotten: $(said "$errors")" >&2
  fi
  rm -f "$errors"
  echo "backup: copied off the server (snapshot $snapshot)"
  offnoted true "$snapshot" ""
}

# The weekly restore test: from the off-server copy once there is one, so it proves that copy.
restore_test() {
  if offsite_on && [ -e "$BACKUP_DIR/offsite.json" ] && grep -q '"ok":true' "$BACKUP_DIR/offsite.json"; then
    /bin/sh "$here/restore-test.sh" --offsite || true
  else
    /bin/sh "$here/restore-test.sh" || true
  fi
}

mkdir -p "$BACKUP_DIR"
if [ "${1:-}" = "--restore-test" ]; then
  /bin/sh "$here/restore-test.sh" ${2:-}
  exit $?
fi
if [ "${1:-}" = "--offsite" ]; then
  offsite_on || { echo "backup: RESTIC_REPOSITORY isn't set, so nothing is copied off this server" >&2; exit 1; }
  latest=$(ls -1 "$BACKUP_DIR"/platform-*.sql.gz 2>/dev/null | sort | tail -n 1 || true)
  [ -n "$latest" ] || { echo "backup: there is no backup to copy yet" >&2; exit 1; }
  offsite "$latest"
  exit $?
fi
# Named after the moment, so it sorts after today's and the restore test picks it.
if [ "${1:-}" = "--now" ]; then
  backup "$(date -u +%Y-%m-%dT%H%M%SZ)"
  exit $?
fi
today="$BACKUP_DIR/platform-$(date -u +%Y-%m-%d).sql.gz"
[ -e "$today" ] || backup || true
# Today's copy off the server, unless it was made already (a restart, or the copy was only just set up).
if offsite_on && [ -e "$today" ] && ! { [ -e "$BACKUP_DIR/offsite.json" ] && grep -q "\"at\":\"$(date -u +%Y-%m-%d)T.*\"ok\":true" "$BACKUP_DIR/offsite.json"; }; then
  offsite "$today" || true
fi
[ "${1:-}" = "--once" ] && exit 0
# A first restore test, and a first one from the off-server copy as soon as there is one.
if [ ! -e "$BACKUP_DIR/restore-test.json" ] || { offsite_on && ! grep -q '"from":"offsite"' "$BACKUP_DIR/restore-test.json"; }; then
  restore_test
fi

while :; do
  now=$(date -u +%s)
  next=$(( now - now % 86400 + BACKUP_HOUR_UTC * 3600 ))
  [ "$next" -gt "$now" ] || next=$(( next + 86400 ))
  echo "backup: next at $(date -u -d "@$next" +'%Y-%m-%d %H:%M') UTC"
  sleep $(( next - now ))
  failed=
  backup || true
  today="$BACKUP_DIR/platform-$(date -u +%Y-%m-%d).sql.gz"
  [ ! -e "$today" ] || offsite "$today" || true
  [ "$(date -u +%w)" != "$RESTORE_TEST_WEEKDAY" ] || restore_test
done
