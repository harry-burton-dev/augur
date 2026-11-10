# @augur/app-tools

## 0.6.0

### Minor Changes

- f59617f: An app names what it needs of the knowledge graph in its `augur-floor-graphs` resource: `classes` (class IRIs) and `actions` (action names). The registry asks the deployment's knowledge graph what it offers when an app is installed, and refuses an install that needs a class or action it lacks, saying which and who can adopt a class. When the knowledge graph can't be asked, it only warns. The knowledge graph's `GET /meta` now lists every class it has (`ontology.classes`), and Admin's review of an install names the classes and actions.
- d2ce7c9: Apps can ask for the knowledge graph in their manifest's `scopes`: `knowledge:read` to read it as the person they act for, `knowledge:act` for its actions apps are granted, and `knowledge:extract` to add what a source says (retain). The gateway lets an app's calls to the knowledge graph through on those scopes, Admin names them when an admin allows an app, and an app's catalog entry names the knowledge API. The knowledge graph itself still refuses apps until its next release, which checks each action's own scope.

  Not breaking: registry.openapi.yaml lists three more scopes an app's entry may carry. The list grows as AUGUR adds what apps can be granted, and its readers (Admin, the shell and the registry client) show a scope they don't know by its name.

- e60b45e: An app on contract 3 chooses its pane's layout from the shell's named ones: `focus`, `aside` (with the About panel), `split` and `canvas`, with `density` and `inset` beside `width`. `contributes.frame` in the manifest sets the defaults, and `ctx.frame.set` changes them for a page. The shell takes the choice and shows the About panel only in `aside`; an app with About sections and no choice keeps `aside`, so nothing it shows today moves. The spacing of each layout follows in the next kit release.

### Patch Changes

- Updated dependencies [d2ce7c9]
- Updated dependencies [7e6b12b]
- Updated dependencies [12064f5]
- Updated dependencies [cc7aa74]
  - @augur/service-kit@0.19.0

## 0.5.0

### Minor Changes

- 3e2ff05: The interfaces of the app contract (contract 3, ADR 0075), ahead of the gateway, registry, runner and shell that use them. `@augur/app-tools` ships the contract's schemas (`urn:augur:app-manifest:3`, `urn:augur:score-part:1`, `urn:augur:app-release:2`, with Score's own `score-v1b1.json`), `augur-app validate` for an app's `manifest.json` and `score/*.score.yaml`, and `@augur/app-tools/release2`, which writes `augur.app-release/v2` with each part's image pinned by digest and the app's asks written out; the v1 writer stays for apps on contract 2. The service kit's caller can carry the app acting for the person and its scopes (a delegated caller, audience `app-<id>`, `APP_DELEGATION_SECONDS`), checked with `delegationCheck` when a part sends it back in `x-augur-delegation`; `isScopeName` and `isOfferedScope` say what a scope looks like and which AUGUR offers. `@augur/mfe-sdk/sdk3` holds the SDK 3 `AppContext` types (`start(ctx)`, `ctx.frame`, `ctx.files`, `ctx.canvas`); SDK 2 apps see no change.

  Not breaking: `CallerSigner.sign` gains an optional third argument (the token's lifetime); existing signers and callers build and run as before.

- e2089a3: What building the app template on the app contract found: `appServer` checks the caller the gateway signs for the app's client, `app-<id>`; `startAppService` leaves registering to the app runner on contract 3; `appDatabaseFromEnv` reads the database a part's Score file asks for; `augur-app describe` and `publish` write release v2 from the Score files for an app on contract 3 (`augur-app release describe|publish` spells it out); the catalogue entry of a contract 3 app has its route, contract and intents.

### Patch Changes

- b2c7a81: `augur-app describe` with no bundle names the placeholder image of a part built from the repository where the build would push it (`IMAGE_REPO`, or ghcr.io under `GITHUB_REPOSITORY`), so the release passes the part schema's image rule; before, the placeholder was refused, so `describe` failed on any contract 3 app with such a part.
- Updated dependencies [3e2ff05]
- Updated dependencies [e2089a3]
- Updated dependencies [656f2d1]
- Updated dependencies [0e4e55f]
- Updated dependencies [6c0abe4]
- Updated dependencies [699af61]
- Updated dependencies [dfc36c1]
- Updated dependencies [f01d0c4]
- Updated dependencies [832458f]
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
