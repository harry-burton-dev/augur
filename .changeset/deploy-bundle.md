---
'@augur/updater': minor
---

Each AUGUR release attaches a signed deploy bundle, `augur-deploy-<version>.tar.gz`: the deploy files, the preflight and the release file, laid out as a checkout, with a SHA256SUMS of them. A server installs and upgrades from it with no git checkout, and the deploy test now installs from it too. Compose's project name comes from `COMPOSE_PROJECT_NAME` in `.env`, and stays `platform` by default.
