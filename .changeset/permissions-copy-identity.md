---
'@augur/permissions': minor
'@augur/identity': minor
---

The permissions service copies identity's floors, the positions on them and who holds each into OpenFGA (ADR 0085, ADR 0089), every `PERMISSIONS_COPY_SECONDS` (30), writing only what changed and never touching what others wrote there. A handover counts within that time. A copy that would take away more than half of what it holds at once is held back and logged. Its health shows how the last copy went. Identity gives platform services the whole picture at `GET /v1/relationships`. The permissions service signs in as itself, with the new `PERMISSIONS_CLIENT_SECRET`.
