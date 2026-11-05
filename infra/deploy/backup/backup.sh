#!/bin/sh
# Dumps the whole Postgres server (the platform's data and Keycloak's) once a
# day to /backups, gzipped, and keeps the last $BACKUP_KEEP_DAYS days.
# Takes one at start too when today has none, so a fresh setup is covered at once.
# Once a week (and when none has run yet) it restores the newest one into a
# throwaway database to prove it works; see restore-test.sh.
# Apps' files (Garage, mounted read only at /objects) go beside it in objects-<date>.tar.gz:
# the blocks, and Garage's metadata as its newest hourly snapshot, never the live database.
# Each run's result goes in $BACKUP_DIR/last-backup.json for Admin's Status.
# Point in time (ADR 0064): Postgres archives its changes (WAL) into /wal-archive as it makes them
# (postgres/start.sh). Each night this also takes a base backup (base-<date>/) for them to be replayed
# onto, keeps the newest PITR_KEEP_DAYS, and drops archived WAL older than the oldest. Every hour it notes
# the state in pitr.json, and with the off-server copy set up it copies the newest base and the WAL archive
# off the server too. The weekly restore test also replays the archive onto the newest base (pitr-test.sh).
# Without /wal-archive (an older compose.yml) none of this happens.
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
#   backup.sh --pitr-test      restores the newest base backup and replays every archived change since
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
: "${PITR_KEEP_DAYS:=7}"
: "${WAL_DIR:=/wal-archive}"
export WAL_DIR
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
  # Base backups and the WAL archive are kept as long as the local ones, PITR_KEEP_DAYS (pitr_offsite).
  if ! restic forget --host "$OFFSITE_HOST" --tag augur-db --tag augur-files --group-by host,tags --keep-daily "$OFFSITE_KEEP_DAILY" $prune >/dev/null 2>"$errors" ||
    { pitr_on && ! restic forget --host "$OFFSITE_HOST" --tag augur-base --tag augur-wal --group-by host,tags --keep-daily "$PITR_KEEP_DAYS" $prune >/dev/null 2>"$errors"; }; then
    # The copy is made; only the tidying failed, so it's said in the log and tried again tomorrow.
    echo "backup: off-server copy made, but older copies could not be forgotten: $(said "$errors")" >&2
  fi
  rm -f "$errors"
  echo "backup: copied off the server (snapshot $snapshot)"
  offnoted true "$snapshot" ""
}

# The weekly restore test: from the off-server copy once there is one, so it proves that copy. Then the
# point-in-time one, which replays the WAL archive onto the newest base backup.
restore_test() {
  if offsite_on && [ -e "$BACKUP_DIR/offsite.json" ] && grep -q '"ok":true' "$BACKUP_DIR/offsite.json"; then
    /bin/sh "$here/restore-test.sh" --offsite || true
  else
    /bin/sh "$here/restore-test.sh" || true
  fi
  ! pitr_on || /bin/sh "$here/pitr-test.sh" || true
}

pitr_on() { [ -d "$WAL_DIR" ]; }

# The base backups, oldest first.
bases() { ls -1d "$BACKUP_DIR"/base-* 2>/dev/null | grep -v '\.' | sort || true; }

# base NAME: a base backup of the whole server into base-NAME/ (base.tar.gz, as pg_basebackup writes it,
# and `taken`, when it finished: the earliest moment it restores to). The WAL it needs is in the archive,
# so none goes in it. Then keeps the newest PITR_KEEP_DAYS and drops archived WAL older than the oldest.
# A failure is kept in base.problem for pitr.json; returns 1.
base() {
  pitr_on || return 0
  dir="$BACKUP_DIR/base-$1"
  rm -rf "$dir.partial"
  errors=$(mktemp)
  code=0
  if pg_basebackup -D "$dir.partial" -Ft -z -X none --checkpoint=fast --label "augur $1" 2>"$errors"; then
    date -u +%Y-%m-%dT%H:%M:%SZ > "$dir.partial/taken"
    mv "$dir.partial" "$dir"
    rm -f "$BACKUP_DIR/base.problem"
    echo "backup: wrote $dir ($(du -sh "$dir" | cut -f1))"
  else
    rm -rf "$dir.partial"
    echo "backup: base backup FAILED: $(said "$errors")" >&2
    echo "The base backup for restoring to a point in time could not be taken: $(said "$errors")." > "$BACKUP_DIR/base.problem"
    code=1
  fi
  rm -f "$errors"
  extra=$(( $(bases | wc -l) - PITR_KEEP_DAYS ))
  if [ "$extra" -gt 0 ]; then
    bases | head -n "$extra" | while read -r old; do rm -rf "$old" "$old.copied"; echo "backup: removed $old"; done
  fi
  # Archived WAL from before the oldest base can't be replayed onto anything, so it goes.
  oldest=$(bases | head -n 1)
  if [ -n "$oldest" ]; then
    first=$(tar -xzOf "$oldest/base.tar.gz" backup_label 2>/dev/null | sed -n 's/^START WAL LOCATION: .*(file \([0-9A-F]\{24\}\))$/\1/p')
    [ -z "$first" ] || pg_archivecleanup -x .gz "$WAL_DIR" "$first"
  fi
  return "$code"
}

# pitr_offsite: copies the newest base backup (once) and the WAL archive off the server. Hourly, so the
# copy is at most about an hour behind. The result goes in wal-copy.problem, or wal-copied when it worked.
pitr_offsite() {
  pitr_on && offsite_on || return 0
  errors=$(mktemp)
  newest=$(bases | tail -n 1)
  if [ -n "$newest" ] && [ ! -e "$newest.copied" ]; then
    if restic backup --host "$OFFSITE_HOST" --tag augur-base "$newest" >/dev/null 2>"$errors"; then
      touch "$newest.copied"
    else
      echo "backup: off-server copy of $newest FAILED: $(said "$errors")" >&2
      echo "The base backup could not be copied off this server: $(said "$errors")." > "$BACKUP_DIR/wal-copy.problem"
      rm -f "$errors"
      return 1
    fi
  fi
  if restic backup --host "$OFFSITE_HOST" --tag augur-wal "$WAL_DIR" >/dev/null 2>"$errors"; then
    date -u +%Y-%m-%dT%H:%M:%SZ > "$BACKUP_DIR/wal-copied"
    rm -f "$BACKUP_DIR/wal-copy.problem"
  else
    echo "backup: off-server copy of the WAL archive FAILED: $(said "$errors")" >&2
    echo "The database's latest changes could not be copied off this server: $(said "$errors")." > "$BACKUP_DIR/wal-copy.problem"
  fi
  rm -f "$errors"
}

# pitr_noted: writes pitr.json for Admin's Status: from when to when the database can be restored to a
# moment, and the first thing that stops that being so.
pitr_noted() {
  pitr_on || return 0
  oldest=$(bases | head -n 1)
  earliest=$(cat "$oldest/taken" 2>/dev/null || true)
  # Postgres's own account of its archiving: on or not, when it last archived, and whether it is failing.
  archiver=$(psql -tA -F ' ' -c "select current_setting('archive_mode'), coalesce(to_char(last_archived_time at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), '-'), coalesce(last_failed_time > coalesce(last_archived_time, '-infinity'), false), coalesce(last_failed_wal, '-') from pg_stat_archiver" 2>/dev/null || true)
  read -r mode archived failing failedwal <<EOF
$archiver
EOF
  : "${archived:=-}" "${failing:=f}" "${failedwal:=-}"
  problem=""
  if [ -z "$mode" ]; then
    problem="Postgres could not be asked how its archiving is going."
  elif [ "$mode" != on ]; then
    problem="Postgres is not archiving its changes yet, so the database can only go back to a nightly backup. Start it again with pc up -d postgres (docs/deploy.md, Restore to a point in time)."
  elif [ "$failing" = t ]; then
    problem="Postgres could not archive its latest changes ($failedwal). Check the postgres container's log."
  elif [ -e "$BACKUP_DIR/base.problem" ]; then
    problem=$(cat "$BACKUP_DIR/base.problem")
  elif [ -z "$oldest" ]; then
    problem="No base backup has been taken yet, so there is nothing to replay changes onto."
  elif offsite_on && [ -e "$BACKUP_DIR/wal-copy.problem" ]; then
    problem=$(cat "$BACKUP_DIR/wal-copy.problem")
  fi
  {
    printf '{"at":"%s","ok":%s,"bases":%s' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$([ -z "$problem" ] && echo true || echo false)" "$(bases | wc -l | tr -d ' ')"
    [ -z "$earliest" ] || printf ',"earliest":"%s"' "$earliest"
    [ "$archived" = - ] || printf ',"archivedAt":"%s"' "$archived"
    ! offsite_on || [ ! -e "$BACKUP_DIR/wal-copied" ] || printf ',"copiedAt":"%s"' "$(cat "$BACKUP_DIR/wal-copied")"
    [ -z "$problem" ] || printf ',"problem":"%s"' "$(printf '%s' "$problem" | tr -d '"\\')"
    printf '}\n'
  } > "$BACKUP_DIR/pitr.json.partial"
  mv "$BACKUP_DIR/pitr.json.partial" "$BACKUP_DIR/pitr.json"
}

mkdir -p "$BACKUP_DIR"
if [ "${1:-}" = "--pitr-test" ]; then
  /bin/sh "$here/pitr-test.sh"
  exit $?
fi
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
# Today's base backup, if there isn't one: a fresh setup, or archiving was only just turned on.
! pitr_on || [ -d "$BACKUP_DIR/base-$(date -u +%Y-%m-%d)" ] || base "$(date -u +%Y-%m-%d)" || true
pitr_offsite || true
pitr_noted
[ "${1:-}" = "--once" ] && exit 0
# A first restore test, and a first one from the off-server copy as soon as there is one.
if [ ! -e "$BACKUP_DIR/restore-test.json" ] || { offsite_on && ! grep -q '"from":"offsite"' "$BACKUP_DIR/restore-test.json"; }; then
  restore_test
elif pitr_on && [ ! -e "$BACKUP_DIR/pitr-test.json" ]; then
  /bin/sh "$here/pitr-test.sh" || true
fi

# Wakes on the hour: the nightly work at BACKUP_HOUR_UTC, and every hour the WAL archive's copy off the
# server and pitr.json.
while :; do
  now=$(date -u +%s)
  next=$(( now - now % 3600 + 3600 ))
  sleep $(( next - now ))
  if [ "$(date -u +%H)" -eq "$BACKUP_HOUR_UTC" ]; then
    failed=
    backup || true
    today="$BACKUP_DIR/platform-$(date -u +%Y-%m-%d).sql.gz"
    [ ! -e "$today" ] || offsite "$today" || true
    base "$(date -u +%Y-%m-%d)" || true
    [ "$(date -u +%w)" != "$RESTORE_TEST_WEEKDAY" ] || restore_test
  fi
  pitr_offsite || true
  pitr_noted
done
