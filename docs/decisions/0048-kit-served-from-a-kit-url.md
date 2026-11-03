# 0048. Apps load the UI kit from a kit URL that the deployment serves

- **Status:** Accepted
- **Date:** 2026-11-03
- **Decided by:** Harry
- **Replaces:** part of [0046](0046-ui-kit-in-its-own-repository.md): how the shell serves the kit. The kit still lives in its own repository and publishes its packages.

## Context

[0046](0046-ui-kit-in-its-own-repository.md) moves the kit into `augur-kit`, but the shell still builds the kit into its own `/shared/` files, so the kit only reaches a deployment inside the shell's image. Harry wants the kit loaded from a CDN, not hard-coded into the shell: kit versions should move on their own, and the address should come from config, as everything else does.

The import map ([0003](0003-import-maps-not-module-federation.md)) still has to name exactly one kit version for the shell and every app, and that version still has to be tested with the shell's contract tests. AUGUR also has to run on the organisation's private cloud, which may have no internet access.

## Options

1. **Kit URL, served by the deployment.** Each kit release is a signed bundle of ready-to-load files. The deployment serves it under a kit URL that config sets, and the URL defaults to the deployment's own address. A CDN can go in front later by changing the URL.
2. **Public CDN (jsDelivr).** The kit packages go public on npm, and the shell loads them from jsDelivr. The kit's code becomes public, and an offline server can't load it.
3. **The organisation's own CDN only.** The URL must be set for each deployment, and nothing works until someone hosts the kit there.

## Decision

Option 1.

- **What the kit publishes.** Each `augur-kit` release builds one bundle: ES modules for `@augur/kit-common` and `@augur/app-kit`, React and React DOM, their CSS, and a `kit.json`. The `kit.json` gives the kit version and the import map entries for that version. The bundle is a release asset, signed with cosign keyless like images, so the signature names `augur-kit`. Aerie is not in the bundle: the shell still builds it in, because apps never use it.
- **Which version.** An AUGUR release still pins one kit version, in `release/kit.json`, and the contract tests run against that bundle. Renovate proposes kit updates. A deployment runs one tested set of versions.
- **Where it is served.** The web image carries the pinned bundle under `/kit/<version>/`. `KIT_URL` in `.env` sets the address the import map uses. It defaults to `/kit/`, the deployment itself. When the web container starts, it writes the kit entries of the import map from `KIT_URL` and the pinned version, and adds the kit's origin to the CSP's `script-src` and `style-src`.
- **A CDN in front.** Point `KIT_URL` at any static host or CDN that serves the same files at the same paths, for example one that mirrors `/kit/` from the deployment. The import map names the full version, so a CDN can cache the files forever.
- **The kit's integrity is checked.** The import map's `integrity` entries carry each file's hash from `kit.json`. A CDN that serves anything else is refused by the browser.
- **The Lit kit is not moved.** `@augur/ui-kit` and Lit stay in the shell's `/shared/` files until SDK 2 removes them.

## Consequences

- The shell's shared build stops building Common, Quill and React. Release takes the pinned bundle from `augur-kit`'s release, checks its signature and copies it into the web image.
- A kit change reaches deployments with a kit release, then an AUGUR pull request that bumps `release/kit.json`. This is the same path [0046](0046-ui-kit-in-its-own-repository.md) gives a package bump.
- Admin's About page shows the kit version and the kit URL. If the kit can't be loaded, the shell says so and names `KIT_URL` and who can change it.
- `docs/deploy.md` documents `KIT_URL`, `docs/versioning.md` documents the bundle, and `infra/deploy/csp.mjs` takes the kit origin.
- The updater needs nothing new: the kit comes inside the web image.
- Later, more than one kit version could sit side by side under `/kit/`. That would only matter if apps ever pinned their own kit major, which is SDK 2's question, not this record's.

## Links

- Linear PER-244, PER-243
- [0003](0003-import-maps-not-module-federation.md), [0015](0015-react-kits-tailwind.md), [0046](0046-ui-kit-in-its-own-repository.md)
