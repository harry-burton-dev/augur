---
"@augur/registry": minor
"@augur/updater": minor
"@augur/service-kit": minor
---

The updater can now run apps: with `APP_SECRETS_KEY` in `.env` it installs, upgrades and removes apps that don't ship with AUGUR, from their signed releases, in a Compose project of its own (`augur-apps`). Upgrades are blue/green with a health check: a version that doesn't come up leaves the old one serving. Admins ask for installs and removals through the registry's new `/v1/app-runner/jobs`, and the service kit's `registerApp` leaves registering to the runner when it runs the app.
