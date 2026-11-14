#!/usr/bin/env bash
# Puts AUGUR through what a server does, with the real compose file and images, so a release that
# won't start, won't upgrade or can't go back is caught before anyone installs it. See The deploy test in the AUGUR handbook, 03 Architecture/Engineering.
#
#   infra/deploy-test.sh fresh                    # a new server on the images built from this checkout
#   infra/deploy-test.sh upgrade <from-version>   # that release first, with data, then this checkout, then back
#   infra/deploy-test.sh broken                   # a fresh install with the updater, broken on purpose: its check must see it
#   STARTER_RELEASE=<file> infra/deploy-test.sh broken   # and then an app installed through the app runner (below)
#   THEN='<command>' infra/deploy-test.sh fresh   # a fresh install that allows sample data, with <command> run against it
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
# A shell as root on the deploy folder (at /d), for the files containers write as their own users: in Postgres's
# image, which the test pulls anyway. It reads the compose file, so only once .env is written.
helper_image=''
as_root() {
  if [ -z "$helper_image" ]; then helper_image=$(docker compose -f "$deploy/compose.yml" --env-file "$deploy/.env" config --format json | jq -er .services.postgres.image); fi
  docker run --rm -i -v "$deploy:/d" --entrypoint sh "$helper_image" -c "$1"
}

# storage reads each app's secrets from infra/deploy/.env itself, so the test's settings go there.
# A real .env on this machine is put aside and put back afterwards.
if [ -e "$deploy/.env" ]; then mv "$deploy/.env" "$work/env.saved"; fi
cleanup() {
  local status=$?
  if [ "$status" != 0 ]; then
    echo "::group::State when it failed"
    # pc exists only once .env is written; a failure before that has no containers to show.
    if declare -F pc >/dev/null; then
      pc ps -a || true
      pc logs --no-color --tail 80 || true
    fi
    if [ -n "${starter_id:-}" ]; then
      for app in $(docker ps -aq --filter "label=augur.app=$starter_id"); do docker logs --tail 40 "$app" 2>&1 | sed "s|^|$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$app") |" || true; done
    fi
    echo "::endgroup::"
  fi
  if [ -n "${starter_id:-}" ]; then starter_cleanup; fi
  pc down -v --remove-orphans >/dev/null 2>&1 || true
  # Its networks once AUGUR's own containers, which the runner joined to them, are gone.
  if [ -n "${starter_id:-}" ]; then docker network ls -q --filter "label=augur.app=$starter_id" | xargs -r docker network rm >/dev/null 2>&1 || true; fi
  if [ -n "${read_key_written:-}" ]; then
    as_root 'rm -f /d/secrets/github-read-key' >/dev/null 2>&1 || true
    if [ -e "$work/github-read-key.saved" ]; then as_root 'cat > /d/secrets/github-read-key' < "$work/github-read-key.saved" >/dev/null 2>&1 || true; fi
  fi
  rm -f "$deploy/.env"
  if [ -e "$work/env.saved" ]; then mv "$work/env.saved" "$deploy/.env"; fi
  # The backup container writes its files as its own user, so a container removes them.
  rm -rf "$work" 2>/dev/null || docker run --rm -v "$work:/w" --entrypoint rm postgres:16-alpine -rf /w/from >/dev/null 2>&1 || true
  rm -rf "$work" 2>/dev/null || true
  exit "$status"
}
trap cleanup EXIT
# What the app runner made of the test's app, which `pc down` doesn't know of: its containers and volumes (each
# labelled augur.app=<id>), and the apps folder, which the test made. Nothing of any other app: the test never
# starts when this machine has anything of that app already, or runs apps of its own.
starter_cleanup() {
  docker ps -aq --filter "label=augur.app=$starter_id" | xargs -r docker rm -f >/dev/null 2>&1 || true
  docker volume ls -q --filter "label=augur.app=$starter_id" | xargs -r docker volume rm >/dev/null 2>&1 || true
  if [ -n "$apps_made" ]; then as_root 'rm -rf /d/apps' >/dev/null 2>&1 || true; fi
}
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

# A command run against a fresh install (the run suite's dry run) seeds it first, so the install allows sample data.
if [ -n "${THEN:-}" ]; then echo 'SEED_ALLOWED=true' >> "$deploy/.env"; fi

# Broken mode runs the updater too (its profile), which reads the deploy folder at its path here and
# signs in with its own secret, as on a server that turned it on (docs/upgrade.md, "The updater").
# The updater runs Compose on the deploy folder itself, so .env names this test's project, as `-p` does here.
if [ "$mode" = broken ]; then
  export COMPOSE_PROFILES=updater
  printf 'COMPOSE_PROFILES=updater\nCOMPOSE_PROJECT_NAME=%s\nPLATFORM_DIR=%s\nUPDATER_CLIENT_SECRET=%s\n' "$project" "$deploy" "$(openssl rand -hex 32)" >> "$deploy/.env"
fi

# Sets one setting in .env, in place if it's there already.
set_env() {
  if grep -q "^$1=" "$deploy/.env"; then sed -i "s|^$1=.*|$1=$2|" "$deploy/.env"; else echo "$1=$2" >> "$deploy/.env"; fi
}
# Said plainly, and as a notice on the run in GitHub Actions.
notice() { if [ "${GITHUB_ACTIONS:-}" = true ]; then echo "::notice::$1" >&2; else echo "$1" >&2; fi; }

# Broken mode then installs an app through the app runner (the updater, with APP_SECRETS_KEY): STARTER_RELEASE is
# its release file, which the Deploy test workflow builds from the app template (Starter) and signs as itself, only
# on a branch the runner takes signatures from (main, release/<unit>-<major>.<minor>). The app is opened in the browser, its
# parts are stopped and its pane must say it failed, then it is removed and its sign-in must be refused. Its id and
# parts come from the release file. What keeps it from running here fails the run in GitHub Actions; by hand it is said, and the rest runs.
starter_id=''
starter_skip=''
apps_made=''
# Why the app runner's part can't run here. With STARTER_RELEASE set in GitHub Actions, that fails the run: the
# workflow asked for it. Elsewhere (by hand) it is said, and the rest of the mode runs.
cannot_run() {
  if [ "${GITHUB_ACTIONS:-}" = true ] && [ -n "${STARTER_RELEASE:-}" ]; then
    echo "::error::The app runner's part of the deploy test can't run: $1"
    exit 1
  fi
  starter_skip=$1
}
# The app's containers, volumes and networks: the runner labels each with augur.app=<id>.
app_things() {
  docker ps -aq --filter "label=augur.app=$1"
  docker volume ls -q --filter "label=augur.app=$1"
  docker network ls -q --filter "label=augur.app=$1"
}
if [ "$mode" = broken ]; then
  if [ -z "${STARTER_RELEASE:-}" ]; then
    if [ "${STARTER_SIGNED:-}" = false ]; then
      starter_skip="Starter isn't built on ${GITHUB_REF:-this ref}: the app runner trusts only signatures made on main or a release/<unit>-<major>.<minor> branch."
    elif [ -n "${STARTER_BUILD:-}" ]; then
      # Signed here, so it should have been built: the starter job says why it wasn't.
      echo "::error::The app runner's part of the deploy test can't run: building Starter ended ${STARTER_BUILD} (its job's log says why)."
      exit 1
    else
      starter_skip="STARTER_RELEASE isn't set, so there's no app to install (the Deploy test workflow builds Starter and sets it)."
    fi
  elif [ ! -s "$STARTER_RELEASE" ]; then
    echo "STARTER_RELEASE names $STARTER_RELEASE, which isn't there or is empty." >&2
    exit 1
  elif [ "${BROWSER_CHECK:-1}" != 1 ]; then
    cannot_run "BROWSER_CHECK=0, and opening the app is half of it."
  elif [ -e "$deploy/apps" ]; then
    cannot_run "$deploy/apps is there already: this deploy folder runs apps of its own, which the test leaves alone."
  elif [ -n "$(docker ps -aq --filter label=com.docker.compose.project=augur-apps)" ]; then
    cannot_run "this machine already runs apps (Compose project augur-apps), which the test leaves alone."
  elif [ -n "$(app_things "$(jq -er .id "$STARTER_RELEASE")")" ]; then
    cannot_run "this machine has containers, volumes or networks of $(jq -r .id "$STARTER_RELEASE") already, which the test leaves alone."
  fi
  if [ -z "$starter_skip" ]; then
    # Mounted into the browser check's container, so by its full path.
    STARTER_RELEASE=$(realpath "$STARTER_RELEASE")
    starter_id=$(jq -er .id "$STARTER_RELEASE")
    # Trust exactly the workflow the release says signed it: the runner still checks every signature names it.
    set_env APP_SECRETS_KEY "$(openssl rand -hex 32)"
    set_env APP_PUBLISHERS "$(jq -er '.signer | "\(.repository)/\(.workflow)"' "$STARTER_RELEASE")"
    # A beta is taken only by a preview server.
    set_env SERVER_RING preview
    # Private images: the read key the runner pulls and checks them with (STARTER_READ_KEY, and whose it is).
    if [ -n "${STARTER_READ_KEY:-}" ]; then
      set_env GITHUB_READ_USER "${STARTER_READ_USER:?STARTER_READ_KEY needs STARTER_READ_USER, the account it belongs to}"
      # Compose may have made secrets/ as root; the updater reads it as its own user.
      if [ -e "$deploy/secrets/github-read-key" ]; then as_root 'cat /d/secrets/github-read-key' > "$work/github-read-key.saved"; fi
      read_key_written=1
      printf %s "$STARTER_READ_KEY" | as_root 'mkdir -p /d/secrets && cat > /d/secrets/github-read-key && chmod 644 /d/secrets/github-read-key'
    fi
    # The runner writes the apps' project (compose.yml, state.json, files/) here as the updater's user. It wasn't
    # there (above), so the test made it and removes it.
    as_root 'mkdir -p /d/apps && chown 1000:1000 /d/apps && chmod 700 /d/apps'
    apps_made=1
  fi
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
  # Only a build from this checkout uses the build file: a release under test runs its published
  # images, as a server does, including the apps that ship with it (ADR 0049).
  if [ "${BUILD:-}" = 1 ] && [ "$dir" = "$deploy" ] && [ -e "$dir/compose.build.yml" ]; then files+=(-f "$dir/compose.build.yml"); fi
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

# Each service's /healthz, as the compose network sees it: every service whose healthcheck asks for one in
# the compose file in use, so a release's own parts, and the apps it ships, are what's probed.
health_urls() {
  pc config --format json | jq -c '[.services | to_entries[]
    | (.value.healthcheck.test // [] | tostring | capture("127\\.0\\.0\\.1:(?<port>[0-9]+)/healthz")) as $h
    | {key, value: "http://\(.key):\($h.port)"}] | from_entries'
}
# Asked from a container that has Node.
probe() {
  local health
  health=$(health_urls) || return 1
  pc exec -T gateway node -e '
    const urls = JSON.parse(process.argv[1]);
    Promise.all(Object.entries(urls).map(async ([name, url]) => {
      try { const r = await fetch(`${url}/healthz`); return [name, r.ok ? (await r.json()).version : `HTTP ${r.status}`]; }
      catch { return [name, "down"]; }
    })).then((rows) => console.log(JSON.stringify(Object.fromEntries(rows))));
  ' "$health" 2>/dev/null
}

# The front door serves the shell and sign-in.
serving() {
  curl -fsS -o /dev/null "http://localhost:$port/" &&
    curl -fsS -o /dev/null "http://localhost:$port/sso/realms/platform/.well-known/openid-configuration"
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

# The services that run once and stop: the compose file in use marks them `restart: on-failure`
# (storage, keycloak-config, backup-tools, knowledge-migrate, and whatever a release adds).
one_off_jobs() {
  pc config --format json | jq -c '[.services | to_entries[] | select((.value.restart // "") | startswith("on-failure")) | .key]'
}

# The containers that aren't running well, one "<service> is <state> <status>" line each: restarting,
# stopped or unhealthy, except a one-off job, which is well when it has exited with 0.
not_running() {
  pc ps -a --format json | jq -rs --argjson jobs "$(one_off_jobs)" 'flatten | map(select(if (.Service as $s | $jobs | index($s)) != null then (.State == "exited" and .ExitCode != 0) else ((.State != "running") or (.Health == "unhealthy")) end)) | map("\(.Service) is \(.State) \(.Status)") | .[]'
}

# A container that keeps restarting is a failure even when its neighbours look fine. Services named after
# the call are excused: the release before may have shipped one broken, which this release can't change.
no_restarts() {
  local bad excused
  bad=$(not_running)
  for excused in "$@"; do bad=$(grep -v "^$excused is " <<<"$bad" || true); done
  if [ -n "$bad" ]; then echo "$bad" >&2; return 1; fi
}

# The Keycloak version the deploy files in use run. Moving Keycloak to a new minor migrates its database,
# which can't be undone, so going back across one is a restore of Keycloak's database (docs/upgrade.md).
# AUGUR's Keycloak image is tagged with AUGUR's version, so the version is Keycloak's own image label,
# which AUGUR's image keeps; an image without it is told apart by its name.
keycloak_image() { pc config --format json | jq -r '.services.keycloak.image'; }
keycloak_version() {
  local image
  image=$(keycloak_image)
  docker image inspect --format '{{index .Config.Labels "version"}}' "$image" 2>/dev/null | grep . || echo "$image"
}
save_keycloak() { pc exec -T postgres pg_dump -U platform -d keycloak -Fc > "$work/keycloak.dump"; }
restore_keycloak() {
  echo "Keycloak moved from $1 to $2: going back restores its database from before the upgrade." >&2
  pc stop keycloak >&2
  pc exec -T postgres psql -U platform -d platform -v ON_ERROR_STOP=1 -c 'drop database keycloak with (force)' -c 'create database keycloak owner keycloak' >&2
  pc exec -T postgres pg_restore -U platform -d keycloak --no-owner --role=keycloak < "$work/keycloak.dump"
}

# The app ids a compose file's storage job retires (RETIRED_APPS, ADR 0075), one line. $1 is the deploy
# folder to read; run in a subshell so `pc` reads that folder's compose file and .env.
retired_in() (
  dir=$1
  pc config --format json | jq -r '.services.storage.environment.RETIRED_APPS // ""' | tr -s ' ,\n' ' '
)

# The apps this upgrade retires: named in this checkout's RETIRED_APPS and not in the release before's. Their
# data goes on this upgrade, as docs/upgrade.md says: the storage job drops their schemas (`<app>` and `<app>_jobs`,
# dashes as underscores) and the registry forgets them (migration 023). Once a release before also names them,
# nothing is excused, so an app installed later under one of those ids is guarded like any other.
retired_by_upgrade() {
  local id before
  before=" $(retired_in "$old_deploy") "
  for id in $(retired_in "$deploy"); do
    case "$before" in *" $id "*) ;; *) printf '%s ' "$id" ;; esac
  done
}

# What's in the database: every table with its exact row count. Keycloak's own database isn't AUGUR's, so it's
# left out, and so is what the upgrade takes away on purpose ($1, app ids from retired_by_upgrade): those apps'
# schemas, and their rows in any table that names apps (a text app_id column, or the registry's apps table),
# mirroring what migration 023 deletes, so that what is counted before the upgrade is what must still be there
# after it. The same list is used for every snapshot, so they are like for like.
tables() {
  local id schemas='' ids=''
  for id in $1; do
    ids+="$id,"
    schemas+="${id//-/_},${id//-/_}_jobs,"
  done
  ids="{${ids%,}}"
  schemas="{${schemas%,}}"
  pc exec -T postgres psql -U platform -d platform -At -F' ' -v ON_ERROR_STOP=1 -c "
    select t.table_schema || '.' || t.table_name,
      (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I where %s', t.table_schema, t.table_name,
        case
          when exists (select 1 from information_schema.columns c
                       where c.table_schema = t.table_schema and c.table_name = t.table_name
                         and c.column_name = 'app_id' and c.data_type in ('text', 'character varying'))
            then format('coalesce(app_id <> all (%L::text[]), true)', '$ids')
          when t.table_schema = 'registry' and t.table_name = 'apps' then format('coalesce(id <> all (%L::text[]), true)', '$ids')
          else 'true'
        end), false, true, '')))[1]::text
    from information_schema.tables t
    where t.table_type = 'BASE TABLE' and t.table_schema not in ('pg_catalog', 'information_schema')
      and t.table_schema <> all ('$schemas'::text[])" | sort
}

# Nothing that was there before may be gone or emptied.
kept() {
  local before=$1 after=$2 lost
  lost=$(join -a1 -e missing -o '0,1.2,2.2' "$before" "$after" | awk '$3 == "missing" || ($2 > 0 && $3 == 0) { print $1 " had " $2 " rows, now " $3 }')
  if [ -n "$lost" ]; then echo "Data lost:"$'\n'"$lost" >&2; return 1; fi
}

# Starts everything, and gives up after twice the ready timeout rather than wait for ever on a dependency that
# never comes good (a job that fails and restarts, a service never healthy): Compose would, and a run cancelled
# by its time limit dumps no state. On giving up, the containers not running well are named; cleanup dumps the rest.
up() {
  local starting watchdog
  pc up -d --no-build --remove-orphans $(services) >&2 &
  starting=$!
  ( sleep "$((timeout * 2))"; kill "$starting" 2>/dev/null ) &
  watchdog=$!
  if wait "$starting"; then
    kill "$watchdog" 2>/dev/null || true
    return 0
  fi
  kill "$watchdog" 2>/dev/null || true
  echo "Starting didn't finish in $((timeout * 2))s. Not running well:"$'\n'"$(not_running)" >&2
  return 1
}

# The first admin signs in in a real browser, and Home and each app that ships with AUGUR render with
# the kit from KIT_URL (infra/deploy-browser-check.mjs, in Playwright's own image). BROWSER_CHECK=0 skips it;
# BROWSER_CHECK_OUT keeps its screenshots.
PLAYWRIGHT=1.56.1
# Playwright's container running the check, with $1 as its output folder; the rest are docker run's options, then `--`
# and the check's app ids.
playwright() {
  local shots=$1 env=$deploy/.env options=()
  shift
  while [ "$#" -gt 0 ] && [ "$1" != -- ]; do options+=("$1"); shift; done
  shift
  docker run --rm --network host --ipc=host -e OUT=/out -v "$shots:/out" "${options[@]}" \
    -v "$here/deploy-browser-check.mjs:/check/check.mjs:ro" "mcr.microsoft.com/playwright:v$PLAYWRIGHT-noble" \
    sh -c 'cd /check && npm install --silent --no-save --no-audit --no-fund "playwright@$0" >/dev/null && node check.mjs "$@"' \
    "$PLAYWRIGHT" "http://localhost:$port" "$(sed -n 's/^PLATFORM_ADMIN_USER=//p' "$env")" "$(sed -n 's/^PLATFORM_ADMIN_PASSWORD=//p' "$env")" "$@" >&2
}
browser_check() {
  # It changes the first admin's password, which THEN's command still has to change itself.
  [ "${BROWSER_CHECK:-1}" = 1 ] && [ -z "${THEN:-}" ] || return 0
  local apps shots="${BROWSER_CHECK_OUT:-$work/browser-check}"
  apps=home
  mkdir -p "$shots"
  playwright "$shots" -- $apps
}

# The app's parts that keep running (its service and worker parts; a job part has run to its end), as the running
# containers the runner labels with the app and the part (augur.app, augur.part), matched by name exactly.
app_containers() {
  local id=$1 parts container part
  parts=$(jq -r '.parts[] | select(.metadata.annotations["augur.dev/part"] // "worker" | . != "job") | .metadata.name' "$STARTER_RELEASE")
  docker ps --filter "label=augur.app=$id" --filter label=com.docker.compose.project=augur-apps --format '{{.ID}} {{.Label "augur.part"}}' |
    while read -r container part; do
      if grep -qxF -- "$part" <<<"$parts"; then echo "$container"; fi
    done
}

# The app's own sign-in secret, as the runner works it out from APP_SECRETS_KEY: with the release's own updater code
# (dist/runner.js, appSecrets), in its container, from the .env it reads.
app_secret() {
  pc exec -T -e APP="$1" updater node --input-type=module -e '
    const { readFileSync } = await import("node:fs");
    const { appSecrets } = await import(new URL("dist/runner.js", `file://${process.cwd()}/`).href);
    const secrets = appSecrets(readFileSync(`${process.env.PLATFORM_DIR}/.env`, "utf8"), process.env.APP);
    if (!secrets) process.exit(3);
    process.stdout.write(secrets.signIn);'
}

# Broken mode's app (STARTER_RELEASE, above): the browser check installs it as the first admin and asks for its parts
# to be stopped by writing <id>.stop; they are stopped here, which writes <id>.stopped ("ok", or why not).
through_the_runner() {
  if [ -n "$starter_skip" ]; then notice "The app runner's part of the deploy test was skipped: $starter_skip"; return 0; fi
  # A release from before the runner took contract 3 releases can't install it: said, not failed, as broken mode does
  # for a release from before the check command, so testing an older release by hand still passes.
  if ! pc exec -T updater node -e 'process.exit(require("fs").readFileSync("dist/runner.js", "utf8").includes("export const appSecrets") ? 0 : 3)' >/dev/null 2>&1; then
    starter_skip="this release's updater can't install a release on app contract 3."
    notice "The app runner's part of the deploy test was skipped: $starter_skip"
    return 0
  fi
  local id=$starter_id name secret issuer shots="${BROWSER_CHECK_OUT:-$work/browser-check}" check status=0 containers=()
  name=$(jq -r '.manifest.name // .id' "$STARTER_RELEASE")
  secret=$(app_secret "$id")
  issuer=$(pc config --format json | jq -er '.services.updater.environment.OIDC_ISSUER')
  mkdir -p "$shots"
  rm -f "$shots/$id.stop" "$shots/$id.stopped"
  echo "Installing $name ($id) through the app runner, as the first admin." >&2
  playwright "$shots" -e APP_RELEASE=/check/release.json -e "ISSUER=$issuer" -e "APP_SECRET=$secret" -v "$STARTER_RELEASE:/check/release.json:ro" -- home &
  check=$!
  while kill -0 "$check" 2>/dev/null; do
    if [ -e "$shots/$id.stop" ] && [ ! -e "$shots/$id.stopped" ]; then
      mapfile -t containers < <(app_containers "$id")
      if [ "${#containers[@]}" = 0 ]; then
        echo "no running container of $id's service or worker parts" > "$shots/$id.stopped"
      elif docker stop "${containers[@]}" >&2; then
        echo "Stopped $name's ${#containers[@]} running part(s), as a crash would." >&2
        echo ok > "$shots/$id.stopped"
      else
        echo "docker stop failed" > "$shots/$id.stopped"
      fi
    fi
    sleep 2
  done
  wait "$check" || status=$?
  if [ "$status" != 0 ]; then echo "$name through the app runner: the browser check failed." >&2; return 1; fi
  echo "$name was installed, opened, stopped (its pane said so) and removed through the app runner, and its sign-in went with it." >&2
}

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
  local before after app calls=10
  # Any name that isn't one of AUGUR's services is an app's, installed or not (no app ships with AUGUR, ADR 0075).
  app=deploy-test-app
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

# The updater's safety backup before an upgrade, and the restore test it must pass, on this release's data:
# a release whose own backup doesn't restore would turn back every upgrade after it. An app's data that
# doesn't come back is reported, not failed, as on a server (ADR 0073).
backup_restores() {
  pc exec -T backup /bin/sh /backup/backup.sh --now >&2
  if ! pc exec -T backup /bin/sh /backup/backup.sh --restore-test >&2; then
    echo "$1: the backup didn't pass the restore test: $(pc exec -T backup cat /backups/status/restore-test.json 2>/dev/null)" >&2
    return 1
  fi
  said=$(pc exec -T backup cat /backups/status/restore-test.json)
  if [ "$(jq -r '.appsNotRestored // [] | length' <<< "$said")" != 0 ]; then
    echo "::warning::$1: these apps' data didn't all come back in the restore test: $(jq -c .appsNotRestored <<< "$said")" >&2
  fi
  echo "$1: the backup restored and checked." >&2
}

# BUILT=1 with BUILD=1: the images were built here by an earlier run of this script, so a second mode reuses them.
if [ "${BUILD:-}" = 1 ] && [ "${BUILT:-}" != 1 ]; then
  pc build $(services | grep -vx -e postgres -e backup -e backup-tools -e garage -e docker-proxy) >&2
  # The build cache isn't needed again, and on a CI runner its space is.
  docker builder prune -af >/dev/null
fi

case "$mode" in
  fresh)
    use "$local_tag"
    # IMAGES_OUT gets every image the release's compose file runs, third-party ones too, for the
    # vulnerability scan (Tailscale among them, though the test never starts it).
    if [ -n "${IMAGES_OUT:-}" ]; then pc config --images | sort -u > "$IMAGES_OUT"; fi
    up
    wait_ready "Fresh install of this checkout"
    no_restarts
    on_version "$local_tag"
    backup_restores "Fresh install of this checkout"
    browser_check
    # THEN runs once the install is ready, before it is removed, with its address and the first admin's
    # sign-in (whose password must be changed at first sign-in). Its exit status is the test's.
    if [ -n "${THEN:-}" ]; then
      setting() { grep -m1 "^$1=" "$deploy/.env" | cut -d= -f2-; }
      echo "Running against the fresh install: $THEN" >&2
      AUGUR_URL="http://localhost:$port" AUGUR_ADMIN_USER=$(setting PLATFORM_ADMIN_USER) AUGUR_ADMIN_PASSWORD=$(setting PLATFORM_ADMIN_PASSWORD) bash -c "$THEN"
      no_restarts
    fi
    ;;
  upgrade)
    [ -n "$from" ] || { echo "upgrade needs the release to start from, such as 0.13.1" >&2; exit 2; }
    use "$from"
    up
    old=$(wait_ready "augur@$from")
    # The release before is judged by its own deploy test. What it shipped broken is reported and excused
    # on it (here and going back), never on this release.
    sleep 15
    broken_before=$(not_running | cut -d' ' -f1)
    if [ -n "$broken_before" ]; then
      echo "::warning::augur@$from runs with these not running well, excused on it: $(echo $broken_before)" >&2
      not_running >&2
    fi
    on_version "$from"
    retired=$(retired_by_upgrade)
    if [ -n "$retired" ]; then echo "This checkout retires ${retired% }(RETIRED_APPS): their schemas and the registry's rows for them are expected to go, and aren't counted." >&2; fi
    tables "$retired" > "$work/before"
    keycloak_from=$(keycloak_version)
    save_keycloak

    use "$local_tag"
    up
    keycloak_to=$(keycloak_version)
    new=$(wait_ready "Upgrade from augur@$from to this checkout")
    no_restarts
    tables "$retired" > "$work/after"
    kept "$work/before" "$work/after"
    on_version "$local_tag"
    backup_restores "Upgrade from augur@$from to this checkout"
    echo "Versions before: $old" >&2
    echo "Versions after:  $new" >&2

    # A server can always go back to the release it came from, so its tables must still work for it.
    echo "Going back to augur@$from." >&2
    use "$from"
    if [ "$keycloak_from" != "$keycloak_to" ]; then restore_keycloak "$keycloak_from" "$keycloak_to"; fi
    up
    wait_ready "Back to augur@$from" >/dev/null
    # shellcheck disable=SC2086 # one service name per word
    no_restarts $broken_before
    on_version "$from"
    tables "$retired" > "$work/back"
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
    through_the_runner
    # Installing and removing an app leaves AUGUR's own parts as they were.
    no_restarts
    ;;
  *) echo "usage: infra/deploy-test.sh fresh | upgrade <from-version> | broken" >&2; exit 2 ;;
esac
echo "Deploy test ($mode) passed." >&2
