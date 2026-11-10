---
title: Restore to a point in time
description: Put AUGUR's database back as it was at any moment in the last 7 days.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 6
---

A nightly backup can only take the database back to last night. A point-in-time restore goes back to any
moment in the last 7 days: a row deleted by mistake at 10:31 can be had back by going to 10:30. It replaces
the whole database, every app's data and Keycloak's, with how it was then.

## How it works

Postgres archives every change it makes (its write-ahead log, **WAL**) into the `wal-archive` volume as it
goes, gzipped, at most 15 minutes after it was made (`PITR_ARCHIVE_SECONDS`). The backup container takes a
**base backup** of the whole database each night beside the dump, as `base-YYYY-MM-DD/`. Replaying the
archived changes onto a base backup brings the database back as it was at any moment from the oldest base
backup to the newest archived change. The last 7 base backups are kept (`PITR_KEEP_DAYS`), and archived
changes older than the oldest go.

With the [off-server copy](../backups/#off-server-copy) set up, the newest base backup and the WAL archive are
copied to the bucket too, every hour, and the bucket keeps the same 7 days of them. So a lost server loses at
most about an hour of the database's changes, not a day. Apps' files leave the server only with the nightly
copy, so files uploaded since then are lost with it, and their rows come back pointing at nothing. Even from a
nightly backup, files can be up to an hour behind the database: Garage's metadata is the newest of its hourly
snapshots.

Once a week the restore test also proves this: it marks a moment on the live database, restores the newest
base backup into a throwaway Postgres, replays every archived change since, and checks the result reached the
mark and that AUGUR's and Keycloak's tables are there. **Admin → Status** shows "Point in time" with how far
back the database can go and the last test. It says "Backups need a look" when Postgres isn't archiving or its
archiving fails, a base backup failed, the copy off the server failed, or the test failed or is over a week
old. The results are in `infra/deploy/backups/status/pitr.json` and `pitr-test.json`.

To test it now: `pc exec backup /bin/sh /backup/backup.sh --pitr-test`.

## Go back to a moment

Everything after that moment is gone from the live database, though the current data is kept in
`infra/deploy/backups/` first. Times are UTC.

```sh
pc stop                            # everything, Postgres too
pc run --rm --no-deps -v platform_pgdata:/pgdata --entrypoint /bin/sh backup \
  /backup/restore-to-time.sh "2026-11-05 10:30:00"
pc up -d postgres
pc logs -f postgres                # wait for "archive recovery complete"
pc up -d
```

It picks the newest base backup taken before that moment, keeps the current data as
`pgdata-before-restore-<now>.tar.gz`, and tells Postgres to replay the archive up to the moment and then open.
Delete that tarball once you're happy with the result; nothing else does.

## If it goes wrong

- **Postgres stops with "recovery ended before configured recovery target was reached"**: the moment is later
  than the newest archived change. Run it again with an earlier time.
- **To undo a restore**, stop Postgres and unpack `pgdata-before-restore-<now>.tar.gz` into the volume the
  same way.

## When the server is lost

Follow [Restore a lost server](../restore-a-lost-server/) to step 4, so `.env` is the old one and the backup
container hasn't started. Then, in place of step 5, fetch the base backups and the archive from the bucket,
and go back as above:

```sh
pc up -d backup-tools && pc run --rm --no-deps --entrypoint /tools/restic backup restore latest --host augur --tag augur-wal --target /
pc run --rm --no-deps --entrypoint /tools/restic backup restore latest --host augur --tag augur-base --target /
# For an older base backup: pc run --rm --no-deps --entrypoint /tools/restic backup snapshots --tag augur-base,
# then restore that snapshot's id in place of latest.
```
