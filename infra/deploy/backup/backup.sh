#!/bin/sh
# Dumps the whole Postgres server (the platform's data and Keycloak's) once a
# day to /backups, gzipped, and keeps the last $BACKUP_KEEP_DAYS days.
# Takes one at start too when today has none, so a fresh setup is covered at once.
# Once a week (and when none has run yet) it restores the newest one into a
# throwaway database to prove it works; see restore-test.sh.
# Apps' files (Garage, mounted read only at /objects) go beside it in objects-<date>.tar.gz:
# the blocks, and Garage's metadata as its newest hourly snapshot, never the live database.
# Each run's result goes in $STATUS_DIR/last-backup.json (backups/status/) for Admin's Status. The backups
# themselves are readable by root alone; only the status folder is mounted into the gateway.
# Point in time (ADR 0064): Postgres archives its changes (WAL) into /wal-archive as it makes them
# (postgres/start.sh). Each night this also takes a base backup (base-<date>/) for them to be replayed
# onto, keeps the newest PITR_KEEP_DAYS, and drops archived WAL older than the oldest. Every hour it notes
# the state in pitr.json, and with the off-server copy set up it copies the newest base and the WAL archive
# off the server too. The weekly restore test also replays the archive onto the newest base (pitr-test.sh).
# Without /wal-archive (an older compose.yml) none of this happens.
# Off-server copy (ADR 0060): once RESTIC_REPOSITORY is set, each day's dump and apps' files are also
# copied with restic to that repository (an S3-compatible bucket), encrypted here before they leave, and
# OFFSITE_KEEP_DAILY days of them are kept there. The weekly restore test then restores from that copy.
# The knowledge graph's forget ledger ($LEDGER_DIR) goes with each dump. The deployment's settings and
# secrets (.env and secrets/, mounted read only at $CONFIG_DIR) go with them, encrypted the same way, so a lost server can be set up again from the bucket and the password alone.
# It never copies a database that has no AUGUR in it, and never into a repository that already holds
# another server's backups until told this server is that deployment (--adopt-offsite), so a new server
# can't push the real backups out of retention. The result goes in $STATUS_DIR/offsite.json. Without
# RESTIC_REPOSITORY nothing leaves the server, and Status says so.
#   backup.sh --once           today's backup if there isn't one, then stops
#   backup.sh --now            a fresh backup whatever there is (the updater's, before an upgrade), then stops;
#                              fails when it can't be taken
#   backup.sh --restore-test   restores the newest backup into a throwaway database and checks it
#   backup.sh --restore-test --offsite   the same, from the newest in the off-server copy
#   backup.sh --offsite        copies the newest backup and apps' files off the server now, then stops
#   backup.sh --adopt-offsite  takes the off-server copy as this server's own (a lost server set up again
#                              from it, docs/deploy.md), then copies the newest backup there
#   backup.sh --pitr-test      restores the newest base backup and replays every archived change since
set -eu
# Without it a failed pg_dumpall would look like success, since gzip ends the pipe.
# The database's image runs Debian's sh (dash), which has no pipefail, so the script runs itself in bash.
(set -o pipefail) 2>/dev/null || exec bash "$0" "$@"
set -o pipefail
# Dumps hold every person's data and every login's password hash: root alone may read what this writes.
umask 077
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
: "${STATUS_DIR:=$BACKUP_DIR/status}"
export STATUS_DIR
# The deploy folder, read only: .env and secrets/ are copied off the server from here.
: "${CONFIG_DIR:=/deploy}"
# The knowledge graph's forget ledger, read only: it goes off the server with each day's dump.
: "${LEDGER_DIR:=/knowledge-ledger}"
# What restic files the snapshots under, so retention counts days: one repository per deployment.
: "${OFFSITE_HOST:=augur}"
export OFFSITE_HOST
# restic itself, which the backup-tools container puts here (compose.yml).
PATH="$PATH:/tools"
: "${RESTIC_CACHE_DIR:=/tmp/restic-cache}"
export RESTIC_CACHE_DIR
here=$(dirname "$0")

# status_written NAME: puts NAME.partial in place as the status folder's NAME, readable by the gateway.
status_written() {
  chmod 644 "$STATUS_DIR/$1.partial"
  mv "$STATUS_DIR/$1.partial" "$STATUS_DIR/$1"
}

# noted OK FILE PROBLEM: writes last-backup.json for Status.
noted() {
  {
    printf '{"at":"%s","ok":%s' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1"
    [ -n "$2" ] && printf ',"file":"%s","bytes":%s' "$(basename "$2")" "$(wc -c < "$2" | tr -d ' ')"
    [ -n "$3" ] && printf ',"problem":"%s"' "$3"
    printf '}\n'
  } > "$STATUS_DIR/last-backup.json.partial"
  status_written last-backup.json
}

# objects NAME [now]: tars apps' files into objects-NAME.tar.gz. Nothing to do without object storage.
# The volumes are live: Garage can remove a block, or replace an hourly snapshot, while tar reads them,
# and BusyBox's tar then fails the whole archive. So it tries again, up to three times, before giving up.
objects() {
  [ -d "$OBJECTS_DIR/data" ] || return 0
  tarball="$BACKUP_DIR/objects-$1.tar.gz"
  # The updater's backup before an upgrade: apps' files don't change in an upgrade, so one from today will do.
  if [ -n "${2:-}" ] && ls "$BACKUP_DIR"/objects-"$(date -u +%Y-%m-%d)"*.tar.gz >/dev/null 2>&1; then
    echo "backup: apps' files already backed up today, kept"
    return 0
  fi
  for try in 1 2 3; do
    # Everything of Garage's metadata but its live database; the snapshots hold a consistent copy.
    if tar -czf "$tarball.partial" -C "$OBJECTS_DIR" --exclude='meta/db.sqlite*' meta data; then
      mv "$tarball.partial" "$tarball"
      echo "backup: wrote $tarball ($(du -h "$tarball" | cut -f1))"
      return 0
    fi
    rm -f "$tarball.partial"
    [ "$try" = 3 ] || { echo "backup: apps' files changed while they were read, trying again" >&2; sleep 5; }
  done
  echo "backup: apps' files FAILED, keeping earlier backups" >&2
  return 1
}

# backup [NAME [now]]: today's backup, or platform-NAME.sql.gz (and objects-NAME.tar.gz). With `now` (the
# updater's), apps' files are taken only when today has none yet. Returns 1 when any of it failed.
backup() {
  name=${1:-$(date -u +%Y-%m-%d)}
  file="$BACKUP_DIR/platform-$name.sql.gz"
  # Written beside the final name, so a failed dump never replaces a good one.
  if pg_dumpall --clean --if-exists | gzip > "$file.partial"; then
    mv "$file.partial" "$file"
    echo "backup: wrote $file ($(du -h "$file" | cut -f1))"
    if objects "$name" "${2:-}"; then
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
  # Only after a good run: when every night fails, the old backups are the only ones there are.
  if [ -z "${failed:-}" ]; then
    find "$BACKUP_DIR" \( -name 'platform-*.sql.gz' -o -name 'objects-*.tar.gz' \) -mtime +"$((BACKUP_KEEP_DAYS - 1))" -print -delete | sed 's/^/backup: removed /'
  fi
  [ -z "${failed:-}" ]
}

# offnoted OK SNAPSHOT PROBLEM: writes offsite.json for Status.
offnoted() {
  {
    printf '{"at":"%s","ok":%s' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1"
    [ -n "$2" ] && printf ',"snapshot":"%s"' "$2"
    [ -n "$3" ] && printf ',"problem":"%s"' "$3"
    printf ',"keepDays":%s}\n' "$OFFSITE_KEEP_DAILY"
  } > "$STATUS_DIR/offsite.json.partial"
  status_written offsite.json
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
  # A dump of a database AUGUR has never run on (a new server whose Postgres has only just started) would
  # be the newest copy, and a restore of "latest" would bring back nothing.
  # grep stops at the first match and gunzip dies of the closed pipe, so only grep's answer counts.
  if ! { gunzip -c "$1" 2>/dev/null || true; } | grep -qm 1 '^CREATE TABLE registry\.apps '; then
    echo "backup: $(basename "$1") holds no AUGUR data yet, so it isn't copied off the server" >&2
    offnoted false "" "$(basename "$1") holds no AUGUR data yet (the registry hasn't made its tables), so it wasn't copied off this server, where it would be the newest copy. Earlier copies are kept."
    rm -f "$errors"
    return 1
  fi
  code=0
  offsite_ours || code=$?
  if [ "$code" = 2 ]; then
    echo "backup: off-server copy FAILED: the repository could not be read" >&2
    offnoted false "" "The off-server copy could not be read just now, so nothing was copied. Earlier copies are kept; it is tried again tomorrow."
    rm -f "$errors"
    return 1
  fi
  if [ "$code" != 0 ]; then
    echo "backup: the off-server copy holds backups this server didn't make, so nothing was copied" >&2
    offnoted false "" "The off-server copy already holds backups this server didn't make, so nothing was copied, and they stay as they are. If this server is the same deployment set up again, restore from them first (docs/deploy.md, Restore a lost server), then run backup.sh --adopt-offsite. If not, give this server its own OFFSITE_REPOSITORY."
    rm -f "$errors"
    return 1
  fi
  # Two snapshots a day, so apps' files keep the same paths each day and restic only sends what changed.
  # The knowledge graph's forget ledger goes with the dump: loading a dump on a new server brings back words
  # people forgot since, until the knowledge graph's migrate job reads the ledger and forgets them again.
  ledger=""
  [ ! -f "$LEDGER_DIR/forget-ledger.jsonl" ] || ledger=$LEDGER_DIR
  # shellcheck disable=SC2086 # One path at most, without a space.
  snapshot=$(restic backup --json --host "$OFFSITE_HOST" --tag augur-db "$1" $ledger 2>"$errors" | sed -n 's/.*"snapshot_id":"\([0-9a-f]\{8\}\).*/\1/p' | tail -n 1) || true
  if [ -z "$snapshot" ]; then
    echo "backup: off-server copy FAILED: $(said "$errors")" >&2
    offnoted false "" "The database backup could not be copied off this server: $(said "$errors"). Earlier copies are kept."
    rm -f "$errors"
    return 1
  fi
  # The settings and secrets: without them a dump can't be loaded on a new server (the logins' passwords are
  # in it) and apps' secrets can't be made again (APP_SECRETS_KEY).
  if [ -e "$CONFIG_DIR/.env" ]; then
    config=""
    for path in "$CONFIG_DIR/.env" "$CONFIG_DIR/secrets"; do [ ! -e "$path" ] || config="$config $path"; done
    # shellcheck disable=SC2086 # Two paths at most, neither with a space.
    if ! restic backup --host "$OFFSITE_HOST" --tag augur-config $config >/dev/null 2>"$errors"; then
      echo "backup: off-server copy of the settings FAILED: $(said "$errors")" >&2
      offnoted false "$snapshot" "The database was copied off this server, but .env and secrets/ could not be: $(said "$errors")."
      rm -f "$errors"
      return 1
    fi
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
  if ! restic forget --host "$OFFSITE_HOST" --tag augur-db --tag augur-files --tag augur-config --group-by host,tags --keep-daily "$OFFSITE_KEEP_DAILY" $prune >/dev/null 2>"$errors" ||
    { pitr_on && ! restic forget --host "$OFFSITE_HOST" --tag augur-base --tag augur-wal --group-by host,tags --keep-daily "$PITR_KEEP_DAYS" $prune >/dev/null 2>"$errors"; }; then
    # The copy is made; only the tidying failed, so it's said in the log and tried again tomorrow.
    echo "backup: off-server copy made, but older copies could not be forgotten: $(said "$errors")" >&2
  fi
  rm -f "$errors"
  offsite_adopt
  echo "backup: copied off the server (snapshot $snapshot)"
  offnoted true "$snapshot" ""
}

# The repository's id, which restic gives it when it's made.
# Empty when the repository can't be read, never a failure: set -e would end the script.
offsite_id() { { restic cat config --json 2>/dev/null || true; } | sed -n 's/.*"id": *"\([0-9a-f]*\)".*/\1/p' | head -n 1; }

# offsite_adopt: notes the repository as this server's own, in offsite-repository beside the backups.
offsite_adopt() {
  id=$(offsite_id)
  [ -z "$id" ] || echo "$id" > "$BACKUP_DIR/offsite-repository"
}

# offsite_ours: whether this server may copy into the repository. It may once it has copied there before
# (offsite-repository names it, or the script from before that file tried to), or while the repository
# holds no snapshot of this deployment's yet. One with another server's backups in it waits for --adopt-offsite.
offsite_ours() {
  id=$(offsite_id)
  [ -n "$id" ] || return 2
  [ "$(cat "$BACKUP_DIR/offsite-repository" 2>/dev/null)" != "$id" ] || return 0
  # offsite.json beside the backups: written only by the script from before offsite-repository.
  if [ ! -e "$BACKUP_DIR/offsite-repository" ] && [ -e "$BACKUP_DIR/offsite.json" ]; then
    offsite_adopt
    return 0
  fi
  [ "$(restic snapshots --host "$OFFSITE_HOST" --json 2>/dev/null | tr -d ' \n')" = "[]" ]
}

# The weekly restore test: from the off-server copy once there is one, so it proves that copy. Then the
# point-in-time one, which replays the WAL archive onto the newest base backup.
restore_test() {
  if offsite_on && [ -e "$STATUS_DIR/offsite.json" ] && grep -q '"ok":true' "$STATUS_DIR/offsite.json"; then
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
  # One a day: a container started after midnight took today's already.
  if [ -d "$dir" ]; then
    echo "backup: $(basename "$dir") is there already, kept"
    return 0
  fi
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
  # Not into a repository that holds another server's backups: offsite.json says why.
  code=0
  offsite_ours || code=$?
  if [ "$code" = 2 ]; then
    echo "The off-server copy could not be read, so the database's latest changes were not copied off this server." > "$BACKUP_DIR/wal-copy.problem"
    return 1
  elif [ "$code" != 0 ]; then
    echo "The database's latest changes aren't copied off this server until the off-server copy is its own (see the off-server copy)." > "$BACKUP_DIR/wal-copy.problem"
    return 1
  fi
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
  } > "$STATUS_DIR/pitr.json.partial"
  status_written pitr.json
}

mkdir -p "$BACKUP_DIR" "$STATUS_DIR"
chmod 755 "$STATUS_DIR"
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
if [ "${1:-}" = "--adopt-offsite" ]; then
  offsite_on || { echo "backup: RESTIC_REPOSITORY isn't set, so there is no off-server copy to adopt" >&2; exit 1; }
  [ -n "$(offsite_id)" ] || { echo "backup: the off-server copy can't be read: check OFFSITE_REPOSITORY, OFFSITE_PASSWORD and the bucket key" >&2; exit 1; }
  offsite_adopt
  echo "backup: the off-server copy is now this server's own"
  latest=$(ls -1 "$BACKUP_DIR"/platform-*.sql.gz 2>/dev/null | sort | tail -n 1 || true)
  [ -z "$latest" ] || offsite "$latest"
  exit $?
fi
# Named after the moment, so it sorts after today's and the restore test picks it.
if [ "${1:-}" = "--now" ]; then
  backup "$(date -u +%Y-%m-%dT%H%M%SZ)" now
  exit $?
fi
# Only the long-running container gets here (and --once). A server that copied off with the script from
# before offsite-repository existed has an offsite.json beside its backups: the repository it names is its
# own. Results from before the status folder are copied into it (left where they were too, so a release
# from before can still show them if the server goes back); backups from before umask 077 are made
# readable by root alone; and what a killed run left half-written goes (nothing else writes here while
# the container starts).
if offsite_on && [ -e "$BACKUP_DIR/offsite.json" ] && [ ! -e "$BACKUP_DIR/offsite-repository" ]; then
  offsite_adopt
fi
for result in last-backup offsite restore-test pitr pitr-test; do
  [ -e "$BACKUP_DIR/$result.json" ] && [ ! -e "$STATUS_DIR/$result.json" ] || continue
  cp "$BACKUP_DIR/$result.json" "$STATUS_DIR/$result.json.partial"
  status_written "$result.json"
done
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'platform-*.sql.gz' -o -name 'objects-*.tar.gz' -o -name 'pgdata-before-restore-*' \) -exec chmod 600 {} +
find "$BACKUP_DIR" -maxdepth 1 -type d -name 'base-*' -exec chmod 700 {} +
find "$BACKUP_DIR" -maxdepth 1 -name '*.partial' -print -exec rm -rf {} + | sed 's/^/backup: removed /'

today="$BACKUP_DIR/platform-$(date -u +%Y-%m-%d).sql.gz"
[ -e "$today" ] || backup || true
# Today's copy off the server, unless it was made already (a restart, or the copy was only just set up).
if offsite_on && [ -e "$today" ] && ! { [ -e "$STATUS_DIR/offsite.json" ] && grep -q "\"at\":\"$(date -u +%Y-%m-%d)T.*\"ok\":true" "$STATUS_DIR/offsite.json"; }; then
  # Today's was taken before AUGUR had started (a new server): a fresh one, now it has, is what goes.
  if ! { gunzip -c "$today" 2>/dev/null || true; } | grep -qm 1 '^CREATE TABLE registry\.apps '; then
    failed=
    backup "$(date -u +%Y-%m-%dT%H%M%SZ)" now || true
    latest=$(ls -1 "$BACKUP_DIR"/platform-*.sql.gz 2>/dev/null | sort | tail -n 1 || true)
    offsite "${latest:-$today}" || true
  else
    offsite "$today" || true
  fi
fi
# Today's base backup, if there isn't one: a fresh setup, or archiving was only just turned on.
! pitr_on || [ -d "$BACKUP_DIR/base-$(date -u +%Y-%m-%d)" ] || base "$(date -u +%Y-%m-%d)" || true
pitr_offsite || true
pitr_noted
[ "${1:-}" = "--once" ] && exit 0
# A first restore test, and a first one from the off-server copy as soon as there is one.
if [ ! -e "$STATUS_DIR/restore-test.json" ] || { offsite_on && ! grep -q '"from":"offsite"' "$STATUS_DIR/restore-test.json"; }; then
  restore_test
elif pitr_on && [ ! -e "$STATUS_DIR/pitr-test.json" ]; then
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
