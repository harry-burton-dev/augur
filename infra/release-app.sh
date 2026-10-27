#!/usr/bin/env bash
# Builds, pushes and signs one app's bundle, and prints where each part landed, by digest, as JSON.
# Run by the Release workflow for each app scripts/app-release.mjs lists as pending:
#   infra/release-app.sh <id> <version> <channel> > bundle.json
# The service image goes to <repo>/apps/<id>, carrying the built frontend (as Folio's does), and
# the frontend alone goes beside it as an OCI artifact, <repo>/apps/<id>-frontend, so a deployment
# can keep it in the registry before the service starts. Both are tagged with the version and the
# channel and signed with cosign keyless, so the app runner can check they came from this
# repository's Release workflow. An app with only a frontend, or only a service, gets only that part.
set -euo pipefail
id=$1
version=$2
channel=$3
repo=${IMAGE_REPO:-ghcr.io/${GITHUB_REPOSITORY,,}}/apps
dir=apps/$id
out=$(mktemp -d)
media=$(node -e "import('./scripts/app-release.mjs').then((m) => console.log(m.FRONTEND_MEDIA_TYPE))")

name_of() { [ -f "$dir/$1/package.json" ] && jq -r .name "$dir/$1/package.json" || true; }
service_pkg=$(name_of service)
frontend_pkg=$(name_of frontend)

service=null
if [ -n "$service_pkg" ]; then
  docker buildx build --push --provenance=true --sbom=true \
    --label "org.opencontainers.image.version=$version" \
    --label "org.opencontainers.image.title=$id" \
    -t "$repo/$id:$version" -t "$repo/$id:$channel" \
    --metadata-file "$out/service.json" \
    -f infra/service.Dockerfile --build-arg "PACKAGE=$service_pkg" ${frontend_pkg:+--build-arg "FRONTEND=$frontend_pkg"} --target service . >&2
  digest=$(jq -r '."containerimage.digest"' "$out/service.json")
  cosign sign --yes "$repo/$id@$digest" >&2
  service=$(jq -n --arg ref "$repo/$id@$digest" '$ref')
fi

frontend=null
if [ -n "$frontend_pkg" ]; then
  pnpm --filter "$frontend_pkg..." --filter @augur/service-kit build >&2
  node scripts/app-release.mjs pack "$id" "$out/frontend.tar.gz" >&2
  # What the registry will check the tarball against: the same sha256 it records when it keeps it.
  tarball="sha256:$(sha256sum "$out/frontend.tar.gz" | cut -d' ' -f1)"
  (cd "$out" && oras push "$repo/$id-frontend:$version,$channel" \
    --artifact-type application/vnd.augur.frontend.v1 \
    --annotation "org.opencontainers.image.version=$version" \
    --format json "frontend.tar.gz:$media") > "$out/frontend.json"
  digest=$(jq -r .digest "$out/frontend.json")
  cosign sign --yes "$repo/$id-frontend@$digest" >&2
  frontend=$(jq -n --arg ref "$repo/$id-frontend@$digest" --arg digest "$tarball" '{artifact: $ref, digest: $digest}')
fi

jq -n --argjson service "$service" --argjson frontend "$frontend" --arg channel "$channel" '{service: $service, frontend: $frontend, channel: $channel}'
