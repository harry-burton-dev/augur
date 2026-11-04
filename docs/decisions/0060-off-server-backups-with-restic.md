# 0060. Backups are copied off the server with restic, encrypted on the server, to a bucket each deployment names

- **Status:** Proposed
- **Date:** 2026-11-04
- **Decided by:** Harry
- **Replaces:** none. Adds to the nightly backup and weekly restore test of [0010](0010-docker-compose-deployments.md)'s Compose deployment.

## Context

The `backup` container dumps the whole Postgres server once a night and tars apps' files beside it, on the same disk as the database. A lost or compromised server loses the backups with it. The alpha's Goal 24 asks for the dumps to be copied off the server: to an S3-compatible bucket set per deployment, encrypted on the server with a key held off it, uploaded with a credential that can't destroy history, 30 daily copies kept, the bucket's location a documented choice of the deployment, and the weekly restore test restoring from the off-server copy (PER-286, PER-268). Point-in-time recovery (pgBackRest or WAL-G) is carried past the alpha.

## Options

1. **restic.** One static binary, BSD-2-Clause, widely used. Encrypts and deduplicates on the client, speaks S3 and many other backends, keeps retention by policy (`forget --keep-daily`), restores single files. Its password is needed on the server to back up, so "held off the server" means a copy is kept off it too.
2. **Borg (borgbackup).** Similar model, but it needs SSH to a Borg server, not a bucket.
3. **rclone or `aws s3 sync` with gpg.** Plain copies: no deduplication, retention and encryption scripted by hand.
4. **pgBackRest or WAL-G to a bucket.** Point-in-time recovery as well, but a larger change to how Postgres runs (WAL archiving from the database container), and it covers only the database, not apps' files. Still the next step (carried).

## Decision

Option 1, restic, run by the existing backup container.

- **Where:** the restic repository named by `OFFSITE_REPOSITORY` in `.env`, any S3-compatible bucket. Each deployment has its own repository. Where it lives is the deployment's own documented choice (docs/deploy.md, "Off-server copy").
- **What and when:** after each nightly dump, the dump (tag `augur-db`) and Garage's blocks and metadata snapshots (tag `augur-files`, never the live metadata database) as two snapshots under the fixed host `augur`. `restic forget --keep-daily $OFFSITE_KEEP_DAILY` (30) runs each night, with `--prune` on the restore test's day.
- **Encryption:** restic encrypts on the server before upload with `OFFSITE_PASSWORD`. The admin keeps a copy of that password off the server, as the guide's setup step says; without it the copies can't be read.
- **Credential:** the bucket's key may read, list, write and delete objects in that one bucket and nothing else, on a bucket with versioning on. A key with no delete at all doesn't work with restic on S3 (it removes its own locks and pruned data), so "can't destroy history" is held by the bucket: without `s3:DeleteObjectVersion` or rights over the bucket's settings, a delete only hides a version until the bucket's lifecycle rule ends it.
- **Restore test:** once there is a good copy, the weekly test (and a first one as soon as the copy is set up) fetches the newest dump from the bucket and restores that into the throwaway Postgres. `restore-test.json` says `"from":"offsite"`.
- **Status:** the container writes `offsite.json`. Admin → Status (gateway contract 1.6.0, `backups.offsite` and `lastRestoreTest.from`) needs a look while backups stay on the server only, when the last copy failed or is over a day old, or when no restore has come from the copy yet.
- **How restic arrives:** the official `restic/restic` image, pinned by tag and kept current by Renovate. A one-shot `backup-tools` service copies its binary into a volume the backup container runs it from, so the backup container stays the stock `postgres:16-alpine` and AUGUR builds no new image.

## Consequences

- A lost server no longer loses its backups, once an admin sets the four `OFFSITE_*` values. Until then every deployment's Status says "Backups need a look" and why. That includes the workbench until its bucket exists (W6.3 server steps).
- One more container in the stack, which runs on `up` and stops. The deploy test and the updater treat it as a job.
- Copies cost bucket storage: 30 days, deduplicated, so apps' files cost little more than one copy plus each day's changes; the dumps are gzipped and don't deduplicate, so they cost about 30 times one dump.
- Restoring a lost server from the bucket is documented step by step (docs/deploy.md); it's rehearsed weekly for the database by the restore test, but not for apps' files.
- Tests: CI's `deploy-images` job copies to a local restic repository, restores from it with the local dumps moved away, and checks a wrong password is reported; the gateway's `status.test.ts` covers the new Status rules. The scripts were also run against a real S3 API (a Garage bucket) by hand.
- Point-in-time recovery (pgBackRest or WAL-G) is still owed and needs its own record.

## Links

- Linear PER-286 (alpha W4.3), PER-268
- docs/deploy.md, "Backups" and "Off-server copy"
- restic: https://restic.net
