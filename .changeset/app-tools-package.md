---
'@augur/app-tools': minor
---

New package, `@augur/app-tools`: the release steps every app shares (dev build and preview versions, channels, the app-release.json and its notes), and the `augur-app` command that releases an app from its own repository (ADR 0047). scripts/app-release.mjs now uses the same steps, so releases read the same wherever they're made.
