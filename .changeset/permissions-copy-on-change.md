---
'@augur/permissions': minor
'@augur/events': minor
---

The permissions service copies from identity as soon as something changes, not only on a timer: it follows `platform.position.*`, `platform.team.*` and `platform.person.*`, so a handover or a new lead counts within a couple of seconds. The whole copy still runs every `PERMISSIONS_COPY_SECONDS`, now 300 by default, to put right anything an event missed. The events service publishes identity's position changes as `platform.position.created`, `.changed`, `.handed-over` and `.retired` (docs/domain-events.md).
