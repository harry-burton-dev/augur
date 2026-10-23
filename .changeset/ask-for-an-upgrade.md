---
"@augur/service-kit": minor
"@augur/gateway": minor
"@augur/shell": minor
"@augur/registry": minor
"@augur/admin": minor
---

Admin → Updates can ask for an upgrade. **Upgrade to …** records the wanted release in the registry (`PUT /v1/platform/upgrade`, audited), after the admin enters their password again: the gateway now passes on when the caller last signed in (`x-user-signed-in-at`, `Caller.signedInAt`, `signedInRecently()` in the service kit), and the shell's `/auth/again?return=<path>` asks for the password and comes back. The deployment's updater (signed in as `platform-updater`) reads the upgrade from `/v1/platform/upgrade/target` and reports each step to `/v1/platform/upgrade/progress`; Updates follows along and says how it ended. An upgrade nothing has started can be cancelled.
