---
title: Backups
description: What AUGUR backs up every night, how it proves a restore works, and how to copy backups off the server.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 5
---

Backups happen on their own. This page says what they hold, how they're tested, how to copy them off the
server, and how to restore from one on the same server. To go back to a moment rather than a night, see
[Restore to a point in time](../restore-to-a-point-in-time/); when the server itself is gone, see
[Restore a lost server](../restore-a-lost-server/).

## Nightly backups

The `backup` container dumps the whole database every night at 02:00 UTC into `infra/deploy/backups/`, as
`platform-YYYY-MM-DD.sql.gz`, and keeps the last 14 days. It also takes one when it first starts. Change the
time or how long to keep them with `BACKUP_HOUR_UTC` and `BACKUP_KEEP_DAYS` in `.env`.

Everything lives in that dump: AUGUR's own data, apps' schemas, people's preferences, and Keycloak's users.
Apps' files go beside it as `objects-YYYY-MM-DD.tar.gz`. The backups hold everyone's data and every login's
password hash, so only root can read them (the commands below read them through a container). What each run
found goes in `infra/deploy/backups/status/`, readable by anyone, and that folder alone is what the gateway
sees, for Deployment → Backups.

Once a week (Sunday, after the backup; `RESTORE_TEST_WEEKDAY` changes the day) it also **tests a restore**:
it loads the newest backup into a throwaway database inside the backup container, checks AUGUR's tables and
Keycloak's people came back, then throws it away. The live database is never touched. It runs once on first
start too.

The test passes or fails on AUGUR's own data: its schemas, logins and Keycloak's database. An app's schema
that doesn't all come back (a table that needs an extension the backup's Postgres lacks, say) is named in the
result under `appsNotRestored`, and Status says which app, but it doesn't fail the test, so an app's data
never stops an AUGUR upgrade. Look at it all the same: until it's fixed, that app's data isn't safely backed
up.

**Deployment → Backups** shows the last backup and the last restore test. Its heading says "Backups need a look"
when the last backup failed or is over a day old, or the last restore test failed or is over a week old.

The backups sit on the same disk as the database, so a lost server loses them too. The off-server copy,
below, fixes that; until it's set up, Deployment → Backups says backups are kept on this server only.

## Off-server copy

Once it's set up, each night's dump and apps' files, and the deployment's `.env` and `secrets/`, are also
copied to a bucket the deployment names, with [restic](https://restic.net). Without `.env` a dump can't be
loaded on a new server (the database logins' passwords are in it) and apps' secrets can't be made again
(`APP_SECRETS_KEY`), so the copy carries them, encrypted like the rest.

restic encrypts everything on the server before it leaves, keeps 30 days of copies (`OFFSITE_KEEP_DAILY`),
and sends only what changed since the night before. The weekly restore test then restores the newest dump
**from the bucket**, so it proves the copy, not only the file on this disk. Deployment → Backups shows the last copy
and where the last restore came from, and says "Backups need a look" when a copy failed or is over a day old.

Any S3-compatible bucket works (AWS S3, Backblaze B2, Wasabi, Cloudflare R2, MinIO, a second Garage, or the
organisation's own object store). Where the bucket lives is this deployment's choice about where its data may
be kept: write it down with the deployment's other settings.

1. **Make a bucket** for this deployment, with **versioning on** and a lifecycle rule that deletes
   noncurrent versions after, say, 60 days.
2. **Make a key that can add but not erase.** restic needs to read, list, write and delete objects in its
   bucket (it tidies its own locks and old copies). Give the key exactly those on that one bucket, and nothing
   else: not `s3:DeleteObjectVersion`, not `s3:PutBucket*` or `s3:PutLifecycleConfiguration`. With versioning
   on, a delete only hides an object, so someone who takes over the server can hide copies but not erase
   them; the lifecycle rule erases them later. On AWS that policy is:
   ```json
   { "Version": "2012-10-17", "Statement": [
     { "Effect": "Allow", "Action": ["s3:ListBucket", "s3:GetBucketLocation"], "Resource": "arn:aws:s3:::augur-backups" },
     { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::augur-backups/*" } ] }
   ```
3. **Make the encryption password** (`openssl rand -hex 32`) and **keep a copy off the server** (a password
   manager), with the other `OFFSITE_*` settings below. Without them nobody, you included, can read the
   copies, and they are all a lost server needs to come back.
4. **Set it in `.env`**, then run `pc up -d backup`:
   ```sh
   OFFSITE_REPOSITORY=s3:https://s3.eu-west-2.amazonaws.com/augur-backups/<this deployment>
   OFFSITE_PASSWORD=<the password>
   OFFSITE_ACCESS_KEY_ID=<the key's id>
   OFFSITE_SECRET_ACCESS_KEY=<the key's secret>
   OFFSITE_REGION=eu-west-2   # if the provider wants one
   ```
   The backup container makes the repository on first use, copies today's backup straight away (taking a
   fresh one first if today's is from before AUGUR had started), and restores it from the bucket once to
   prove it. `pc logs backup` shows each step; `infra/deploy/backups/status/offsite.json` and
   `restore-test.json` hold the results.

It never copies a dump with no AUGUR in it (a new server's Postgres before the registry has started), and
never into a repository that already holds backups another server made, until told this server is that
deployment. Either would be the newest copy, and push the real ones out of the days kept.

## Commands

| To | Run |
| --- | --- |
| Take a backup now | `pc exec backup /bin/sh /backup/backup.sh --once` (it skips a day that already has one; delete today's file first to force it) |
| Test a restore now | `pc exec backup /bin/sh /backup/backup.sh --restore-test` (the result is in `infra/deploy/backups/status/restore-test.json`) |
| Copy off the server now | `pc exec backup /bin/sh /backup/backup.sh --offsite` |
| Test a restore from the bucket now | `pc exec backup /bin/sh /backup/backup.sh --restore-test --offsite` |
| List the copies in the bucket | `pc exec backup /tools/restic snapshots` |

## Restore the database from a backup

This puts the whole database back as it was at that night's backup. Anything saved since is lost, in every
app and in sign-in: check Admin → Activity first. After an upgrade that went back, follow
[When an upgrade goes back by itself](https://github.com/harry-burton-dev/augur/blob/main/docs/upgrade-went-back.md)
instead: it says which file and when.

Stop everything but Postgres (the apps and the updater too, so nothing writes while the dump loads), wait for
Postgres to say `healthy`, load the dump, then start again. The dump drops and recreates each database itself.
`pc stop` stops AUGUR's own Tailscale node too, so reach the server some other way.

```sh
pc stop
pc up -d postgres
pc ps postgres            # again until it says healthy
pc run --rm --no-deps -T --entrypoint gunzip backup -c /backups/platform-2026-10-18.sql.gz | pc exec -T postgres psql -U platform -d postgres
pc up -d
```

What people forgot in the knowledge graph since then stays forgotten: the graph keeps a ledger of each forget
on a volume of its own (`knowledge-ledger`), outside the database, and forgets those again when `pc up -d`
starts it. Its log says how many (`pc logs knowledge-migrate`). The same holds after a
[restore to a point in time](../restore-to-a-point-in-time/).

## Restore apps' files

Stop Garage, unpack the archive into its volumes, and make the newest metadata snapshot its database:

```sh
pc stop garage
# Docker names the volumes after the Compose project: platform unless COMPOSE_PROJECT_NAME in .env names another.
project=$(pc config | sed -n 's/^name: //p'); : "${project:?pc config named no project}"
pc run --rm --no-deps -v "${project}_garage-meta:/r/meta" -v "${project}_garage-data:/r/data" -v "$PWD/infra/deploy/backups:/backups:ro" \
  --entrypoint sh backup -c 'cd /r && tar -xzf /backups/objects-2026-10-18.tar.gz && cp "meta/snapshots/$(ls meta/snapshots | sort | tail -n 1)/db.sqlite" meta/db.sqlite && rm -f meta/db.sqlite-wal meta/db.sqlite-shm'
pc up -d
```
