---
"@augur/shell": minor
"@augur/contract-tests": patch
---

The shell follows the events service's browser stream once, for the floor the person is on and the topics of the apps they have there (and `platform.*`), and puts each domain event on `ctx.bus` under its topic, so the app kit's `useData(…, { refreshOn })` refreshes without polling. `pnpm dev:app` stands in for the stream: send an event from the console with `augur:dev-domain-event`. The contract tests check an app reloads when one arrives.
