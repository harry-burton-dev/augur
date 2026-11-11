---
title: Restore a lost server
description: Bring AUGUR back on a new machine from its off-server copy, when the old server and its disk are gone.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 7
---

When the server and its disk are gone, everything comes back from the [off-server copy](../backups/#off-server-copy):
`.env` and `secrets/`, the database and apps' files.

## Before you start

- The `OFFSITE_*` settings you kept off the server.
- A new server ready as in [Install AUGUR, Before you start](../install/#before-you-start).
- Copies made by a release from before `.env` went with them have no `augur-config` snapshot: fill `.env` in
  by hand, with the old passwords if you have them.

:::caution
The backup container must not start until step 7. On a new server it would copy an empty database, or
another server's, over the real copies' place. Nothing here uses `pc` until `.env` is back.
:::

## 1. Get the release

As in [Install AUGUR, step 1](../install/#1-get-the-release), but don't fill in `.env` or run the preflight.

## 2. Reach the copy

Put the off-server settings in a file only you can read, under restic's names, and make a short command for
restic. It runs restic's own image, as you, so what it fetches is yours:

```sh
cd augur
install -m 600 /dev/null offsite.env   # then fill it in:
# RESTIC_REPOSITORY=<OFFSITE_REPOSITORY>
# RESTIC_PASSWORD=<OFFSITE_PASSWORD>
# AWS_ACCESS_KEY_ID=<OFFSITE_ACCESS_KEY_ID>
# AWS_SECRET_ACCESS_KEY=<OFFSITE_SECRET_ACCESS_KEY>
# AWS_DEFAULT_REGION=<OFFSITE_REGION, if it has one>
mkdir -p infra/deploy/restore
restic() { docker run --rm -u "$(id -u):$(id -g)" --env-file offsite.env -e RESTIC_CACHE_DIR=/tmp/cache \
  -v "$PWD/infra/deploy/restore:/restore" "$(sed -n 's/^ *image: \(restic\/restic:.*\)$/\1/p' infra/deploy/compose.yml)" "$@"; }
restic snapshots --host augur
```

## 3. Pick a night and fetch it

Note the ids of its three snapshots, tagged `augur-config`, `augur-db` and `augur-files`, all from the same
night (by id, never `latest`):

```sh
restic restore <augur-config id> --target /restore
restic restore <augur-db id> --target /restore
restic restore <augur-files id> --target /restore
```

`infra/deploy/restore/` now has `deploy/.env` and `deploy/secrets/`, `backups/platform-<date>.sql.gz`,
`objects/{data,meta}` and, once the knowledge graph has had something forgotten,
`knowledge-ledger/forget-ledger.jsonl`.

## 4. Put the settings back

Put back the settings, and check out the release they name:

```sh
install -m 600 infra/deploy/restore/deploy/.env infra/deploy/.env
cp -R infra/deploy/restore/deploy/secrets infra/deploy/
# The services that read secrets/ (the registry and the updater) run as user 1000.
sudo chown -R 1000 infra/deploy/secrets && sudo chmod -R go-rwx infra/deploy/secrets
git checkout "augur@$(sed -n 's/^PLATFORM_VERSION=//p' infra/deploy/.env)"
alias pc='docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env'
```

- If the server runs the updater and your account isn't user 1000, give user 1000 the deploy folder again, as
  when it was set up ([upgrade guide, The updater](https://github.com/harry-burton-dev/augur/blob/main/docs/upgrade.md#the-updater), step 2).
- In the Tailscale admin console, remove the lost server's machine, so the new one can take its name.
- If `TS_AUTHKEY` was a one-off key or has expired, put a new one in `.env`.

## 5. Load the database

Postgres starts empty with the old `.env`'s passwords, which are the ones in the dump:

```sh
pc up -d postgres
pc ps postgres            # again until it says healthy
gunzip -c infra/deploy/restore/backups/platform-<date>.sql.gz | pc exec -T postgres psql -U platform -d postgres
```

Then put the knowledge graph's forget ledger back, if the copy has one, so what people forgot before that
night stays forgotten when AUGUR starts (the knowledge service runs as user 1000):

```sh
[ ! -d infra/deploy/restore/knowledge-ledger ] || pc run --rm --no-deps -v platform_knowledge-ledger:/r -v "$PWD/infra/deploy/restore/knowledge-ledger:/from:ro" \
  --entrypoint sh backup -c 'cp -a /from/. /r/ && chown -R 1000:1000 /r'
```

To go back to a moment rather than that night, follow
[Restore to a point in time, When the server is lost](../restore-to-a-point-in-time/#when-the-server-is-lost)
here instead.

## 6. Put apps' files back

Into Garage's volumes, with the newest metadata snapshot as its database:

```sh
pc run --rm --no-deps -v platform_garage-meta:/r/meta -v platform_garage-data:/r/data -v "$PWD/infra/deploy/restore/objects:/from:ro" \
  --entrypoint sh backup -c 'cp -a /from/meta/. /r/meta/ && cp -a /from/data/. /r/data/ && cp "/r/meta/snapshots/$(ls /r/meta/snapshots | sort | tail -n 1)/db.sqlite" /r/meta/db.sqlite && rm -f /r/meta/db.sqlite-wal /r/meta/db.sqlite-shm'
```

## 7. Start AUGUR and adopt the copy

Run `pc up -d`, sign in, and check people, apps and a few documents are there. Then tell the backup container
this server is the deployment the copy belongs to, so it copies there again. Until then Deployment → Backups says
the copy holds backups this server didn't make.

```sh
pc exec backup /bin/sh /backup/backup.sh --adopt-offsite
```

## 8. Tidy up

```sh
rm -rf infra/deploy/restore offsite.env
```

They hold a copy of `.env` and a dump.
