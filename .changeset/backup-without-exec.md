---
'@augur/updater': minor
---

The updater takes its backup and restore test in a container of their own made from the backup service (`compose run`), not with `docker exec` into the running one, and the Docker proxy no longer allows exec (`EXEC: 0`). Every backup run waits for any other to finish (a lock in the backups folder), so one never runs beside the nightly work. A first step: the proxy still lets the updater create containers (PER-455).
