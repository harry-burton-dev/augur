---
"@augur/updater": minor
"@augur/registry": minor
---

The updater: an optional container for Docker Compose deployments that runs the upgrade an admin asks for on Admin → Updates. It checks each image's signature and digest, the release's deploy files and required settings, takes a backup and test-restores it, pulls, restarts each part in turn and waits for its new version, and goes back to the release it was on by itself when a part doesn't come up. The registry now gives it each part's version, the required settings and the deploy files' hashes with the upgrade, and release files list those hashes. Turn it on with `COMPOSE_PROFILES=updater` (docs/upgrade.md, The updater).
