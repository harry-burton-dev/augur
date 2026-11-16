---
---

`infra/deploy/backup/files-check.sh` restores one night's dump and apps' files together into a throwaway Postgres and Garage, and fails when a frontend the registry has a row for didn't come back; files with no row are counted. CI runs it against a real Garage on every change to the backup. Part of PER-470.
