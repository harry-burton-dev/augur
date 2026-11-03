#!/usr/bin/env bash
# Puts AUGUR through what a server does, with the real compose file and images, so a release that
# won't start, won't upgrade or can't go back is caught before anyone installs it. See docs/deploy-test.md.
#
#   infra/deploy-test.sh fresh                    # a new server on the images built from this checkout
#   infra/deploy-test.sh upgrade <from-version>   # that release first, with data, then this checkout, then back
#   infra/deploy-test.sh broken                   # a fresh install with the updater, broken on purpose: its check must see it
#
# The release under test is PLATFORM_VERSION=$LOCAL_TAG: a published release's version, whose images
# are pulled, or (default "ci") images built from this checkout first, which BUILD=1 does. Tailscale isn't started: the front door is published on
# localhost:$WEB_PORT instead. Everything runs in its own compose project, which is removed at the end.
set -euo pipefail
export LC_ALL=C

mode=${1:?usage: infra/deploy-test.sh fresh | upgrade <from-version> | broken}
from=${2:-}
here=$(cd "$(dirname "$0")" && pwd)
deploy="$here/deploy"
dir=$deploy
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
  # The backup container writes its files as its own user, so a container removes them.
  rm -rf "$work" 2>/dev/null || docker run --rm -v "$work:/w" --entrypoint rm postgres:16-alpine -rf /w/from >/dev/null 2>&1 || true
  rm -rf "$work" 2>/dev/null || true
  exit "$status"
}
trap cleanup EXIT

# Every secret in .env.example gets a new random value; the rest are what a small server would set.
# An upgrade starts from the release's own deploy files, as a server that checked out its tag has them.
dir=$deploy
if [ "$mode" = upgrade ] && [ -n "$from" ]; then
  tag="augur@$from"
  git -C "$here/.." rev-parse -q --verify "refs/tags/$tag" >/dev/null || git -C "$here/.." fetch -q --depth=1 origin "refs/tags/$tag:refs/tags/$tag"
  mkdir -p "$work/from"
  git -C "$here/.." archive "$tag" infra/deploy | tar -x -C "$work/from"
fi
old_deploy="$work/from/infra/deploy"

# Both releases' settings, the newer one's first: an admin adds the new keys before upgrading.
cat "$deploy/.env.example" $( [ -e "$old_deploy/.env.example" ] && echo "$old_deploy/.env.example" ) |
  sed -e '/^#/d' -e '/^$/d' | awk -F= '!seen[$1]++' | while IFS='=' read -r key value; do
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

# Broken mode runs the updater too (its profile), which reads the deploy folder at its path here and
# signs in with its own secret, as on a server that turned it on (docs/upgrade.md, "The updater").
if [ "$mode" = broken ]; then
  export COMPOSE_PROFILES=updater
  printf 'COMPOSE_PROFILES=updater\nPLATFORM_DIR=%s\nUPDATER_CLIENT_SECRET=%s\n' "$deploy" "$(openssl rand -hex 32)" >> "$deploy/.env"
fi

cat > "$work/compose.test.yml" <<EOF
services:
  web:
    ports: ["127.0.0.1:$port:8080"]
EOF

# Compose on the deploy files in use: this checkout's, or the old release's. Volumes are named after
# the project, so both see the same data, as on a server.
pc() {
  local files=(-f "$dir/compose.yml")
  [ -e "$dir/compose.build.yml" ] && files+=(-f "$dir/compose.build.yml")
  docker compose -p "$project" "${files[@]}" -f "$work/compose.test.yml" --env-file "$dir/.env" "$@"
}
# Which release's deploy files and images to run: this checkout's, or the one it upgrades from.
use() {
  if [ "$1" = "$local_tag" ]; then dir=$deploy; else dir=$old_deploy; cp "$deploy/.env" "$dir/.env"; fi
  sed -i "s/^PLATFORM_VERSION=.*/PLATFORM_VERSION=$1/" "$dir/.env"
  # A release's images come from the registry; images built here with BUILD=1 are already local.
  if [ "${BUILD:-}" != 1 ] || [ "$1" != "$local_tag" ]; then pc pull --quiet $(services) >&2; fi
}
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
  local label=$1 start=$SECONDS deadline=$((SECONDS + timeout)) versions=''
  while (( SECONDS < deadline )); do
    versions=$(probe || true)
    if [ -n "$versions" ] && jq -e 'to_entries | all(.value != "down" and (.value | startswith("HTTP") | not))' <<<"$versions" >/dev/null && serving; then
      echo "$label: ready after $((SECONDS - start))s" >&2
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
  bad=$(pc ps -a --format json | jq -rs 'flatten | map(select((.Service != "storage") and (.Service != "keycloak-config") and ((.State != "running") or (.Health == "unhealthy")))) | map("\(.Service) is \(.State) \(.Status)") | .[]')
  if [ -n "$bad" ]; then echo "$bad" >&2; return 1; fi
}

# Keycloak's image in the deploy files in use. Moving Keycloak to a new minor migrates its database,
# which can't be undone, so going back across one is a restore of Keycloak's database (docs/upgrade.md).
keycloak_image() { pc config --format json | jq -r '.services.keycloak.image'; }
save_keycloak() { pc exec -T postgres pg_dump -U platform -d keycloak -Fc > "$work/keycloak.dump"; }
restore_keycloak() {
  echo "Keycloak moved from $1 to $2: going back restores its database from before the upgrade." >&2
  pc stop keycloak >&2
  pc exec -T postgres psql -U platform -d platform -v ON_ERROR_STOP=1 -c 'drop database keycloak with (force)' -c 'create database keycloak owner keycloak' >&2
  pc exec -T postgres pg_restore -U platform -d keycloak --no-owner --role=keycloak < "$work/keycloak.dump"
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

# One look of the updater's watch after an upgrade (node dist/index.js check), again until it says what's
# wanted: `pass`, or `fail <part>`, which must be named among the problems. Its exit code must agree.
check_until() {
  local label=$1 want=$2 part=${3:-} deadline=$((SECONDS + timeout)) said='' status
  while (( SECONDS < deadline )); do
    status=0
    said=$(pc exec -T updater node dist/index.js check 2>/dev/null | tail -n1) || status=$?
    if jq -e --argjson code "$status" --arg want "$want" --arg part "$part" '
        if $want == "pass" then .ok and $code == 0
        else (.ok | not) and $code == 1 and any(.problems[]; startswith($part + " ")) end' <<<"$said" >/dev/null 2>&1; then
      echo "$label: the updater's check says $said" >&2
      return 0
    fi
    sleep 5
  done
  echo "$label: the updater's check didn't $want${part:+ on $part} within ${timeout}s. It said: ${said:-nothing}" >&2
  return 1
}

# The gateway's own count of calls (GET /traffic, reached only inside the network), as the watch reads it.
traffic() {
  pc exec -T gateway node -e 'fetch("http://localhost:8080/traffic?minutes=15").then((r) => r.text()).then(console.log)'
}

# An app's calls are counted apart from AUGUR's own, so an app answering errors can't send AUGUR back:
# calls to an app's API through the front door land under apps, not platform. Without a signed-in
# person the gateway answers them itself (401), which is enough to see where they're counted.
counted_apart() {
  local before after app=folio calls=10
  before=$(traffic)
  for _ in $(seq "$calls"); do curl -s -o /dev/null "http://localhost:$port/api/$app/healthz" || true; done
  after=$(traffic)
  if ! jq -en --argjson b "$before" --argjson a "$after" --argjson n "$calls" \
      '($a.apps.requests - $b.apps.requests) >= $n and ($a.platform.requests - $b.platform.requests) < $n' >/dev/null; then
    echo "Calls to /api/$app weren't counted as an app's. Before: $before After: $after" >&2
    return 1
  fi
  echo "The gateway counted $calls calls to /api/$app under apps, not platform." >&2
}

if [ "${BUILD:-}" = 1 ]; then
  pc build $(services | grep -vx -e postgres -e backup -e garage -e keycloak -e docker-proxy) >&2
  # The build cache isn't needed again, and on a CI runner its space is.
  docker builder prune -af >/dev/null
fi

case "$mode" in
  fresh)
    use "$local_tag"
    up
    wait_ready "Fresh install of this checkout"
    no_restarts
    on_version "$local_tag"
    ;;
  upgrade)
    [ -n "$from" ] || { echo "upgrade needs the release to start from, such as 0.13.1" >&2; exit 2; }
    use "$from"
    up
    old=$(wait_ready "augur@$from")
    no_restarts
    on_version "$from"
    tables > "$work/before"
    keycloak_from=$(keycloak_image)
    save_keycloak

    use "$local_tag"
    keycloak_to=$(keycloak_image)
    up
    new=$(wait_ready "Upgrade from augur@$from to this checkout")
    no_restarts
    tables > "$work/after"
    kept "$work/before" "$work/after"
    on_version "$local_tag"
    echo "Versions before: $old" >&2
    echo "Versions after:  $new" >&2

    # A server can always go back to the release it came from, so its tables must still work for it.
    use "$from"
    if [ "$keycloak_from" != "$keycloak_to" ]; then restore_keycloak "$keycloak_from" "$keycloak_to"; fi
    up
    wait_ready "Back to augur@$from" >/dev/null
    no_restarts
    on_version "$from"
    tables > "$work/back"
    kept "$work/after" "$work/back"
    ;;
  broken)
    use "$local_tag"
    up
    wait_ready "Fresh install of this checkout, with the updater" >/dev/null
    no_restarts
    on_version "$local_tag"
    # A release from before the check command can't be broken this way: said, not failed.
    if ! pc run --rm --no-deps -T --entrypoint node updater -e 'process.exit(require("fs").readFileSync("dist/upgrade.js", "utf8").includes("checkOnce") ? 0 : 3)' >/dev/null 2>&1; then
      echo "This release's updater has no check command (node dist/index.js check), so broken mode was skipped." >&2
      exit 0
    fi
    check_until "As installed" pass
    # What an upgrade can leave behind: a part that doesn't come back.
    pc stop identity >&2
    check_until "With identity stopped" fail identity
    counted_apart
    pc start identity >&2
    check_until "With identity back" pass
    no_restarts
    ;;
  *) echo "usage: infra/deploy-test.sh fresh | upgrade <from-version> | broken" >&2; exit 2 ;;
esac
echo "Deploy test ($mode) passed." >&2
