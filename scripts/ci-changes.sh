#!/usr/bin/env bash
# Which of CI's jobs this change needs, written to $GITHUB_OUTPUT as <job>=true|false
# (.github/workflows/ci.yml, docs/ci-cd.md). A job CI doesn't need is skipped before it starts a
# runner, so it costs no minutes and still counts as passed where it is a required check.
#
# A pull request is compared with where it left its base branch; a push with the push before it.
# A run by hand, the Version packages pull request, and a change to this script or to ci.yml run
# everything. On a push only build-test (which refills the turbo cache pull requests start from) and
# the Storybook (main's build is Chromatic's baseline) run: the pull request ran the rest on the same
# code, and the dev build builds the images for real.
set -euo pipefail

out=${GITHUB_OUTPUT:-/dev/stdout}
all=false
case "${EVENT:-}" in
  pull_request) range="origin/$BASE...HEAD" ;;
  push) range="$BEFORE..HEAD" ;;
  *) all=true ;;
esac
[[ "${HEAD_REF:-}" == changeset-release/* ]] && all=true
# A new branch, or history that was rewritten: nothing to compare with.
if [ "$all" = false ] && ! git rev-parse -q --verify "${range%%..*}^{commit}" >/dev/null; then all=true; fi
if [ "$all" = false ] && ! git diff --quiet "$range" -- scripts/ci-changes.sh .github/workflows/ci.yml; then all=true; fi

# Did the change touch any of these paths? (git pathspecs; a leading :! leaves a path out)
touches() { [ "$all" = true ] || ! git diff --quiet "$range" -- "$@"; }
say() { echo "$1=$2" >> "$out"; echo "$1: $2"; }
pr_only() { if [ "${EVENT:-}" = push ]; then say "$1" false; elif touches "${@:2}"; then say "$1" true; else say "$1" false; fi; }

# The kits' code, tokens or stories (ADR 0016).
if touches platform/packages/ui-kit/src platform/packages/ui-kit/.storybook \
    platform/packages/kit-common/src platform/packages/kit-common/tokens \
    platform/packages/app-kit/src platform/packages/shell-kit/src platform/storybook; then
  say storybook true
else
  say storybook false
fi
# What the shell, Home and the shared packages are built from, and the Folio release the tests mount.
pr_only contract platform/frontends platform/packages platform/contract release/shipped-apps.json infra/shipped-app.sh \
  ':!platform/frontends/admin' ':!platform/frontends/upgrades' ':!**/*.md' package.json pnpm-lock.yaml
# What goes into the images beyond the code build-test builds: Dockerfiles, deploy files, dependencies.
pr_only images infra .dockerignore pnpm-lock.yaml pnpm-workspace.yaml package.json '*/package.json' '**/package.json'
# What a new app is made from and checked against.
pr_only scaffold scripts/create-app.mjs scripts/templates platform/packages platform/services/registry \
  scripts/check-manifests.mjs scripts/check-boundaries.mjs scripts/versions.mjs package.json pnpm-lock.yaml ':!**/*.md'
# Today's SDK and the oldest and newest frozen builds on an ordinary pull request; every frozen build
# on the Version packages pull request and by hand, once per release.
if [ "$all" = true ]; then say contract_frozen all; else say contract_frozen edges; fi
