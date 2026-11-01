#!/usr/bin/env bash
# Builds, pushes and signs the platform's images for one platform release, and prints where
# each landed, by digest, as JSON. Run by the Release workflow:
#   infra/release-images.sh <version> <channel> > images.json
# Each image is tagged with the version and the channel (beta or stable), and signed with
# cosign keyless, so a deployment can check it came from this repository's Release workflow.
set -euo pipefail
version=$1
channel=$2
repo=${IMAGE_REPO:-ghcr.io/${GITHUB_REPOSITORY,,}}
out=$(mktemp -d)

build() {
  local name=$1
  shift
  docker buildx build --push --provenance=true --sbom=true \
    --label "org.opencontainers.image.version=$version" \
    -t "$repo/$name:$version" -t "$repo/$name:$channel" \
    --metadata-file "$out/$name.json" "$@" . >&2
  local digest
  digest=$(jq -r '."containerimage.digest"' "$out/$name.json")
  cosign sign --yes "$repo/$name@$digest" >&2
  jq -n --arg name "$name" --arg ref "$repo/$name@$digest" '{($name): $ref}' > "$out/$name.ref.json"
}

build web -f infra/web.Dockerfile --target web
for service in gateway identity events models storage; do
  build "$service" -f infra/service.Dockerfile --build-arg "PACKAGE=@augur/$service" --target service
done
build registry -f infra/service.Dockerfile --build-arg PACKAGE=@augur/registry --target registry
build updater -f infra/service.Dockerfile --build-arg PACKAGE=@augur/updater --target updater
# The apps that ship with AUGUR: Folio's service and its rendition worker, Auspex and Data Atlas.
build folio -f infra/service.Dockerfile --build-arg PACKAGE=@apps/folio --build-arg FRONTEND=@apps/folio-frontend --target service
build folio-worker -f apps/folio/worker/Dockerfile
build auspex -f infra/service.Dockerfile --build-arg PACKAGE=@apps/auspex --build-arg FRONTEND=@apps/auspex-frontend --target service
build atlas -f infra/service.Dockerfile --build-arg PACKAGE=@apps/atlas --build-arg FRONTEND=@apps/atlas-frontend --target service

jq -s 'add' "$out"/*.ref.json
