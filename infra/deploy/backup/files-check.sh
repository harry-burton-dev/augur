#!/usr/bin/env bash
# Proves one night's backup brings apps' files back with the database: loads the dump into a throwaway
# Postgres and Garage's metadata from the files' archive (objects-<date>.tar.gz) into a throwaway Garage,
# then checks every file the registry keeps a row for is in the frontends bucket. A row whose file didn't
# come back fails it: that app's frontend would not load after a restore. A file with no row is counted,
# not failed: the registry keeps an older build's files when a newer one replaces it, and a removed app's.
# It reads Garage's metadata alone, so it doesn't check the blocks under a file are on disk.
# Runs on a machine with Docker, curl and jq (CI, or a server's own host), never inside the backup
# container, which can't start Garage. Nothing live is touched: its containers, their volumes and its
# network are its own and go when it ends.
#   files-check.sh DUMP OBJECTS    e.g. backups/platform-2026-11-15.sql.gz backups/objects-2026-11-15.tar.gz
# Prints one line of JSON (ok, rows, missing, firstMissing, orphans, problem) and exits 1 unless ok.
set -euo pipefail

if [ "$#" != 2 ] || [ ! -f "$1" ] || [ ! -f "$2" ]; then
  echo "usage: files-check.sh DUMP OBJECTS, two files that are there (platform-<date>.sql.gz, objects-<date>.tar.gz)" >&2
  exit 2
fi
dump=$(realpath "$1")
objects=$(realpath "$2")
here=$(cd "$(dirname "$0")" && pwd)
compose="$here/../compose.yml"
# The images compose.yml runs the backup and Garage on.
image() { sed -n "/^  $1:/,/^  [a-z]/s/^    image: //p" "$compose" | head -n 1; }
pg_image=$(image backup)
garage_image=$(image garage)
# Where the storage service keeps apps' frontends (storage/src/config.ts, FRONTENDS_BUCKET).
: "${FRONTENDS_BUCKET:=augur-frontends}"

run=files-check-$$
keys=$(mktemp)
token=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
cleanup() {
  # -v: the database image declares a volume, which would keep a full copy of everyone's data.
  docker rm -fv "$run-pg" "$run-garage" >/dev/null 2>&1 || true
  docker volume rm "$run-meta" >/dev/null 2>&1 || true
  docker network rm "$run" >/dev/null 2>&1 || true
  rm -f "$keys"
}
trap cleanup EXIT

# said OK ROWS MISSING FIRST ORPHANS [PROBLEM]: the result, and the exit code.
said() {
  jq -cn --argjson ok "$1" --argjson rows "$2" --argjson missing "$3" --arg first "$4" --argjson orphans "$5" --arg problem "${6:-}" \
    '{ok: $ok, rows: $rows, missing: $missing, orphans: $orphans} + (if $first == "" then {} else {firstMissing: $first} end) + (if $problem == "" then {} else {problem: $problem} end)'
  [ "$1" = true ]
}
failed() { said false 0 0 "" 0 "$1"; exit 1; }

docker network create "$run" >/dev/null

# The dump, into a Postgres no one else can reach. Its errors are restore-test.sh's to judge; this needs the registry's rows.
docker run -d --name "$run-pg" --network "$run" -e POSTGRES_HOST_AUTH_METHOD=trust -v "$dump:/restore/dump.sql.gz:ro" "$pg_image" >/dev/null
ready=""
for _ in $(seq 120); do docker exec "$run-pg" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1 && ready=1 && break; sleep 1; done
[ -n "$ready" ] || failed "The throwaway Postgres didn't start."
docker exec "$run-pg" sh -c 'gunzip -c /restore/dump.sql.gz | psql -U postgres -d postgres -q -f - >/dev/null 2>&1' || true
q() { docker exec "$run-pg" psql -U postgres -d platform -v ON_ERROR_STOP=1 -tAc "$1"; }
[ "$(q "select to_regclass('registry.app_frontends') is not null" 2>/dev/null || echo f)" = t ] ||
  failed "$(basename "$dump") didn't bring back the registry's frontends (registry.app_frontends)."
# Every file a row names: apps/<app>/<folder>/<path>, as frontends.ts writes it. A row from before folders
# (019) is in its version's own; read through to_jsonb so a dump from before the column still reads.
q "select 'apps/' || app_id || '/' || coalesce(to_jsonb(a) ->> 'folder', version) || '/' || f from registry.app_frontends a, jsonb_array_elements_text(files) f order by 1" > "$keys" ||
  failed "The registry's frontends couldn't be read from $(basename "$dump")."
rows=$(grep -c . "$keys" || true)

# Garage's metadata, as Restore a lost server puts it back: the newest snapshot becomes its database. Its
# blocks aren't unpacked: a server's could be as large as its disk, and only the metadata is read.
docker volume create "$run-meta" >/dev/null
docker run --rm -v "$objects:/from.tar.gz:ro" -v "$run-meta:/r" --entrypoint sh "$pg_image" -c \
  'tar -xzf /from.tar.gz -C /r meta && snap=$(ls /r/meta/snapshots 2>/dev/null | sort | tail -n 1) && test -n "$snap" && cp "/r/meta/snapshots/$snap/db.sqlite" /r/meta/db.sqlite' ||
  failed "$(basename "$objects") holds no metadata snapshot of Garage's to restore."
docker run -d --name "$run-garage" --network "$run" -p 127.0.0.1::3903 \
  -e GARAGE_RPC_SECRET="$token" -e GARAGE_ADMIN_TOKEN="$token" \
  -v "$here/../garage/garage.toml:/etc/garage.toml:ro" -v "$run-meta:/var/lib/garage/meta" --tmpfs /var/lib/garage/data "$garage_image" >/dev/null
# Its admin port is published to this machine's loopback alone, and only for as long as this runs.
admin="http://$(docker port "$run-garage" 3903/tcp | head -n 1)"
api() { curl -fsS -G -H "Authorization: Bearer $token" "$admin/v2/$1" "${@:2}"; }
ready=""
for _ in $(seq 120); do api GetClusterHealth >/dev/null 2>&1 && ready=1 && break; sleep 1; done
[ -n "$ready" ] || failed "The throwaway Garage didn't start on $(basename "$objects")."

bucket=$(api GetBucketInfo --data-urlencode "globalAlias=$FRONTENDS_BUCKET" 2>/dev/null || true)
id=$(jq -r '.id // empty' <<< "${bucket:-null}")
if [ -z "$id" ]; then
  [ "$rows" = 0 ] || failed "The frontends bucket ($FRONTENDS_BUCKET) didn't come back, though the registry names $rows files in it."
  said true 0 0 "" 0
  exit 0
fi
missing=0 first=""
while read -r key; do
  [ -n "$key" ] || continue
  # A file is there when a finished, not deleted version of it is.
  if ! api InspectObject --data-urlencode "bucketId=$id" --data-urlencode "key=$key" 2>/dev/null |
      jq -e 'any(.versions[]; (.deleteMarker | not) and (.aborted | not) and (.uploading | not))' >/dev/null; then
    missing=$((missing + 1))
    [ -n "$first" ] || first=$key
  fi
done < "$keys"
# From Garage's own count of the bucket's objects, so approximate: no more than it, never below 0.
orphans=$(( $(jq -r '.objects // 0' <<< "$bucket") - (rows - missing) ))
[ "$orphans" -ge 0 ] || orphans=0

if [ "$missing" = 0 ]; then said true "$rows" 0 "" "$orphans"; else said false "$rows" "$missing" "$first" "$orphans" "$missing of the $rows files the registry names didn't come back."; fi
