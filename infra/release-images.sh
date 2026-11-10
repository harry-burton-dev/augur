#!/usr/bin/env bash
# Builds, pushes and signs the platform's images for one platform release, and prints where
# each landed, by digest, as JSON. Run by the Release workflow:
#   infra/release-images.sh <version> <channel> > images.json
# Each image is tagged with the version and the channel (beta or stable), and signed with
# cosign keyless, so a deployment can check it came from this repository's Release workflow.
# No app ships with AUGUR (ADR 0075): apps release in their own repositories and the app runner installs them.
set -euo pipefail
version=$1
channel=$2
repo=${IMAGE_REPO:-ghcr.io/${GITHUB_REPOSITORY,,}}
out=$(mktemp -d)

# The web image serves the UI kit bundle pinned in release/kit.json (ADR 0048). Before anything is
# built: its kit.json is signed by augur-kit's Release workflow, and release/kit.json names that very
# file. The image's build then checks every file it copies against kit.json's hashes.
node scripts/kit.mjs verify >&2

# The workspace's install (the Dockerfiles' deps stage) kept between runs. BUILDX_CACHE names a folder the
# workflow keeps in GitHub's cache, keyed by the dependencies: every image's build reads the install from it,
# and only when the dependencies changed (BUILDX_CACHE_SAVE=true) is the install exported to it again. Only
# that stage is kept, so nothing that should be fresh in a release (base image, Alpine's fixes) comes from it.
cache=()
if [ -n "${BUILDX_CACHE:-}" ]; then
  [ -f "$BUILDX_CACHE/index.json" ] && cache=(--cache-from "type=local,src=$BUILDX_CACHE")
  if [ "${BUILDX_CACHE_SAVE:-}" = true ]; then
    docker buildx build --secret id=node_auth_token,env=NODE_AUTH_TOKEN -f infra/service.Dockerfile --target deps \
      "${cache[@]}" --cache-to "type=local,dest=$BUILDX_CACHE.new,mode=max" . >&2
    rm -rf "$BUILDX_CACHE" && mv "$BUILDX_CACHE.new" "$BUILDX_CACHE"
    cache=(--cache-from "type=local,src=$BUILDX_CACHE")
  fi
fi

# What is inside an image and how it was built, signed beside its signature (PER-270): BuildKit writes a
# Syft SBOM (SPDX) and SLSA provenance into every image it pushes (--sbom, --provenance), and cosign attests
# both keylessly as this workflow, so `cosign verify-attestation --type spdxjson|slsaprovenance1` checks
# them with the same identity as the image. BuildKit writes SLSA v1 provenance (buildDefinition); an older
# one wrote v0.2 (builder), so the type follows what the predicate holds.
attest() {
  local ref=$1 dir sbom provenance
  dir=$(mktemp -d)
  sbom=$(docker buildx imagetools inspect "$ref" --format '{{ json .SBOM.SPDX }}' 2>/dev/null || true)
  provenance=$(docker buildx imagetools inspect "$ref" --format '{{ json .Provenance.SLSA }}' 2>/dev/null || true)
  for kind in sbom provenance; do
    local value=${!kind}
    if [ -z "$value" ] || [ "$value" = null ]; then
      echo "::error::$ref has no $kind: build it with --sbom=true --provenance=true." >&2
      return 1
    fi
    printf '%s' "$value" > "$dir/$kind.json"
  done
  if [ -s "$dir/sbom.json" ]; then cosign attest --yes --type spdxjson --predicate "$dir/sbom.json" "$ref" >&2; fi
  if [ -s "$dir/provenance.json" ]; then
    local slsa=slsaprovenance
    if jq -e 'has("buildDefinition")' "$dir/provenance.json" >/dev/null; then slsa=slsaprovenance1; fi
    cosign attest --yes --type "$slsa" --predicate "$dir/provenance.json" "$ref" >&2
  fi
  rm -rf "$dir"
}

# Builds an image from this checkout: build <name> <docker args>...
build() {
  local name=$1
  shift
  docker buildx build --push --provenance=true --sbom=true --secret id=node_auth_token,env=NODE_AUTH_TOKEN \
    --label "org.opencontainers.image.version=$version" \
    -t "$repo/$name:$version" -t "$repo/$name:$channel" \
    --metadata-file "$out/$name.json" "${cache[@]}" "$@" . >&2
  local digest
  digest=$(jq -r '."containerimage.digest"' "$out/$name.json")
  cosign sign --yes "$repo/$name@$digest" >&2
  attest "$repo/$name@$digest"
  jq -n --arg name "$name" --arg ref "$repo/$name@$digest" '{($name): $ref}' > "$out/$name.ref.json"
}

build web -f infra/web.Dockerfile --target web
for service in gateway identity events models knowledge permissions storage; do
  build "$service" -f infra/service.Dockerfile --build-arg "PACKAGE=@augur/$service" --target service
done
build registry -f infra/service.Dockerfile --build-arg PACKAGE=@augur/registry --target registry
build updater -f infra/service.Dockerfile --build-arg PACKAGE=@augur/updater --target updater
# Keycloak with AUGUR's sign-in and email theme (ADR 0041).
build keycloak -f infra/service.Dockerfile --target keycloak
# OpenFGA, started so that it brings its tables up to date first (ADR 0085).
build openfga -f infra/service.Dockerfile --target openfga

jq -s 'add' "$out"/*.ref.json
