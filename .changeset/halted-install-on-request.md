---
'@augur/registry': minor
---

A deployment admin can install a release its publisher halted, on request, to prove AUGUR goes back by itself from a broken release (ADR 0051): `PUT /v1/platform/upgrade/halted` with the exact version and a reason, after a fresh sign-in, on dev and preview servers only. The release must be newer, able to upgrade from the running one and have no breaking release between. Every request, allowed or refused, is audited, and the Updates page says whether this server allows it (`haltedInstall`).
