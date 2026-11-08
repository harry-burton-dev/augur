---
'@augur/mfe-sdk': minor
'@augur/shell': minor
'@augur/service-kit': patch
'@augur/contract-tests': patch
---

The shell runs apps on the app contract (contract 3, ADR 0076) in a web worker each. The SDK's worker runtime (`@augur/mfe-sdk/sdk3/runtime`, run by the shell's bootstrap) gives the app `start(ctx)`: `ctx.frame.screen.render` draws Quill's remote vocabulary, which the shell draws with the kit; `ctx.fetch` takes a path under `/api/` and the shell makes the call with the person's token, `X-Workspace-Id` and `x-augur-app`; `ctx.navigate` and `ctx.onNavigate` leave the address to the shell; `ctx.frame.set` gives the pane its heading and actions. The worker has no network, none of the page's storage and no token, under its own policy (`default-src 'none'; script-src 'self'`, served with the bootstrap under `/sandbox/`). The pane says when the app is opening, slow (5 s) or failed (30 s, or the worker threw), and stops an app that draws more than 2,000 nodes at once or keeps more than 50,000, each with Try again; the rest of the shell keeps working. A new floor starts the worker again. The catalogue's contract 3 rows (the manifest in force) become entries the app bar, rail, Find and intents already take; the shell's own frontends stay on SDK 2. `sandbox` is now a reserved app id.
