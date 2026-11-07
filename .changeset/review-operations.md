---
"@augur/updater": patch
---

Upgrades and backups hold up when things go wrong. The updater writes .env whole, refuses an upgrade on a nearly full disk or one whose settings would change what the server trusts, never goes back by itself past a breaking release once a part has restarted, and goes back after a restart partway through. Backups are readable by root alone and the gateway sees only their results; the off-server copy carries .env and secrets, encrypted, and refuses an empty or another server's dump; and the lost-server guide restores before anything is copied. Telemetry and Artifacts' rendition worker get networks of their own. Feed, promote, halt and Lockfile workflows refuse to run outside main or to leak their token, and a beta that fails its deploy test is listed halted.
