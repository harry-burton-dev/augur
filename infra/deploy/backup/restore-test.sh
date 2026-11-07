#!/bin/sh
# Proves the newest backup can be restored: loads it into a throwaway Postgres
# inside this container, checks the platform's and Keycloak's tables came back,
# then throws it away. The live database is never touched.
#   restore-test.sh             the newest backup on this server
#   restore-test.sh --offsite   the newest one in the off-server copy (ADR 0060), fetched with restic
#                               into the scratch folder first: proves the copy, not only the local file
# Writes the result to $STATUS_DIR/restore-test.json (backups/status/), which Admin's Status reads; `from` says which.
set -eu
# The database's image runs Debian's sh (dash), which has no pipefail, so the script runs itself in bash.
(set -o pipefail) 2>/dev/null || exec bash "$0" "$@"
set -o pipefail
: "${BACKUP_DIR:=/backups}"
umask 077
# Results for Admin's Status go in a folder of their own, the only part of the backups the gateway sees
# (compose.yml). The backups themselves are readable by root alone (umask 077); the results by anyone.
: "${STATUS_DIR:=$BACKUP_DIR/status}"
export STATUS_DIR
# status_written NAME: puts NAME.partial in place as the status folder's NAME.
status_written() {
  mkdir -p "$STATUS_DIR" && chmod 755 "$STATUS_DIR"
  chmod 644 "$STATUS_DIR/$1.partial"
  mv "$STATUS_DIR/$1.partial" "$STATUS_DIR/$1"
}
: "${OFFSITE_HOST:=augur}"

started=$(date -u +%s)
from=local
[ "${1:-}" = "--offsite" ] && from=offsite
file=""
scratch=""

# result OK PROBLEM [FACTS]: writes restore-test.json for Status.
result() {
  ended=$(date -u +%s)
  {
    printf '{"at":"%s","from":"%s","file":"%s","ok":%s,"seconds":%s' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$from" "$(basename "${file:-none}")" "$1" "$((ended - started))"
    [ -n "$2" ] && printf ',"problem":"%s"' "$2"
    [ -n "${3:-}" ] && printf ',%s' "$3"
    printf '}\n'
  } > "$STATUS_DIR/restore-test.json.partial"
  status_written restore-test.json
  if [ "$1" = true ]; then echo "restore-test: $(basename "$file") ($from) restored and checked"; else echo "restore-test: FAILED: $2" >&2; fi
}

cleanup() {
  if [ -n "$scratch" ]; then
    su postgres -c "PATH='$PATH' pg_ctl -D $scratch/data -m immediate stop" >/dev/null 2>&1 || true
    rm -rf "$scratch"
  fi
}
trap cleanup EXIT

scratch=$(mktemp -d)
chown postgres "$scratch"

if [ "$from" = offsite ]; then
  # The newest database dump in the off-server copy, as restic restores it: under its path on this server.
  if ! restic restore latest --host "$OFFSITE_HOST" --tag augur-db --target "$scratch/offsite" >/dev/null 2>"$scratch/restic-errors"; then
    result false "The off-server copy could not be fetched back: $(tail -n 1 "$scratch/restic-errors" | tr -d '"\\' | cut -c1-200)"
    exit 1
  fi
  file=$(find "$scratch/offsite" -name 'platform-*.sql.gz' 2>/dev/null | sort | tail -n 1)
else
  file=$(ls -1 "$BACKUP_DIR"/platform-*.sql.gz 2>/dev/null | sort | tail -n 1 || true)
fi

if [ -z "$file" ]; then
  result false "There is no backup to restore yet."
  exit 1
fi
# Listens only on a socket in the scratch folder, so nothing else can reach it.
if ! su postgres -c "PATH='$PATH' initdb -D $scratch/data -U postgres --auth=trust" >/dev/null 2>&1 ||
  ! printf "listen_addresses = ''\nunix_socket_directories = '%s'\n" "$scratch" >> "$scratch/data/postgresql.conf" ||
  ! su postgres -c "PATH='$PATH' pg_ctl -D $scratch/data -w start" >/dev/null 2>&1; then
  result false "A scratch database could not be started to restore into."
  exit 1
fi

q() { psql -h "$scratch" -U postgres -d "$1" -tAc "$2"; }

# The dump drops and recreates each database itself, so it runs to the end
# (ON_ERROR_STOP would stop it at the first error, even an expected one) and
# what went wrong is read from the errors afterwards.
if ! gunzip -c "$file" | psql -h "$scratch" -U postgres -d postgres -q >/dev/null 2>"$scratch/errors"; then
  result false "$(basename "$file") could not be read back in."
  exit 1
fi

# real_errors FILE: the errors that mean something didn't come back. Dropping what isn't there only gives
# notices (--if-exists). This container runs the database's own image, pgvector included, so apps'
# vector columns come back like any other.
real_errors() {
  grep -E '(^|: )(ERROR|FATAL|PANIC|error):' "$1" || true
}

# AUGUR's own schemas in its database. Any other schema there is an app's: <id>, and <id>_jobs for its jobs.
: "${PLATFORM_SCHEMAS:=public identity registry events models pg_catalog}"

# whose DUMP ERRORS: each of ERRORS (psql's, one a line) as "<whose><tab><error>": the app whose schema
# the failing statement was in, or "augur" for AUGUR's own (its schemas, Keycloak's database, logins,
# and anything it can't tell). psql names the dump's line each error was at; the statement there, or
# the COPY it was in, names the schema.
whose() {
  printf '%s\n' "$2" > "$scratch/real-errors"
  gunzip -c "$1" | awk -v errs="$scratch/real-errors" -v platform=" $PLATFORM_SCHEMAS " '
    function owner() {
      if (db != "platform" || schema == "" || index(platform, " " schema " ")) return "augur"
      app = schema
      sub(/_jobs$/, "", app)
      gsub(/_/, "-", app)
      return app
    }
    function say(line) {
      if (!(line in want)) return
      n = split(want[line], each, "\n")
      for (i = 1; i <= n; i++) print owner() "\t" each[i]
      delete want[line]
    }
    BEGIN {
      while ((getline e < errs) > 0) {
        if (e == "") continue
        if (match(e, /^psql:[^:]*:[0-9]+:/)) {
          at = substr(e, 1, RLENGTH - 1)
          sub(/^.*:/, "", at)
          at += 0
          # Tested before it is set: setting it first would make it look there already.
          if (at in want) want[at] = want[at] "\n" e
          else want[at] = e
        } else print "augur\t" e
      }
    }
    copying {
      if ($0 == "\\.") copying = 0
      say(NR)
      next
    }
    /^\\connect / {
      db = $2
      gsub(/"/, "", db)
      schema = ""
    }
    /^[A-Z]/ {
      schema = ""
      if (match($0, /SCHEMA [a-z_][a-z0-9_]*/)) schema = substr($0, RSTART + 7, RLENGTH - 7)
      else if (match($0, /[a-z_][a-z0-9_]*\.[a-z_"]/)) schema = substr($0, RSTART, RLENGTH - 2)
      if ($0 ~ /^COPY / && $0 ~ /FROM stdin;$/) copying = 1
    }
    { say(NR) }
    END { for (line in want) { n = split(want[line], each, "\n"); for (i = 1; i <= n; i++) print "augur\t" each[i] } }
  '
}

# first_error ERRORS: the first of them, safe inside JSON.
first_error() { printf '%s\n' "$1" | head -n 1 | sed 's/^psql:[^:]*:[0-9]*: //' | tr -d '"\\\t' | cut -c1-200; }

errors=$(real_errors "$scratch/errors")
# An app's data that doesn't come back is that app's to fix, and never stops AUGUR's upgrade (ADR 0073):
# it's reported for the app, and only AUGUR's own errors fail the test.
not_restored=""
if [ -n "$errors" ]; then
  owned=$(whose "$file" "$errors")
  ours=$(printf '%s\n' "$owned" | awk -F '\t' '$1 == "augur" { sub(/^[^\t]*\t/, ""); print }')
  if [ -n "$ours" ]; then
    result false "$(basename "$file") came back with errors ($(printf '%s\n' "$ours" | wc -l | tr -d ' ')), the first: $(first_error "$ours")"
    exit 1
  fi
  for app in $(printf '%s\n' "$owned" | cut -f1 | sort -u); do
    theirs=$(printf '%s\n' "$owned" | awk -F '\t' -v app="$app" '$1 == app { sub(/^[^\t]*\t/, ""); print }')
    entry=$(printf '{"app":"%s","errors":%s,"problem":"%s"}' "$app" "$(printf '%s\n' "$theirs" | wc -l | tr -d ' ')" "$(first_error "$theirs")")
    not_restored="${not_restored:+$not_restored,}$entry"
    echo "restore-test: $app's data didn't all come back: $(first_error "$theirs")" >&2
  done
fi

missing=""
for table in registry.apps events.audit events.notifications identity.preferences; do
  [ "$(q platform "select to_regclass('$table') is not null" 2>/dev/null || echo f)" = t ] || missing="$missing $table"
done
[ "$(q keycloak "select to_regclass('public.user_entity') is not null" 2>/dev/null || echo f)" = t ] || missing="$missing keycloak.user_entity"
if [ -n "$missing" ]; then
  result false "These tables did not come back:$missing."
  exit 1
fi

apps=$(q platform "select count(*) from registry.apps")
audit=$(q platform "select count(*) from events.audit")
people=$(q keycloak "select count(*) from user_entity where realm_id = (select id from realm where name = 'platform')")
if [ "$people" -lt 1 ]; then
  result false "Sign-in came back with nobody in it." "\"people\":$people,\"apps\":$apps,\"auditEntries\":$audit"
  exit 1
fi
result true "" "\"people\":$people,\"apps\":$apps,\"auditEntries\":$audit${not_restored:+,\"appsNotRestored\":[$not_restored]}"
