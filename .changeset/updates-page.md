---
"@augur/registry": minor
"@augur/admin": minor
---

Admin → Updates: whether a newer AUGUR release is out, what changes in each part, and what needs doing first (a release to go through, new settings, breaking changes, apps that won't open on the new SDK). The registry checks the release feed once a day and when an admin presses Check now (audited). Status marks a release that's out. New optional settings: `RELEASE_FEED_URL`, `RELEASE_CHANNEL`, and a read-only token in `infra/deploy/secrets/release-feed-token` for a private repository.
