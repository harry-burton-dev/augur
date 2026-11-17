---
"@augur/service-kit": minor
"@augur/identity": minor
---

A caller can name its organisation: `caller.org`, the organisation's floor's id, which the signed caller carries as the claim `org` and AUGUR's own services read from `x-user-org`. Identity's `GET /v1/organisation` now gives that id as `id`. The gateway starts signing it in the next change; until then `org` is absent. Part of PER-463.
