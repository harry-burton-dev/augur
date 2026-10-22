---
"@platform/registry": minor
"@platform/admin": minor
---

Go back to an earlier app version from Admin. The registry keeps the last 5 versions each app registers (`GET /v1/apps/:id/versions`) and lets an admin serve one of them and hold the app there (`PUT /v1/apps/:id/pin`) or follow new versions again (`DELETE /v1/apps/:id/pin`); API 1.2.0. A held app's new registrations are kept but not used. Admin's app details list the kept versions, pick the one to give the shell, and warn when an older version loads from the same address, so only its manifest comes back. Activity describes holds and held registrations. See "Going back to an earlier app version" in `docs/versioning.md`.
