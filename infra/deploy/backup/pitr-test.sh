#!/bin/sh
# Proves the database can be restored to a point in time (ADR 0064): marks a moment on the live database
# and has Postgres archive it, then restores the newest base backup into a throwaway Postgres inside this
# container, replays every archived change since onto it, and checks it reached that moment and that the
# platform's and Keycloak's tables are there. The live database is only asked for the mark; it is never
# written to otherwise.
# Writes the result to $BACKUP_DIR/pitr-test.json, which Admin's Status reads.
set -eu
set -o pipefail
: "${BACKUP_DIR:=/backups}"
: "${WAL_DIR:=/wal-archive}"
# How long the replay may take, in seconds.
: "${PITR_TEST_SECONDS:=1800}"

started=$(date -u +%s)
base=""
scratch=""

# result OK PROBLEM [FACTS]: writes pitr-test.json beside the backups.
result() {
  {
    printf '{"at":"%s","base":"%s","ok":%s,"seconds":%s' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(basename "${base:-none}")" "$1" "$(($(date -u +%s) - started))"
    [ -n "$2" ] && printf ',"problem":"%s"' "$(printf '%s' "$2" | tr -d '"\\')"
    [ -n "${3:-}" ] && printf ',%s' "$3"
    printf '}\n'
  } > "$BACKUP_DIR/pitr-test.json.partial"
  mv "$BACKUP_DIR/pitr-test.json.partial" "$BACKUP_DIR/pitr-test.json"
  if [ "$1" = true ]; then echo "pitr-test: $(basename "$base") replayed and checked"; else echo "pitr-test: FAILED: $2" >&2; fi
}

cleanup() {
  if [ -n "$scratch" ]; then
    su postgres -c "PATH='$PATH' pg_ctl -D $scratch/data -m immediate stop" >/dev/null 2>&1 || true
    rm -rf "$scratch"
  fi
}
trap cleanup EXIT

base=$(ls -1d "$BACKUP_DIR"/base-* 2>/dev/null | grep -v '\.' | sort | tail -n 1 || true)
if [ -z "$base" ]; then
  result false "There is no base backup to restore yet."
  exit 1
fi

# The mark: a transaction on the live database (it writes a commit record with its time), then a switch
# to a new WAL file so the one holding it is finished and archived.
mark=$(psql -tA -c "select to_char(now() at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"'), txid_current()" | cut -d '|' -f 1) || mark=""
segment=$(psql -tA -c "select pg_walfile_name(pg_switch_wal())") || segment=""
if [ -z "$mark" ] || [ -z "$segment" ]; then
  result false "The live database could not be asked to archive its latest changes."
  exit 1
fi
waited=0
until [ -e "$WAL_DIR/$segment.gz" ]; do
  if [ "$waited" -ge 120 ]; then
    result false "Postgres did not archive its latest changes ($segment) within two minutes."
    exit 1
  fi
  sleep 2
  waited=$((waited + 2))
done

scratch=$(mktemp -d)
mkdir "$scratch/data"
if ! tar -xzf "$base/base.tar.gz" -C "$scratch/data"; then
  result false "$(basename "$base") could not be unpacked."
  exit 1
fi
# The archived WAL from the base backup on, copied in for the scratch Postgres to read: the archive is
# the live Postgres's own and only it may read it. Timeline histories too, after a restore to a time.
first=$(sed -n 's/^START WAL LOCATION: .*(file \([0-9A-F]\{24\}\))$/\1/p' "$scratch/data/backup_label")
mkdir "$scratch/wal"
for wal in "$WAL_DIR"/*.gz; do
  name=$(basename "$wal" .gz)
  case "$name" in
    *.history) ;;
    *) [ "$(printf '%s\n%s\n' "$first" "${name%%.*}" | sort | head -n 1)" = "$first" ] || continue ;;
  esac
  cp "$wal" "$scratch/wal/"
done
# Replays from the archive to its end, then opens. Listens only on a socket in the scratch folder, lets
# only this container's postgres user in, and archives nothing itself.
cat >> "$scratch/data/postgresql.auto.conf" <<CONF
restore_command = 'test -f $scratch/wal/%f.gz && gunzip -c $scratch/wal/%f.gz > %p'
recovery_target_action = 'promote'
listen_addresses = ''
unix_socket_directories = '$scratch'
archive_mode = off
shared_preload_libraries = ''
CONF
echo "local all all trust" > "$scratch/data/pg_hba.conf"
touch "$scratch/data/recovery.signal"
chown -R postgres "$scratch"
chmod 700 "$scratch/data"
if ! su postgres -c "PATH='$PATH' pg_ctl -D $scratch/data -l $scratch/log -t $PITR_TEST_SECONDS -w start" >/dev/null 2>&1; then
  result false "$(basename "$base") could not be started with its changes replayed: $(tail -n 1 "$scratch/log" 2>/dev/null | cut -c1-200)"
  exit 1
fi

# As the live database's own superuser, the one the backup signs in as.
q() { psql -h "$scratch" -U "${PGUSER:-postgres}" -d "$1" -tAc "$2"; }

# Open for connections can come before the replay ends: it has ended once it is out of recovery.
waited=0
until [ "$(q postgres "select pg_is_in_recovery()" 2>"$scratch/errors" || echo error)" = f ]; do
  if [ "$waited" -ge "$PITR_TEST_SECONDS" ] || { [ "$waited" -ge 60 ] && ! grep -q "in recovery\|starting up" "$scratch/errors" && [ -s "$scratch/errors" ]; }; then
    result false "Replaying the archived changes did not finish: $(tail -n 1 "$scratch/errors" | cut -c1-200)"
    exit 1
  fi
  sleep 2
  waited=$((waited + 2))
done

reached=$(q postgres "select coalesce(to_char(pg_last_xact_replay_timestamp() at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"'), '')" 2>/dev/null || true)
facts="\"mark\":\"$mark\""
[ -z "$reached" ] || facts="$facts,\"reached\":\"$reached\""
# ISO times in UTC sort as strings.
if [ -z "$reached" ] || [ "$(printf '%s\n%s\n' "$mark" "$reached" | sort | tail -n 1)" != "$reached" ]; then
  result false "The replay stopped short of the latest archived change: some archived WAL is missing." "$facts"
  exit 1
fi

missing=""
for table in registry.apps events.audit identity.preferences; do
  [ "$(q platform "select to_regclass('$table') is not null" 2>/dev/null || echo f)" = t ] || missing="$missing $table"
done
[ "$(q keycloak "select to_regclass('public.user_entity') is not null" 2>/dev/null || echo f)" = t ] || missing="$missing keycloak.user_entity"
if [ -n "$missing" ]; then
  result false "These tables did not come back:$missing." "$facts"
  exit 1
fi
result true "" "$facts"
