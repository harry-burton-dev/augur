---
"@augur/service-kit": minor
"@augur/models": minor
---

A deployment can let the permissions service decide a check instead of the service's own, site by site, with `PERMISSIONS_DECIDES` (ADR 0085, step 2). The model gateway's admin checks read it first. A site that has moved over is refused with 503 when the permissions service can't answer, never falling back to the old check. Empty, as it is unless set, every check is only compared, as before.
