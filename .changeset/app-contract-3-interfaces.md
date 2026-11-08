---
"@augur/app-tools": minor
"@augur/service-kit": minor
"@augur/mfe-sdk": minor
---

The interfaces of the app contract (contract 3, ADR 0075), ahead of the gateway, registry, runner and shell that use them. `@augur/app-tools` ships the contract's schemas (`urn:augur:app-manifest:3`, `urn:augur:score-part:1`, `urn:augur:app-release:2`, with Score's own `score-v1b1.json`), `augur-app validate` for an app's `manifest.json` and `score/*.score.yaml`, and `@augur/app-tools/release2`, which writes `augur.app-release/v2` with each part's image pinned by digest and the app's asks written out; the v1 writer stays for apps on contract 2. The service kit's caller can carry the app acting for the person and its scopes (a delegated caller, audience `app-<id>`, `APP_DELEGATION_SECONDS`), checked with `delegationCheck` when a part sends it back in `x-augur-delegation`; `isScopeName` and `isOfferedScope` say what a scope looks like and which AUGUR offers. `@augur/mfe-sdk/sdk3` holds the SDK 3 `AppContext` types (`start(ctx)`, `ctx.frame`, `ctx.files`, `ctx.canvas`); SDK 2 apps see no change.
