#!/bin/sh
# Sets each file in $SECRETS_DIR as the environment variable it is named after, then runs the command it is given.
# For the services that read their secrets only from their environment (Keycloak, OpenFGA, Grafana):
# the make-secrets job writes each one its own folder (made-secrets.json; ADR 0107). Shell built-ins only, so it
# runs in any image with a shell. Each secret is one line.
set -eu
dir=${SECRETS_DIR:?set SECRETS_DIR to the folder of secrets}
found=''
for file in "$dir"/*; do
  [ -f "$file" ] || continue
  name=${file##*/}
  case $name in [!A-Z]* | *[!A-Z0-9_]*) continue ;; esac
  value=''
  IFS= read -r value < "$file" || true
  export "$name=$value"
  found=1
done
# Nothing there yet (make-secrets hasn't finished): stop, and let the restart policy try again, rather than run without them.
if [ -z "$found" ]; then
  echo "No secrets in $dir yet: the make-secrets job writes them. Check pc logs make-secrets." >&2
  exit 1
fi
exec "$@"
