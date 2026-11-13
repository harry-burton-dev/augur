#!/usr/bin/env bash
# Fetches an AUGUR release's deploy bundle (scripts/augur-release.mjs, writeBundle), checks it was signed by
# this repository's Release or dev build workflow and that every file matches its SHA256SUMS, and unpacks it
# into a folder laid out as a checkout (infra/deploy, scripts/preflight.mjs, release/augur-release.json):
#   infra/deploy-bundle.sh <version> <folder>
# Needs gh (signed in, GH_REPO naming the repository) and cosign. Exits 3 when the release has no bundle:
# releases before bundles came in have only their tag.
set -euo pipefail
version=${1:?usage: infra/deploy-bundle.sh <version> <folder>}
into=${2:?usage: infra/deploy-bundle.sh <version> <folder>}
repo=${GH_REPO:-${GITHUB_REPOSITORY:?set GH_REPO to owner/repo}}
name="augur-deploy-$version.tar.gz"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# A release that can't be read fails here; only one that's there without a bundle exits 3.
assets=$(gh release view "augur@$version" --repo "$repo" --json assets --jq '.assets[].name')
if ! grep -qx "$name" <<<"$assets"; then
  echo "augur@$version has no deploy bundle." >&2
  exit 3
fi
gh release download "augur@$version" --repo "$repo" --dir "$work" --pattern "$name" --pattern "$name.sigstore.json"
# The workflows that sign releases, on a branch releases are made from (the updater's signers.ts).
cosign verify-blob --bundle "$work/$name.sigstore.json" \
  --certificate-identity-regexp "^https://github.com/${repo}/\.github/workflows/(release|augur-dev)\.yml@refs/heads/(main|preview|production|release/[a-z][a-z0-9-]*-[0-9]+\.[0-9]+)$" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com "$work/$name" >&2
mkdir -p "$into"
tar -xzf "$work/$name" -C "$into"
(cd "$into" && sha256sum --quiet -c SHA256SUMS)
echo "Unpacked augur@$version's deploy bundle into $into." >&2
