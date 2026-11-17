---
"@augur/gateway": minor
---

The gateway now signs the organisation on the callers it passes on: the claim `org` (`caller.org`, and `x-user-org` for AUGUR's own services), the organisation's floor's id. It reads the id from identity in the background, so no call waits for it. A call made before identity first answers, or while an identity older than this release is running, goes without it. Part of PER-463.
