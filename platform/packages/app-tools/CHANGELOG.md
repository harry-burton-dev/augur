# @augur/app-tools

## 0.3.0

### Minor Changes

- d744255: Every release image now carries a signed SBOM (SPDX, from Syft through BuildKit) and SLSA build provenance, attested with cosign by the same workflow that signs the image (PER-270). `augur-app bundle` does the same for an app's service image, and AUGUR's release does it for its own images and the shipped apps' images it re-signs. Check them with `cosign verify-attestation --type spdxjson` or `--type slsaprovenance` (docs/release-channels.md, Signatures).

### Patch Changes

- 83858e8: AUGUR's repository is now `harry-burton-dev/augur`. The registry reads the release list from the new address by default, and app-tools names it when a release has no `GITHUB_REPOSITORY`. Images and the feed stay at `ghcr.io/harry-burton-dev/im-platform`, and releases signed under the old name are still trusted.
- 2428f64: Attest BuildKit's SLSA v1 provenance as `slsaprovenance1`, so signing an app's release no longer fails on it.
- Updated dependencies [7dbdf7b]
- Updated dependencies [2dbdc22]
- Updated dependencies [0ec750c]
- Updated dependencies [7518ce8]
- Updated dependencies [dec1a40]
- Updated dependencies [566f261]
- Updated dependencies [7517bd7]
  - @augur/service-kit@0.13.0

## 0.2.1

### Patch Changes

- Updated dependencies [b3060e0]
  - @augur/service-kit@0.12.0

## 0.2.0

### Minor Changes

- 0c9bf17: New package, `@augur/app-tools`: the release steps every app shares (dev build and preview versions, channels, the app-release.json and its notes), and the `augur-app` command that releases an app from its own repository (ADR 0047). scripts/app-release.mjs now uses the same steps, so releases read the same wherever they're made.

### Patch Changes

- Updated dependencies [137791c]
- Updated dependencies [2021f8a]
  - @augur/service-kit@0.11.0
