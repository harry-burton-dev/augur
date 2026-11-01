#!/usr/bin/env bash
# Puts AUGUR through what a server does, with the real compose file and images, so a release that
# won't start, won't upgrade or can't go back is caught before anyone installs it. See docs/deploy-test.md.
#
#   infra/deploy-test.sh fresh                    # a new server on the images built from this checkout
#   infra/deploy-test.sh upgrade <from-version>   # that release first, with data, then this checkout, then back
#
# The images built from this checkout are tagged PLATFORM_VERSION=$LOCAL_TAG (default "ci"): build them
# first, with `docker compose -f infra/deploy/compose.yml -f infra/deploy/compose.build.yml build`,
# or let this script do it with BUILD=1. Tailscale isn't started: the front door is published on
# localhost:$WEB_PORT instead. Everything runs in its own compose project, which is removed at the end.
set -euo pipefail
export LC_ALL=C

mode=${1:?usage: infra/deploy-test.sh fresh | upgrade <from-version>}
from=${2:-}
here=$(cd "$(dirname "$0")" && pwd)
deploy="$here/deploy"
project=${PROJECT:-augur-deploy-test}
local_tag=${LOCAL_TAG:-ci}
port=${WEB_PORT:-8088}
timeout=${READY_TIMEOUT:-300}
work=$(mktemp -d)

# storage reads each app's secrets from infra/deploy/.env itself, so the test's settings go there.
# A real .env on this machine is put aside and put back afterwards.
if [ -e "$deploy/.env" ]; then mv "$deploy/.env" "$work/env.saved"; fi
cleanup() {
  local status=$?
  if [ "$status" != 0 ]; then
    echo "::group::State when it failed"
    pc ps -a || true
    pc logs --no-color --tail 80 || true
    echo "::endgroup::"
  fi
  pc down -v --remove-orphans >/dev/null 2>&1 || true
  rm -f "$deploy/.env"
  if [ -e "$work/env.saved" ]; then mv "$work/env.saved" "$deploy/.env"; fi
  rm -rf "$work"
  exit "$status"
}
trap cleanup EXIT

# Every secret in .env.example gets a new random value; the rest are what a small server would set.
sed -e '/^#/d' -e '/^$/d' "$deploy/.env.example" | while IFS='=' read -r key value; do
  case "$key" in
    PLATFORM_URL) value="http://localhost:$port" ;;
    TS_AUTHKEY) value=unused ;;
    PLATFORM_ADMIN_USER) value=deploy-test-admin ;;
    PLATFORM_ADMIN_EMAIL) value=deploy-test@example.org ;;
    PLATFORM_ADMIN_FIRST_NAME) value=Deploy ;;
    PLATFORM_ADMIN_LAST_NAME) value=Test ;;
    PLATFORM_VERSION) value=$local_tag ;;
    *) [ -z "$value" ] && value=$(openssl rand -hex 32) ;;
  esac
  echo "$key=$value"
done > "$deploy/.env"

cat > "$work/compose.test.yml" <<EOF
services:
  web:
    ports: ["127.0.0.1:$port:8080"]
EOF

pc() {
  docker compose -p "$project" -f "$deploy/compose.yml" -f "$deploy/compose.build.yml" -f "$work/compose.test.yml" --env-file "$deploy/.env" "$@"
}
set_version() { sed -i "s/^PLATFORM_VERSION=.*/PLATFORM_VERSION=$1/" "$deploy/.env"; }
services() { pc config --services | grep -vx tailscale; }

# Each service's /healthz, as the compose network sees it, from a container that has Node.
HEALTH='{"gateway":"http://gateway:8080","identity":"http://identity:8081","registry":"http://registry:8082","events":"http://events:8084","models":"http://models:8085","folio":"http://folio:8083","auspex":"http://auspex:8090","atlas":"http://atlas:8086"}'
probe() {
  pc exec -T gateway node -e '
    const urls = JSON.parse(process.argv[1]);
    Promise.all(Object.entries(urls).map(async ([name, url]) => {
      try { const r = await fetch(`${url}/healthz`); return [name, r.ok ? (await r.json()).version : `HTTP ${r.status}`]; }
      catch { return [name, "down"]; }
    })).then((rows) => console.log(JSON.stringify(Object.fromEntries(rows))));
  ' "$HEALTH" 2>/dev/null
}

# The front door serves the shell, sign-in and the pillar apps' frontends.
serving() {
  curl -fsS -o /dev/null "http://localhost:$port/" &&
    curl -fsS -o /dev/null "http://localhost:$port/sso/realms/platform/.well-known/openid-configuration" &&
    curl -fsS -o /dev/null "http://localhost:$port/apps/folio/entry.js" &&
    curl -fsS -o /dev/null "http://localhost:$port/apps/auspex/entry.js" &&
    curl -fsS -o /dev/null "http://localhost:$port/apps/atlas/entry.js"
}

# Waits until every service answers its /healthz and the front door serves; prints the versions they report.
wait_ready() {
  local label=$1 deadline=$((SECONDS + timeout)) versions=''
  while (( SECONDS < deadline )); do
    versions=$(probe || true)
    if [ -n "$versions" ] && jq -e 'to_entries | all(.value != "down" and (.value | startswith("HTTP") | not))' <<<"$versions" >/dev/null && serving; then
      echo "$label: ready after ${SECONDS}s" >&2
      echo "$versions"
      return 0
    fi
    sleep 5
  done
  echo "$label: not ready after ${timeout}s. Last answers: ${versions:-none}" >&2
  return 1
}

# Every AUGUR container runs the image it was meant to (the old ones aren't left running).
on_version() {
  local want=$1 wrong
  wrong=$(pc ps --format json | jq -rs --arg want ":$want" 'flatten | map(select(.Image | startswith("ghcr.io/")) | select(.Image | endswith($want) | not)) | map("\(.Service) runs \(.Image)") | .[]')
  if [ -n "$wrong" ]; then echo "Not on $want:"$'\n'"$wrong" >&2; return 1; fi
}

# A container that keeps restarting is a failure even when its neighbours look fine.
no_restarts() {
  local bad
  bad=$(pc ps -a --format json | jq -rs 'flatten | map(select((.Service != "storage") and ((.State != "running") or (.Health == "unhealthy")))) | map("\(.Service) is \(.State) \(.Status)") | .[]')
  if [ -n "$bad" ]; then echo "$bad" >&2; return 1; fi
}

# What's in the database: every table with its exact row count. Keycloak's own database isn't AUGUR's, so it's left out.
tables() {
  pc exec -T postgres psql -U platform -d platform -At -F' ' -c "
    select table_schema || '.' || table_name,
      (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
    from information_schema.tables
    where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema')" | sort
}

# Nothing that was there before may be gone or emptied.
kept() {
  local before=$1 after=$2 lost
  lost=$(join -a1 -e missing -o '0,1.2,2.2' "$before" "$after" | awk '$3 == "missing" || ($2 > 0 && $3 == 0) { print $1 " had " $2 " rows, now " $3 }')
  if [ -n "$lost" ]; then echo "Data lost:"$'\n'"$lost" >&2; return 1; fi
}

up() { pc up -d --no-build --remove-orphans $(services) >&2; }

if [ "${BUILD:-}" = 1 ]; then
  pc build $(services | grep -vx -e postgres -e backup -e garage -e keycloak -e docker-proxy) >&2
  # The build cache isn't needed again, and on a CI runner its space is.
  docker builder prune -af >/dev/null
fi

case "$mode" in
  fresh)
    set_version "$local_tag"
    up
    wait_ready "Fresh install of this checkout"
    no_restarts
    on_version "$local_tag"
    ;;
  upgrade)
    [ -n "$from" ] || { echo "upgrade needs the release to start from, such as 0.13.1" >&2; exit 2; }
    set_version "$from"
    pc pull --quiet $(services) >&2
    up
    old=$(wait_ready "augur@$from")
    no_restarts
    on_version "$from"
    tables > "$work/before"

    set_version "$local_tag"
    up
    new=$(wait_ready "Upgrade from augur@$from to this checkout")
    no_restarts
    tables > "$work/after"
    kept "$work/before" "$work/after"
    on_version "$local_tag"
    echo "Versions before: $old" >&2
    echo "Versions after:  $new" >&2

    # A server can always go back to the release it came from, so its tables must still work for it.
    set_version "$from"
    up
    wait_ready "Back to augur@$from" >/dev/null
    no_restarts
    on_version "$from"
    tables > "$work/back"
    kept "$work/after" "$work/back"
    ;;
  *) echo "usage: infra/deploy-test.sh fresh | upgrade <from-version>" >&2; exit 2 ;;
esac
echo "Deploy test ($mode) passed." >&2
