---
"@augur/shell": minor
"@augur/ui-kit": minor
"@augur/admin": minor
"@augur/registry": minor
"@augur/home": patch
"@augur/mfe-sdk": patch
"@augur/service-kit": patch
"@augur/gateway": patch
"@augur/identity": patch
"@augur/events": patch
"@apps/library": patch
---

The platform is now called AUGUR. Packages move from `@platform/*` to `@augur/*`, and the shell's title, `<ui-shell>`'s default product name, Admin and new sign-in realms say AUGUR. Running servers keep their realm, database, Compose project and `.env` names; see docs/upgrade.md. The shell's import map still answers to `@platform/ui-kit`, so apps built before the rename keep loading.
