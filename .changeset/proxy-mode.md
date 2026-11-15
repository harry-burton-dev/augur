---
'@augur/updater': minor
---

The updater runs the compose files a deployment names in `COMPOSE_FILE` (in `.env`), not only `compose.yml`, so a deployment behind its organisation's own proxy (`COMPOSE_FILE=compose.yml:compose.proxy.yml`) upgrades and runs apps with the same files it was started with.
