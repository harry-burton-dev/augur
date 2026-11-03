#!/usr/bin/env bash
# Lays out one app that ships with AUGUR, as release/shipped-apps.json pins it, from its release's service
# image, for running beside the shell without its source (the contract tests, `pnpm dev:app` with DEV_ALSO):
#   infra/shipped-app.sh <id> [<dir>]      (default .shipped/apps/<id>)
# <dir>/manifest.json, <dir>/frontend/dist (its built frontend) and <dir>/service (its built service:
# node <dir>/service/dist/index.js). Checks who signed the release as the Release workflow does (ADR 0049).
# Reading the app's release and image needs APP_RELEASES_TOKEN and PACKAGES_READ_TOKEN, or a GitHub CLI
# and Docker signed in as someone who can read them.
set -euo pipefail
id=$1
dir=${2:-.shipped/apps/$id}
release=$(node scripts/shipped-apps.mjs resolve | jq -e --arg id "$id" '.[$id]') || { echo "$id isn't in release/shipped-apps.json." >&2; exit 1; }
image=$(jq -r .service <<< "$release")
config=$(mktemp -d)
if [ -n "${PACKAGES_READ_TOKEN:-}" ]; then
  printf %s "$PACKAGES_READ_TOKEN" | tr -d '\r\n' | DOCKER_CONFIG=$config docker login ghcr.io -u augur --password-stdin >&2
elif [ -f "${DOCKER_CONFIG:-$HOME/.docker}/config.json" ]; then
  cp "${DOCKER_CONFIG:-$HOME/.docker}/config.json" "$config/config.json"
fi
if command -v cosign > /dev/null; then
  DOCKER_CONFIG=$config cosign verify --certificate-identity "$(jq -r .identity <<< "$release")" \
    --certificate-oidc-issuer https://token.actions.githubusercontent.com "$image" > /dev/null
else
  echo "cosign isn't installed, so $id's signature isn't checked." >&2
fi
container=$(DOCKER_CONFIG=$config docker create "$image")
trap 'docker rm "$container" > /dev/null' EXIT
rm -rf "$dir" && mkdir -p "$dir/frontend"
docker cp "$container:/app" "$dir/service"
mv "$dir/service/frontend" "$dir/frontend/dist"
cp "$dir/service/dist/manifest.json" "$dir/manifest.json"
echo "$id $(jq -r .version <<< "$release") in $dir" >&2
