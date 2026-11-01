# 0023. The air-gap bundle is a standard OCI image layout

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry

## Context

`scripts/mirror-release.mjs` copies a release's images, signatures, release file and feed into a bundle for an air-gapped deployment, in a format of our own.

## Options

1. **Keep the script, but write a standard OCI image layout** that `oras`, `skopeo` and any OCI registry can read.
2. **Hauler**, which collects images, files and charts into a carryable store with cosign. A new tool.
3. **Zarf.** Kubernetes only.

## Decision

Option 1. The bundle carries the signed feed ([0017](0017-signed-release-feed.md)) unchanged, and signatures are checked offline against `trusted_root.json` as today. Hauler is revisited if an organisation already uses it.

## Consequences

- An organisation can load a bundle into its own registry with standard tools.
- `docs/mirror.md` changes in the build PR.

## Links

- Linear PER-177
- docs/mirror.md
