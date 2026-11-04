#!/usr/bin/env bash
# Builds, pushes and signs the platform's images for one platform release, and prints where
# each landed, by digest, as JSON. Run by the Release workflow:
#   infra/release-images.sh <version> <channel> > images.json
# Each image is tagged with the version and the channel (beta or stable), and signed with
# cosign keyless, so a deployment can check it came from this repository's Release workflow.
#
# The apps that ship with AUGUR live in their own repositories and release there (ADR 0049): this takes
# the release release/shipped-apps.json pins for each, checks its app repository's release workflow signed
# it, copies its service image here and signs it again as AUGUR's, and puts the frontend the image carries
# into the web image. Images an app's release doesn't carry (Artifacts' rendition worker) are built from the
# app's source at its release tag. Reading the app repositories needs APP_RELEASES_TOKEN (their releases
# and source) and PACKAGES_READ_TOKEN (their images; read:packages), as their own workflows have.
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

# Builds an image from this checkout, or from another folder: build <name> [--context <dir>] <docker args>...
build() {
  local name=$1 context=.
  shift
  if [ "${1:-}" = --context ]; then context=$2; shift 2; fi
  docker buildx build --push --provenance=true --sbom=true --secret id=node_auth_token,env=NODE_AUTH_TOKEN \
    --label "org.opencontainers.image.version=$version" \
    -t "$repo/$name:$version" -t "$repo/$name:$channel" \
    --metadata-file "$out/$name.json" "${cache[@]}" "$@" "$context" >&2
  local digest
  digest=$(jq -r '."containerimage.digest"' "$out/$name.json")
  cosign sign --yes "$repo/$name@$digest" >&2
  jq -n --arg name "$name" --arg ref "$repo/$name@$digest" '{($name): $ref}' > "$out/$name.ref.json"
}

# An image built before from exactly these sources, tagged for this release and signed again by this
# workflow, instead of built again.
reuse() {
  local name=$1 from=$2
  docker buildx imagetools create -t "$repo/$name:$version" -t "$repo/$name:$channel" "$from" >&2
  local digest
  digest=$(docker buildx imagetools inspect "$from" --format '{{json .Manifest}}' | jq -r .digest)
  cosign sign --yes "$repo/$name@$digest" >&2
  jq -n --arg name "$name" --arg ref "$repo/$name@$digest" '{($name): $ref}' > "$out/$name.ref.json"
}

# The shipped apps' releases: checked, and each frontend taken out of its service image for the web image.
shipped=$(node scripts/shipped-apps.mjs resolve)
command -v skopeo > /dev/null || { sudo apt-get update -qq && sudo apt-get install -y -qq skopeo; } >&2
read_config=$(mktemp -d)
if [ -n "${PACKAGES_READ_TOKEN:-}" ]; then
  printf %s "$PACKAGES_READ_TOKEN" | tr -d '\r\n' | DOCKER_CONFIG=$read_config docker login ghcr.io -u augur --password-stdin >&2
else
  cp "${DOCKER_CONFIG:-$HOME/.docker}/config.json" "$read_config/config.json"
fi
rm -rf .shipped && mkdir -p .shipped/frontends .shipped/src
for app in $(jq -r 'keys[]' <<< "$shipped"); do
  service=$(jq -r --arg a "$app" '.[$a].service' <<< "$shipped")
  identity=$(jq -r --arg a "$app" '.[$a].identity' <<< "$shipped")
  echo "$app: $(jq -r --arg a "$app" '.[$a].tag' <<< "$shipped") from $(jq -r --arg a "$app" '.[$a].repo' <<< "$shipped")" >&2
  unreadable="::error::Couldn't read or check $service. Its repository's images need the PACKAGES_READ_TOKEN secret here (a classic token with read:packages; docs/ship-an-app.md, \"An app in its own repository\")."
  DOCKER_CONFIG=$read_config cosign verify --certificate-identity "$identity" \
    --certificate-oidc-issuer https://token.actions.githubusercontent.com "$service" > /dev/null || { echo "$unreadable" >&2; exit 1; }
  container=$(DOCKER_CONFIG=$read_config docker create "$service") || { echo "$unreadable" >&2; exit 1; }
  docker cp "$container:/app/frontend" ".shipped/frontends/$app"
  docker rm "$container" > /dev/null
done

build web -f infra/web.Dockerfile --target web
for service in gateway identity events models storage; do
  build "$service" -f infra/service.Dockerfile --build-arg "PACKAGE=@augur/$service" --target service
done
build registry -f infra/service.Dockerfile --build-arg PACKAGE=@augur/registry --target registry
build updater -f infra/service.Dockerfile --build-arg PACKAGE=@augur/updater --target updater
# Keycloak with AUGUR's sign-in and email theme (ADR 0041).
build keycloak -f infra/service.Dockerfile --target keycloak

for app in $(jq -r 'keys[]' <<< "$shipped"); do
  service=$(jq -r --arg a "$app" '.[$a].service' <<< "$shipped")
  # Copied as it is (same digest) under AUGUR's images, then tagged for this release and signed as AUGUR's.
  skopeo copy --all --preserve-digests --src-authfile "$read_config/config.json" \
    --dest-authfile "${DOCKER_CONFIG:-$HOME/.docker}/config.json" \
    "docker://$service" "docker://$repo/$app:src-${service##*@sha256:}" >&2
  reuse "$app" "$repo/$app@${service##*@}"
  # Images built from the app's source at its release tag, such as Artifacts' rendition worker.
  if [ "$(jq -r --arg a "$app" '.[$a].build | length' <<< "$shipped")" != 0 ]; then
    src=.shipped/src/$app
    tag=$(jq -r --arg a "$app" '.[$a].tag' <<< "$shipped")
    git -c "http.extraHeader=Authorization: Basic $(printf 'x-access-token:%s' "$(printf %s "${APP_RELEASES_TOKEN:-}" | tr -d '\r\n')" | base64 -w0)" \
      clone --quiet --depth 1 --branch "$tag" "https://github.com/$(jq -r --arg a "$app" '.[$a].repo' <<< "$shipped").git" "$src" >&2
    for image in $(jq -r --arg a "$app" '.[$a].build | keys[]' <<< "$shipped"); do
      dockerfile=$(jq -r --arg a "$app" --arg i "$image" '.[$a].build[$i]' <<< "$shipped")
      # Some take minutes (Artifacts' worker installs Torch and Docling's models), so each build is also tagged
      # with its folder's git tree. A dev build reuses the last one built from the same tree; a beta or stable
      # release always builds afresh, with today's base image and packages.
      from=$(git -C "$src" rev-parse "HEAD:$(dirname "$dockerfile")")
      if [ "$channel" = dev ] && docker buildx imagetools inspect "$repo/$image:src-$from" >/dev/null 2>&1; then
        echo "$image: unchanged since $repo/$image:src-$from, reused" >&2
        reuse "$image" "$repo/$image:src-$from"
      else
        build "$image" --context "$src" -f "$src/$dockerfile" -t "$repo/$image:src-$from"
      fi
    done
  fi
done

jq -s 'add' "$out"/*.ref.json
