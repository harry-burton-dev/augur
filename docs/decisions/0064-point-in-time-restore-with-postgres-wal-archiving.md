# 0064. The database can be restored to a point in time: Postgres archives its WAL, and restic copies it off the server

- **Status:** Proposed
- **Date:** 2026-11-05
- **Decided by:** Harry
- **Replaces:** none. Adds to the nightly backup of [0010](0010-docker-compose-deployments.md)'s Compose deployment and to the off-server copy of [0060](0060-off-server-backups-with-restic.md), which named point-in-time recovery as still owed.

## Context

The nightly dump takes the database back to last night at best. A mistake at 10:31 (a bulk delete, a bad migration, a wrong upgrade) loses everything since 02:00 if the dump is all there is, and a lost server loses everything since the last copy off it. The alpha's Goal 24 carried point-in-time recovery past ADR 0060 (PER-268): restore the database to a chosen moment, keep a weekly restore test that proves it, and say in Admin → Status when it can't be relied on.

Point-in-time recovery in Postgres is always the same mechanism: a base backup of the data folder plus every write-ahead log (WAL) file since, replayed up to the chosen moment. The choice is which tool archives the WAL and where to.

## Options

1. **pgBackRest.** The fullest tool: parallel, incremental and differential backups, its own S3 repository, retention, checks. But it must run inside the database container (`archive_command = pgbackrest archive-push`), so AUGUR would build and keep its own Postgres image with pgvector and pgBackRest, or add a sidecar sharing the data volume and an SSH or TLS server. It keeps a second, separate repository beside restic's, with its own encryption key and bucket credential to manage.
2. **WAL-G.** One static binary, pushes WAL and base backups straight to S3, with encryption. It too runs from `archive_command` inside the database container, so the same image or volume work as pgBackRest, a second repository and key, and while the bucket can't be reached every finished WAL file waits in `pg_wal`, on the database's own disk, until it can.
3. **Postgres's own archiving to a local folder, copied off with restic.** `archive_command` gzips each finished WAL file into a volume shared with the backup container; `pg_basebackup` (already in the backup container's stock image) takes the nightly base backup over a replication connection; restic, already there for ADR 0060, copies the newest base backup and the archive to the same bucket every hour. No new tool, image or key.

## Decision

Option 3: Postgres's own WAL archiving into a local `wal-archive` volume, with base backups from `pg_basebackup` and the off-server copy by restic.

- **Archiving:** `postgres/start.sh` starts Postgres with `archive_mode=on`, `archive_timeout` of `PITR_ARCHIVE_SECONDS` (900, so at most 15 minutes of changes wait when there are any) and `archive_command` running `postgres/archive-wal.sh`, which gzips each finished WAL file into `/wal-archive`, flushes it, and only then gives it its name. The stock pgvector image stays as it is: the scripts are mounted, and gzip is already in it.
- **Base backups:** each night, after the dump, `pg_basebackup -Ft -z -X none` into `base-<date>/`, beside the dumps; the newest `PITR_KEEP_DAYS` (7) are kept, and archived WAL older than the oldest is dropped with `pg_archivecleanup`. The replication connection is allowed only to the `platform` user by a rule placed before the data folder's own `pg_hba.conf`, which is included unchanged.
- **Off the server:** every hour, the newest base backup (once) and the WAL archive go to the ADR 0060 restic repository as snapshots tagged `augur-base` and `augur-wal`, kept `PITR_KEEP_DAYS` days. A lost server loses at most about an hour and a quarter of changes.
- **Restore:** `backup/restore-to-time.sh "<UTC time>"`, run from the backup service with Postgres stopped and its volume mounted, keeps the current data in a tarball, puts the newest base backup taken before the moment in its place, and has Postgres replay the archive up to the moment and open (`recovery_target_action = 'promote'`). docs/deploy.md, "Restore to a point in time", gives the steps, including from the bucket after a lost server.
- **Test:** the weekly restore test also runs `backup/pitr-test.sh`: it marks a moment on the live database (one transaction and a WAL switch, waiting until that file is archived), restores the newest base backup into a throwaway Postgres in the backup container, replays every archived change since, and checks the replay reached the mark and the platform's and Keycloak's tables are there. It writes `pitr-test.json`.
- **Status:** the backup container writes `pitr.json` every hour from Postgres's own `pg_stat_archiver`, the base backups and the last copy. Admin → Status (gateway contract 1.8.0, `backups.pointInTime`) says "Backups need a look" when Postgres isn't archiving or its archiving fails, a base backup or the hourly copy failed, `pitr.json` is over three hours old, or the replay test failed, hasn't run yet or is over a week old.

## Consequences

- The database can go back to any moment in the last 7 days, here and from the bucket. The dumps stay as they are, for a whole-server restore that doesn't need WAL, and for restoring one database's contents by hand.
- Postgres must restart once to start archiving: `pc up -d` after the upgrade does it. Until it has, Status says the database can only go back to a nightly backup, and how to fix it.
- More disk on the server: 7 compressed base backups (each about the size of the database) beside 14 dumps, plus the gzipped WAL of 7 days. The bucket keeps the same 7 days of base backups (gzipped, so they don't deduplicate) and the WAL.
- Because archiving is to a local folder, an unreachable bucket never stops Postgres recycling its WAL; only the hourly copy falls behind, and Status says so. A full disk does stop archiving, as it would stop the database itself.
- A restore to a moment replaces the whole server's data (every app's schema and Keycloak's), not one app's. Going back for one app only is still a manual job from a restored copy.
- The restore test runs the replay in the backup container's Alpine Postgres against the pgvector image's data folder: fine for replay and the checks it makes, which don't use pgvector's types or collation-sensitive indexes. A real restore runs in the database's own image.
- pgBackRest or WAL-G stay the next step if a deployment outgrows this: incremental base backups for a large database, parallel restore, or archiving straight to the bucket. Either would need its own record and a Postgres image of AUGUR's own.
- Tests: CI's `deploy-images` job starts Postgres as compose.yml does, takes a base backup, runs the replay test, deletes a row and goes back to the moment before with `restore-to-time.sh`; the gateway's `status.test.ts` covers the Status rules. The scripts were also run by hand against the pgvector image, across a restore's new timeline, and with the hourly copy to a restic repository.

## Links

- Linear PER-268, PER-286 (alpha W4.3)
- docs/deploy.md, "Restore to a point in time"
- PostgreSQL 16, "Continuous Archiving and Point-in-Time Recovery": https://www.postgresql.org/docs/16/continuous-archiving.html
