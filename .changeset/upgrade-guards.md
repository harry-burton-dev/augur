---
---

Upgrade guards: CI checks that released migrations never change and that new ones only add within a major version (`pnpm check:migrations`, with fingerprints in `release/migrations.lock.json`), and `scripts/preflight.mjs` checks a server can take a release before it upgrades.
