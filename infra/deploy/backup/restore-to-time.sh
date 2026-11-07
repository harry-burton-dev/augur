#!/bin/sh
# Puts the database back as it was at a moment (ADR 0064; docs/deploy.md, "Restore to a point in time").
# Run with Postgres stopped and its data volume mounted at /pgdata, from the backup service:
#   pc run --rm --no-deps -v platform_pgdata:/pgdata --entrypoint /bin/sh backup \
#     /backup/restore-to-time.sh "2026-11-05 10:30:00"
# The time is UTC. It picks the newest base backup taken before that time, keeps the current data in
# $BACKUP_DIR/pgdata-before-restore-<now>.tar.gz first, puts the base backup in its place and tells
# Postgres to replay the archived WAL up to the moment, then open. Starting Postgres (pc up -d postgres)
# does the replay; its log says "archive recovery complete" when it is done.
set -eu
# The database's image runs Debian's sh (dash), which has no pipefail, so the script runs itself in bash.
(set -o pipefail) 2>/dev/null || exec bash "$0" "$@"
set -o pipefail
: "${BACKUP_DIR:=/backups}"
# The current data it keeps holds every person's data: root alone may read it.
umask 077
: "${WAL_DIR:=/wal-archive}"
: "${PGDATA_DIR:=/pgdata}"

say() { echo "restore-to-time: $*" >&2; }
[ $# -ge 1 ] || { say 'give the time to go back to, in UTC, as "YYYY-MM-DD HH:MM:SS"'; exit 2; }
target=$(date -u -d "$1" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null) || { say "\"$1\" isn't a time; give it as \"YYYY-MM-DD HH:MM:SS\" (UTC)"; exit 2; }
# As Postgres reads it.
pgtarget=$(date -u -d "$1" '+%Y-%m-%d %H:%M:%S+00')
[ -d "$PGDATA_DIR" ] || { say "Postgres's data volume isn't mounted at $PGDATA_DIR"; exit 2; }
[ -d "$WAL_DIR" ] || { say "the WAL archive isn't mounted at $WAL_DIR"; exit 2; }
if [ -e "$PGDATA_DIR/postmaster.pid" ]; then
  say "Postgres looks to be running (postmaster.pid is there). Stop it first: pc stop postgres."
  say "If it is stopped and crashed before, remove $PGDATA_DIR/postmaster.pid and run this again."
  exit 1
fi

# The newest base backup taken before the moment; `taken` is when it finished, the earliest it restores to.
base=""
for dir in $(ls -1d "$BACKUP_DIR"/base-* 2>/dev/null | grep -v '\.' | sort); do
  taken=$(cat "$dir/taken" 2>/dev/null || true)
  [ -n "$taken" ] && [ "$(printf '%s\n%s\n' "$taken" "$target" | sort | head -n 1)" = "$taken" ] && base=$dir
done
if [ -z "$base" ]; then
  say "no base backup was taken before $target. The earliest moment there is: $(cat "$(ls -1d "$BACKUP_DIR"/base-* 2>/dev/null | grep -v '\.' | sort | head -n 1)/taken" 2>/dev/null || echo none)."
  exit 1
fi
say "going back to $target from $(basename "$base") (taken $(cat "$base/taken"))"

# Who owns the data: Postgres's own user in its image, which isn't this container's.
owner=$(stat -c %u:%g "$PGDATA_DIR/PG_VERSION" 2>/dev/null || echo 999:999)
if [ -n "$(ls -A "$PGDATA_DIR")" ]; then
  kept="$BACKUP_DIR/pgdata-before-restore-$(date -u +%Y-%m-%dT%H%M%SZ).tar.gz"
  say "keeping the current data in $kept"
  tar -czf "$kept.partial" -C "$PGDATA_DIR" .
  mv "$kept.partial" "$kept"
  find "$PGDATA_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
fi
tar -xzf "$base/base.tar.gz" -C "$PGDATA_DIR"
cat >> "$PGDATA_DIR/postgresql.auto.conf" <<CONF
# Restore to a point in time, written by restore-to-time.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ). Ignored once
# the restore is done (recovery.signal is gone); safe to delete then.
restore_command = 'test -f $WAL_DIR/%f.gz && gunzip -c $WAL_DIR/%f.gz > %p'
recovery_target_time = '$pgtarget'
recovery_target_action = 'promote'
CONF
touch "$PGDATA_DIR/recovery.signal"
chown -R "$owner" "$PGDATA_DIR"
chmod 700 "$PGDATA_DIR"
say "ready. Start Postgres with: pc up -d postgres, then follow its log (pc logs -f postgres) until it says"
say "\"archive recovery complete\", and start the rest: pc up -d"
