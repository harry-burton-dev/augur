---
'@augur/updater': minor
---

The updater now upgrades a server whose deploy files the new release changes, instead of sending it to be upgraded by hand. Each release's updater image carries that release's `infra/deploy`; the updater checks the files against the release file, writes them, starts any part the release adds, and makes again anything that mounts a changed file. Going back puts the old files back. It still stops when a file it would change has been edited on the server. A new required setting ending in `_SECRET`, `_PASSWORD` or `_TOKEN` is made up and added to `.env`. User 1000 now has to be able to write `infra/deploy` (docs/upgrade.md, The updater).
