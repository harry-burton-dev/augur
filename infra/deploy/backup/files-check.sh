#!/usr/bin/env bash
# Proves one night's backup brings apps' files back with the database: loads the dump into a throwaway
# Postgres and the files (objects-<date>.tar.gz) into a throwaway Garage, then checks every file the
# registry keeps a row for is in the frontends bucket. A row whose file didn't come back fails it: that
# app's frontend would not load after a restore. A file with no row is counted, not failed: the registry
# keeps an older build's files when a newer one replaces it, and a removed app's, so these are expected.
# Runs on a machine with Docker, curl and jq (CI, the deploy test, or a server's own host), never inside the
# backup container, which can't start Garage. Nothing live is touched: its containers, network and volume
# are its own and go when it ends.
#   files-check.sh DUMP OBJECTS    e.g. backups/platform-2026-11-15.sql.gz backups/objects-2026-11-15.tar.gz
# Prints one line of JSON (ok, rows, missing, firstMissing, orphans) and exits 1 when a file is missing.
set -euo pipefail

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
  docker rm -f "$run-pg" "$run-garage" >/dev/null 2>&1 || true
  docker volume rm "$run-objects" >/dev/null 2>&1 || true
  docker network rm "$run" >/dev/null 2>&1 || true
  rm -f "$keys"
}
trap cleanup EXIT
docker network create "$run" >/dev/null

# The dump, into a Postgres no one else can reach. Its errors are restore-test.sh's to judge; this only reads the rows.
docker run -d --name "$run-pg" --network "$run" -e POSTGRES_HOST_AUTH_METHOD=trust -v "$dump:/restore/dump.sql.gz:ro" "$pg_image" >/dev/null
for _ in $(seq 60); do docker exec "$run-pg" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1 && break; sleep 1; done
docker exec "$run-pg" sh -c 'gunzip -c /restore/dump.sql.gz | psql -U postgres -d postgres -q -f - >/dev/null 2>&1' || true

# The files, as Restore a lost server puts them back: the newest metadata snapshot becomes Garage's database.
docker volume create "$run-objects" >/dev/null
docker run --rm -v "$objects:/from.tar.gz:ro" -v "$run-objects:/r" --entrypoint sh "$pg_image" -c \
  'tar -xzf /from.tar.gz -C /r && snap=$(ls /r/meta/snapshots 2>/dev/null | sort | tail -n 1) && test -n "$snap" && cp "/r/meta/snapshots/$snap/db.sqlite" /r/meta/db.sqlite'
docker run -d --name "$run-garage" --network "$run" -p 127.0.0.1::3903 \
  -e GARAGE_RPC_SECRET="$token" -e GARAGE_ADMIN_TOKEN="$token" \
  -v "$here/../garage/garage.toml:/etc/garage.toml:ro" \
  -v "$run-objects:/var/lib/garage" "$garage_image" >/dev/null
# Its admin port is published to this machine's loopback alone, and only for as long as this runs.
admin="http://$(docker port "$run-garage" 3903/tcp | head -n 1)"
api() { curl -fsS -G -H "Authorization: Bearer $token" "$admin/v2/$1" "${@:2}"; }
for _ in $(seq 60); do api GetClusterHealth >/dev/null 2>&1 && break; sleep 1; done

# Every file a row names: apps/<app>/<folder>/<path>, as frontends.ts writes it.
docker exec "$run-pg" psql -U postgres -d platform -tAc \
  "select 'apps/' || app_id || '/' || coalesce(folder, version) || '/' || f from registry.app_frontends, jsonb_array_elements_text(files) f order by 1" \
  > "$keys" 2>/dev/null || : > "$keys"
rows=$(grep -c . "$keys" || true)

bucket=$(api GetBucketInfo --data-urlencode "globalAlias=$FRONTENDS_BUCKET" 2>/dev/null || echo '{}')
id=$(jq -r '.id // empty' <<< "$bucket")
stored=$(jq -r '.objects // 0' <<< "$bucket")
missing=0 first=""
while read -r key; do
  [ -n "$key" ] || continue
  # A file is there when a finished, not deleted version of it is.
  if [ -z "$id" ] || ! api InspectObject --data-urlencode "bucketId=$id" --data-urlencode "key=$key" 2>/dev/null |
      jq -e 'any(.versions[]; (.deleteMarker | not) and (.aborted | not) and (.uploading | not))' >/dev/null; then
    missing=$((missing + 1))
    [ -n "$first" ] || first=$key
  fi
done < "$keys"
orphans=$((stored - (rows - missing)))
[ "$orphans" -ge 0 ] || orphans=0

ok=true
[ "$missing" = 0 ] || ok=false
jq -cn --argjson ok "$ok" --argjson rows "$rows" --argjson missing "$missing" --arg first "$first" --argjson orphans "$orphans" \
  '{ok: $ok, rows: $rows, missing: $missing, orphans: $orphans} + (if $first == "" then {} else {firstMissing: $first} end)'
[ "$ok" = true ]
