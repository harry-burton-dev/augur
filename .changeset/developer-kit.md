---
"@platform/shell": minor
---

A developer kit for app builders. `pnpm create-app <id>` writes a new app (frontend, service, manifest and changeset) into `apps/<id>`. `pnpm dev:app <id>` runs it in the real shell, signed in as a stand-in person, with the app's frontend from source and its service beside it, and nothing else of the platform needed; the shell gains this as a dev-only mode (`DEV_APP`). `pnpm check:manifest` puts every app's manifest to an in-memory registry in CI, so it fails on what the registry would refuse. `docs/build-an-app.md` goes from nothing to an app in the shell.
