# @augur/app-tools

## 0.4.4

### Patch Changes

- Updated dependencies [656f2d1]
- Updated dependencies [699af61]
- Updated dependencies [dfc36c1]
- Updated dependencies [1ce4194]
  - @augur/service-kit@0.18.0

## 0.4.3

### Patch Changes

- Updated dependencies [4cfab7e]
  - @augur/service-kit@0.17.1

## 0.4.2

### Patch Changes

- Updated dependencies [1a8561d]
- Updated dependencies [c678672]
  - @augur/service-kit@0.17.0

## 0.4.1

### Patch Changes

- 400916d: `augur-app bundle` no longer fails with `spawnSync docker ENOBUFS` when it attests a service image's SBOM. Reading the SBOM back from `docker buildx imagetools inspect` overflowed Node's 1 MB output limit, which broke app previews and releases on app-tools 0.4.0. It now allows up to 512 MB.
- Updated dependencies [c0de29b]
- Updated dependencies [8eba62b]
- Updated dependencies [ab9f61f]
  - @augur/service-kit@0.16.0

## 0.4.0

### Minor Changes

- bb4377b: `augur-app catalog` writes an app's Backstage catalog entry, `catalog-info.yaml`, from its manifest and parts, with its kind (`augur.dev/category`); `--check` fails when it's out of date. AUGUR's `catalog/all.yaml` now points Backstage at each shipped app's entry, so apps are back in the catalog since they moved to their own repositories.
- e6c1a39: The app manifest's JSON Schema ships inside the package, as `@augur/app-tools/manifest.schema.json`. An app's manifest can point `"$schema"` at `./node_modules/@augur/app-tools/manifest.schema.json` and its editor completes and checks the fields, with the schema of the tools it releases with.

### Patch Changes

- Updated dependencies [833b4ed]
- Updated dependencies [431db38]
  - @augur/service-kit@0.15.0

## 0.3.1

### Patch Changes

- Updated dependencies [1f83a5f]
- Updated dependencies [2f2b01a]
- Updated dependencies [7886a1e]
- Updated dependencies [f902da5]
- Updated dependencies [866c076]
- Updated dependencies [04d7ed1]
- Updated dependencies [4f8d944]
- Updated dependencies [90057d9]
- Updated dependencies [858fad1]
- Updated dependencies [33b6fa3]
  - @augur/service-kit@0.14.0

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
