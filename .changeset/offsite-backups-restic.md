---
'@augur/gateway': minor
'@augur/admin': minor
---

Backups can be copied off the server (ADR 0060). Once `OFFSITE_REPOSITORY`, `OFFSITE_PASSWORD` and the bucket's key are set in `.env`, the backup container copies each night's dump and apps' files with restic to that S3-compatible bucket, encrypted on the server first, and keeps 30 days (`OFFSITE_KEEP_DAILY`). The weekly restore test then restores from the bucket. Admin → Status shows the copy and where the last restore came from, and needs a look while backups stay on the server only (gateway contract 1.7.0: `backups.offsite`, `lastRestoreTest.from`). A new one-shot `backup-tools` container hands restic to the backup container: after upgrading, run `pc up -d backup` once. See docs/deploy.md, "Off-server copy".
