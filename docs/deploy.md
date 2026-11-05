# Running AUGUR on your own server

Everything runs in Docker on one machine. It's private to your tailnet: there are no open ports, and Tailscale gives it an HTTPS address that only your devices can reach.

```
your laptop ──tailnet──▶ tailscale ──▶ web (nginx) ─┬─ /            the shell and app bundles
                         (HTTPS)                    ├─ /api/  ──▶ gateway ──▶ identity, registry, events ──▶ postgres
                                                    └─ /sso/  ──▶ keycloak (sign-in) ──────────────────────▶ postgres
```

The setup is in `infra/deploy/`. The server runs images CI built and signed for an AUGUR release, pulled from GitHub's container registry (`ghcr.io/harry-burton-dev/im-platform/<part>:<version>`); nothing is built on the server. They run as unprivileged users.

This guide is one procedure. On an empty server, follow **Before you start** and **First start** from top to bottom, and AUGUR is running, private to your tailnet, backed up and reporting to Backstage, with no step outside them. A staging server, wiping and refreshing one, and taking one out of service follow. The rest is reference, and the [glossary](#glossary) at the end explains the words.

## Before you start

Have these ready. The preflight (step 3) checks what it can of them before anything starts.

1. **A server**: Linux, with 4 CPUs, 16 GB of memory and 200 GB of disk for a staging or small production server (AUGUR's memory limits are sized for 16 GB). It needs Docker with the Compose plugin (`docker compose version` prints a version) and git, and nothing else: no Node, no Tailscale.
2. **Your tailnet.** In the [Tailscale admin console](https://login.tailscale.com/admin):
   - **DNS**: turn on MagicDNS and **HTTPS Certificates**. Note your tailnet name, for example `tail1234.ts.net`.
   - **Settings → Keys**: generate an auth key. A reusable key is easiest. If your policy uses tags, tag it (say `tag:augur`): a tagged machine's key never expires.
   - **A name for the machine**: `TS_HOSTNAME` in `.env`, `platform` unless you set it, and not already used on the tailnet. Give each server its own, such as `augur-staging`. AUGUR's address is then `https://<TS_HOSTNAME>.<tailnet name>`.

   The server doesn't need Tailscale installed itself. The `tailscale` container joins your tailnet as its own machine, named after `TS_HOSTNAME`.
3. **Its entry in Backstage**, if it reports there (a staging server must): the deployment's name in Backstage's `org/deployments.yaml`, and Backstage's address on the tailnet. Step 6 joins them up.
4. **A read key**, only if AUGUR's packages aren't public to you: one GitHub token with only **read:packages**. After step 1, save it as `infra/deploy/secrets/github-read-key` (owned by user 1000), set `GITHUB_READ_USER` in `.env`, and sign Docker in with it once (`docker login ghcr.io`). [upgrade.md](upgrade.md#the-read-key) has the steps, including the read-only GitHub account to make it from. A server that can't reach GitHub runs releases from your own registry instead ([mirror.md](mirror.md)).
5. **For later, but before anyone real works on it**: the organisation's email relay ([Email](#email)) and a bucket off the server for backups ([Off-server copy](#off-server-copy)).

## First start

### 1. Get the release

```sh
git clone https://github.com/harry-burton-dev/augur.git augur && cd augur
git checkout augur@<version>     # the release you'll run: the newest augur@ under Releases
cp infra/deploy/.env.example infra/deploy/.env && chmod 600 infra/deploy/.env
alias pc='docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env'
```

Every command after this runs from the checkout and uses `pc`; put the alias in your shell's profile. The folder's name doesn't matter: the Compose project is always called `platform`.

### 2. Fill in the settings

Open `infra/deploy/.env` and fill in these, which only you know:

<!-- settings: made from infra/deploy/settings.schema.json by `pnpm check:settings --write` -->
| Setting | What to put |
| --- | --- |
| `PLATFORM_VERSION` | The AUGUR release this server runs, such as 0.1.1. |
| `PLATFORM_URL` | AUGUR's address: https://&lt;TS_HOSTNAME>.&lt;your tailnet>.ts.net. |
| `TS_AUTHKEY` | A Tailscale auth key. A secret. |
| `PLATFORM_ADMIN_USER` | The first person who can sign in; identity gives them the deployment-admin role when nobody has it. |
| `PLATFORM_ADMIN_PASSWORD` | That person's password, for the first sign-in only. A secret. |
| `PLATFORM_ADMIN_EMAIL` | That person's email address. |
| `PLATFORM_ADMIN_FIRST_NAME` | That person's first name. |
| `PLATFORM_ADMIN_LAST_NAME` | That person's last name. |

The preflight (step 3) fills in these 26 secrets, each with 64 random hex characters: `POSTGRES_PASSWORD`, `KEYCLOAK_ADMIN_PASSWORD`, `IDENTITY_DATABASE_PASSWORD`, `REGISTRY_DATABASE_PASSWORD`, `EVENTS_DATABASE_PASSWORD`, `MODELS_DATABASE_PASSWORD`, `KEYCLOAK_DATABASE_PASSWORD`, `GARAGE_RPC_SECRET`, `GARAGE_ADMIN_TOKEN`, `FRONTENDS_BUCKET_SECRET`, `IDENTITY_CLIENT_SECRET`, `REGISTRY_CLIENT_SECRET`, `EVENTS_CLIENT_SECRET`, `MODELS_CLIENT_SECRET`, `FOLIO_CLIENT_SECRET`, `FOLIO_DATABASE_PASSWORD`, `FOLIO_BUCKET_SECRET`, `AUSPEX_CLIENT_SECRET`, `ATLAS_CLIENT_SECRET`, `ATLAS_DATABASE_PASSWORD`, `ATLAS_BUCKET_SECRET`, `MANDATE_CLIENT_SECRET`, `MANDATE_DATABASE_PASSWORD`, `MANDATE_BUCKET_SECRET`, `GRAFANA_ADMIN_PASSWORD`, `ALERT_WEBHOOK_TOKEN`.
<!-- /settings -->

- `PLATFORM_VERSION` is the release you checked out, without `augur@`, for example `0.19.0`.
- `PLATFORM_URL` is `https://<TS_HOSTNAME>.<tailnet name>`, for example `https://platform.tail1234.ts.net`, with no trailing slash.
- `PLATFORM_ADMIN_*` is you: the first person who can sign in, as an admin and deployment admin. The password is only for the first sign-in, when Keycloak asks you to choose a new one. `PLATFORM_ADMIN_DEPARTMENT` is your department (`Platform` unless you change it).
- `SERVER_RING` says what kind of server this is: `production` (the default), `preview` for a staging server, or `dev` for the workbench you build on ([release-channels.md](release-channels.md#server-rings)).
- `ORG_NAME`, optional: what the organisation's own floor is called (`Organisation` unless you set it).
- `ORG_PRODUCT_NAME`, optional: what people see the product called, in the browser tab, on the sign-in pages and in emails (`AUGUR` unless you set it, for example `Example, built on AUGUR`). The realm job makes it the realm's display name, and the web container writes it into the shell's page, so a change takes effect at the next `pc up -d`.

The secrets are made for you in step 3. Each is a long random string, different from every other, and Compose refuses to start without the required ones. The `FOLIO_` ones are for Artifacts (Folio in code), the document libraries every deployment ships with; `AUSPEX_` is Explorer's, `ATLAS_` Data Atlas's and `MANDATE_` Mandate's. To set one yourself instead, `openssl rand -hex 32` makes one.

**Database logins**: `POSTGRES_PASSWORD` is Postgres's admin login, used only by the storage job and backups. Each platform service (identity, registry, events, models) and Keycloak connects with its own login, which owns only its own schema (Keycloak: its own database) and can't read anyone else's. The storage job makes them from the `*_DATABASE_PASSWORD` values on every `up`, as it does apps' logins, so changing one in `.env` and running `pc up -d` changes it.

### 3. Run the preflight

The preflight fills in the secrets and checks the server can take AUGUR, before anything starts. It needs nothing but Docker:

```sh
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/augur" -w /augur node:22-alpine node scripts/preflight.mjs --install --fill-secrets
```

`--fill-secrets` writes a random value into each blank secret in `.env` and never changes one that's set. Then it checks, one line each:

- **Release**: the checkout is the release `PLATFORM_VERSION` names.
- **Settings**: every required setting is set, and each value set fits what it must be: `PLATFORM_URL` an https address with no path, `TS_AUTHKEY` a Tailscale key, `PLATFORM_ADMIN_EMAIL` an email address, bucket keys 64 hex characters, passwords at least 16 characters, `SERVER_RING` one of its three. A name in `.env` that no setting has is pointed out, in case it's a typo.
- **Secrets**: no two are the same.
- **Address**: `PLATFORM_URL` names the machine `TS_HOSTNAME` makes.
- **Ring**: what kind of server this is, and whether sample data is allowed (`SEED_ALLOWED`).
- **Read key**: `GITHUB_READ_USER` and `infra/deploy/secrets/github-read-key` are both there, or neither.
- **`.env`** can't be read by other users on the server.
- **Memory and disk**, against the size above.
- And, for reading, what isn't set up yet: reporting to Backstage, the off-server copy, email.

A line starting `✗` stops the install: fix it and run the command again (without `--fill-secrets` it changes nothing). Lines starting `-` are for reading. When it ends `✓ Ready`, go on.

`KEYCLOAK_ADMIN_PASSWORD`, which it made, is Keycloak's own admin: the way back in if every deployment admin loses their sign-in code (below). Copy it from `.env` into your password manager now.

### 4. Start AUGUR

```sh
pc up -d
```

The first pull takes a minute or two. Keycloak needs about a minute to start, and Tailscale fetches its certificate on the first request, so the first page can be slow. `pc ps` shows each container `healthy` when it's ready, and the jobs that run once (`storage`, `keycloak-config`, `backup-tools`) as exited with `0`. `pc logs <service>` says what's wrong with one that isn't.

### 5. Sign in and check it

1. From any device on your tailnet, open `PLATFORM_URL` and sign in as `PLATFORM_ADMIN_USER` with `PLATFORM_ADMIN_PASSWORD`. Choose your own password, then set up a code app or a passkey: deployment admins always sign in with one.
2. Open **Admin → Status**. Every part should say it's working. Under **Backups**, the first backup, the first restore test and the first point-in-time test are run when the backup container starts, so give it a few minutes; a part that isn't working says why.
3. In the Tailscale admin console's **Machines**, the machine named after `TS_HOSTNAME` is there. If its key wasn't tagged, open its menu and choose **Disable key expiry**, or it leaves your tailnet when the key expires (180 days by default).

### 6. Finish setting up

1. **Report to Backstage** ([upgrade.md](upgrade.md#reporting-to-backstage)): set `DEPLOYMENT_ID` to the deployment's name in `org/deployments.yaml` and `PORTAL_URL` to Backstage's address, then `pc up -d registry`. Copy the deployment's key (**Copy key** in the Upgrade Centre's Reporting section) into the entry's `augur.dev/report-key` annotation. Within 15 minutes Backstage shows the deployment, and from then it raises the alarm when a report is more than 30 minutes late, so it notices when the whole server is down.
2. **Prove the alert path** ([observability.md](observability.md#alerts)): open Grafana through `ssh -L 3001:127.0.0.1:3001 <server>` at `http://localhost:3001`, sign in as `admin` with `GRAFANA_ADMIN_PASSWORD` from `.env`, and under **Alerting → Contact points**, open **AUGUR notices** and press **Test**. A notice reaches you, and every deployment admin, in AUGUR within a minute. (observability.md has a way to do it from the command line too.)
3. **Email** ([Email](#email)), so people can reset a forgotten password.
4. **The off-server copy** ([Off-server copy](#off-server-copy)), so a lost server doesn't lose its backups. Until then, Admin → Status says backups are kept on this server only.
5. **Turn on the updater**, if this server should upgrade itself ([upgrade.md](upgrade.md#the-updater)).

Run the preflight once more (without `--fill-secrets`): what's left under `-` is what you chose not to set up. Write down where this deployment's bucket is, its Backstage name and its ring with its other records.

## A staging server

A staging server runs preview releases before they reach production, with sample people and no real ones, so a release can bake there ([ADR 0045](decisions/0045-promote-asks-portal-over-tailscale.md)). Install it with the procedure above, with these differences:

- **`SERVER_RING=preview`** in step 2. It takes preview (beta) releases by default ([release-channels.md](release-channels.md#server-rings)).
- **It joins the tailnet and reports to Backstage** (step 6, item 1), so its bake hours and its heartbeat reach Backstage with no override or hand export. Give it its own `TS_HOSTNAME` and its own entry in `org/deployments.yaml`.
- **Sample data**: set `SEED_ALLOWED=true`, then fill it with the seed's cast ([seed.md](seed.md)). The run suite (`augur-run`) runs only where that's allowed.
- **Everything else is its own**: its own read key, its own bucket (or its own path in one), its own auth key if they aren't reusable. Nothing is shared with production, so a mistake on staging stays there.
- **The same size as production**, so what it shows about memory and speed holds there.

## Wipe and refresh

To take a dev or staging server back to empty, on the same release or a newer one, and keep its settings and its machine on the tailnet:

```sh
pc down
docker volume rm platform_pgdata platform_wal-archive platform_garage-meta platform_garage-data platform_otel-lgtm
sudo rm -rf infra/deploy/backups/*                 # this server's own backups, now of nothing
# For a newer release: git fetch --tags && git checkout augur@<version>, and set PLATFORM_VERSION to it.
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/augur:ro" -w /augur node:22-alpine node scripts/preflight.mjs --install
pc up -d
```

Then sign in again as in step 5: Keycloak starts from its realm file, with you as the only person, and every app's data is gone. The `tailscale` volume stays, so the machine and its address stay too (`pc down -v` would remove it as well, and it would join again with `TS_AUTHKEY`, which a one-off key can't). Afterwards:

- **The deployment's reporting key is new**, because it lived in the database: copy it into Backstage again (step 6, item 1), or Backstage refuses its reports.
- **The off-server copy keeps the copies from before**, until `OFFSITE_KEEP_DAILY` days pass. To start that clean too, point `OFFSITE_REPOSITORY` at a new path.
- **On staging, seed it again** ([seed.md](seed.md)).

## Take a server out of service

When a deployment is no longer needed, end it so nothing is left behind that can sign in, alarm or cost money:

1. **Tell its people**, and let them take out anything they want to keep.
2. **Take a last backup off the server**: `pc exec backup /bin/sh /backup/backup.sh --offsite`. Decide how long to keep the bucket, and note it.
3. **Take it out of Backstage**: remove its entry from `org/deployments.yaml`, so Backstage doesn't raise the alarm when its reports stop.
4. **Stop it and remove its data**: `pc down -v`, then delete the checkout with `infra/deploy/.env`, `infra/deploy/secrets/` and `infra/deploy/backups/` (`sudo rm -rf`, since containers own some of it).
5. **Take it off the tailnet**: in the Tailscale admin console, remove the machine, and revoke its auth key if it was made for this server.
6. **Revoke what it held**: its read key in GitHub, its sign-in at the email relay, and its bucket key. When the bucket's time is up, delete the bucket, and only then the encryption password (`OFFSITE_PASSWORD`) and `KEYCLOAK_ADMIN_PASSWORD` from your password manager.

## Settings and secrets

Each service checks its settings before it starts. In production, a missing one stops it with a list of every problem at once, for example:

```
identity can't start until its settings are fixed:
  - KEYCLOAK_URL is not set: Keycloak as identity reaches it, such as http://keycloak:8080/sso.
```

`pc logs <service>` shows it.

Every setting a deployment can set is described once, in `infra/deploy/settings.schema.json`: which services read it, whether it's required, its default, whether it's a secret, and the guide section that explains it. `.env.example` lists them all. CI's `pnpm check:settings` holds `compose.yml`, `.env.example`, the guides and the services' code to it, so a setting the guides tell you to put in `.env` always reaches the service that reads it. Compose passes each one by name to the services that read it; only the storage job, which reads every app's secrets by the app's name, reads the whole `.env`.

Any secret (a password, a client secret, a bucket key, `DATABASE_URL`) can be given as a file instead: set `<NAME>_FILE` to its path inside the container, for a Docker secret or a file decrypted at deploy, and leave `<NAME>` unset. The file's contents, less a final newline, are used.

## Day to day

`pc` is the alias from step 1: `alias pc='docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env'`.

- **Update** to a new release: see [upgrade.md](upgrade.md). In short, check out its `augur@<version>` tag, set `PLATFORM_VERSION` to it, then `pc pull && pc up -d --remove-orphans`. Services migrate their own database schemas on start.
- **Try a change before it's released**: build the images from your checkout with `pc -f infra/deploy/compose.build.yml up -d --build`, with `PLATFORM_VERSION=local` so a later pull doesn't mistake them for a release, and `NODE_AUTH_TOKEN` set in your shell to a GitHub token with `read:packages` (the builds install the UI kit from GitHub Packages). The Upgrade Centre then shows AUGUR as built from source, based on the last release in the checkout, and offers newer releases against that. To go back to released images without editing `.env`, upgrade from the Upgrade Centre: the workbench (`SERVER_RING=dev`) is offered the newest dev build.
- **Add people**: open **Admin** (admins see it in Apps and on Title). **People** adds someone and gives you a one-time password to pass on; they choose their own when they first sign in. The same screen changes roles and departments, turns someone's sign-in off, and makes a new one-time password. In a person's details, turning their sign-in off and a new one-time password act at once, after you confirm, in their own section; their name, email, department and roles change only when you press Save. **Departments** adds, renames and fills departments (one can sit inside another), and **Apps** turns an app off without removing it. Every change is in the audit log. Identity manages people in Keycloak as its own sign-in (`platform-identity`), which may manage people, departments and apps' sign-ins in the `platform` realm and nothing else: it can't change the realm's settings or how anyone signs in, and it never holds Keycloak's master admin password (see **The realm job** below). Identity keeps departments in its own tables (the first start copies Keycloak's groups in once), so Keycloak's own console (`PLATFORM_URL/sso/admin`) is rarely needed. It's closed to the network unless `KEYCLOAK_CONSOLE=open` is in `.env` (below).
- **Deployment admins** run the deployment itself: its settings, secrets, updates and backups (Admin → Deployment, as it arrives). The role is `deployment-admin`. Identity gives it to `PLATFORM_ADMIN_USER` when nobody has it, and only a deployment admin can give it to someone else, take it away, or turn off, re-email or reset the password of someone who has it, so an admin can't take the deployment over. Admins and deployment admins sign in with a one-time code from an authenticator app, or with a passkey, as well as their password, and set up a code the first time they sign in with the role. If every deployment admin loses their code, Keycloak's own admin (`KEYCLOAK_ADMIN_USER`, with `KEYCLOAK_CONSOLE=open`) is the way back in: in the console, open the person under **Users**, **Credentials**, and delete their OTP so they set up a new one at their next sign-in. Keep that password somewhere safe and offline.
- **The realm job**: Keycloak reads its realm file only on its first start, so everything else about sign-in is kept as code and applied by `keycloak-config`, a container that runs on every `pc up -d` (so on every upgrade), sets the realm up and stops, before identity starts (ADR 0057). It sets: passwords of at least 15 characters, not the username or email, checked against a breached-password list (`infra/deploy/keycloak/password-blacklists`) and never forced to change; a growing wait after 10 wrong passwords in a row, up to 15 minutes, never a permanent lock; a code app or a passkey as a second step for admins and deployment admins, and offered to everyone; passkeys in the sign-in form; sessions that end after 8 hours unused or 10 hours at most; sign-in events kept 90 days and admins' changes 365; the profile fields (job title, phone, pronouns, picture, language); the platform's roles; each platform service's sign-in; and identity's rights. A deployment can be stricter, never looser: `REALM_PASSWORD_MIN_LENGTH`, `REALM_PASSWORD_DENYLIST`, `REALM_SESSION_IDLE_HOURS`, `REALM_SESSION_MAX_HOURS`, `REALM_SIGN_IN_EVENT_DAYS` and `REALM_ADMIN_EVENT_DAYS` in `.env` (see `.env.example`). `pc logs keycloak-config` says what it changed. It is the only part of AUGUR that signs in as Keycloak's master admin (`KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PASSWORD`): if you change that password in Keycloak's console, change it in `.env` too, or the job (and so identity) won't start. If identity's log says its own sign-in lacks the rights it needs (someone changed them in the console, say), run the job again: `pc up -d keycloak-config identity`. A change made by hand in the console to something the job sets is put back on the next `up`.
- **Apps** that don't ship with AUGUR install and update themselves from their own releases once the [app runner](upgrade.md#the-app-runner) is on: install each from Admin → Apps once. The whole loop, from a developer's pull request to your server, is in [ship-an-app.md](ship-an-app.md).
- **Backups** happen on their own (below).
- **Remove an app** from the catalogue, rather than turning it off in Admin's **Apps** screen (for example the old samples, `sample-board` and `sample-palette`):
  ```sh
  pc exec registry node -e "fetch('http://localhost:8082/v1/apps/' + process.argv[1], { method: 'DELETE', headers: { 'x-user-id': 'server-admin', 'x-user-name': 'Server admin', 'x-user-roles': 'admin' } }).then((r) => console.log(r.status))" sample-board
  ```
  `204` means it's gone. Removing it is recorded in the audit log.
- **An app whose code lives on another site** (its manifest's `entry` is a full address such as `https://apps.example.org/maps/entry.js`, not a path like `/apps/maps/entry.js`) needs that site allowed in two places. In Admin, **Apps**, **Where apps load from**, add `https://apps.example.org`: until then the registry refuses to register the app. And add it to `APP_ORIGINS` in `.env` (space separated), then `pc up -d web`, so the browser will run its code. The site must serve the entry with a CORS header such as `Access-Control-Allow-Origin: PLATFORM_URL`. Removing a site in Admin stops offering its apps straight away; they show as **Blocked** in Apps until it's allowed again.
- **Stop**: `pc down`. Data stays in the Compose project's volumes (`pgdata`, `wal-archive`, `garage-meta`, `garage-data`, and the others in `compose.yml`); `pc down -v` deletes them all. [Wipe and refresh](#wipe-and-refresh) empties a server and keeps its machine on the tailnet.

## Email

AUGUR sends email through the organisation's own SMTP relay ([ADR 0035](decisions/0035-email-through-the-organisations-relay.md)). Without one, AUGUR still works: nobody can reset a forgotten password or have their address checked, so an admin passes on one-time passwords by hand, as before.

Set it in `.env`, then `pc up -d`:

- `SMTP_HOST`: the relay, for example `smtp.example.org`.
- `SMTP_FROM`: the address email comes from, which the relay must accept. The product's name (`ORG_PRODUCT_NAME`) is shown as the sender.
- `SMTP_PORT` and `SMTP_SECURITY`: `587` with `starttls` unless you say otherwise; `465` with `tls`; or `none` for a relay on a trusted network that takes plain SMTP.
- `SMTP_USER` and `SMTP_PASSWORD`, if the relay wants a sign-in. `SMTP_PASSWORD` is a secret: keep it out of anything you share.
- `SMTP_REPLY_TO`, optional: where replies go, if not to `SMTP_FROM`.

The realm job (below) points Keycloak at the relay on every `up`, and with a relay it turns on **Forgot password** on the sign-in page and checking a new address by email. `pc logs keycloak-config` says when the relay changed. Without `SMTP_HOST` the job leaves a relay set by hand in Keycloak's console as it is, and offers those two only if there is one. Keycloak's emails use AUGUR's email theme and the realm's languages. To check it works, use **Forgot password** on the sign-in page for your own account.

On the local stack (`infra/docker-compose.yml`) every email goes to Mailpit instead, at http://localhost:8025, and never leaves your machine.

## Backups

The `backup` container dumps the whole database every night at 02:00 UTC into `infra/deploy/backups/`, as `platform-YYYY-MM-DD.sql.gz`, and keeps the last 14 days. It also takes one when it first starts. Everything lives in that dump: the platform's data, apps' schemas, people's preferences, and Keycloak's users. Apps' files go beside it as `objects-YYYY-MM-DD.tar.gz`. Change the time or how long to keep them with `BACKUP_HOUR_UTC` and `BACKUP_KEEP_DAYS` in `.env`.

Once a week (Sunday, after the backup; `RESTORE_TEST_WEEKDAY` changes the day) it also **tests a restore**: it loads the newest backup into a throwaway database inside the backup container, checks the platform's tables and Keycloak's people came back, then throws it away. The live database is never touched. It runs once on first start too. **Admin → Status** shows the last backup and the last restore test, and its heading says "Backups need a look" when the last backup failed or is over a day old, or the last restore test failed or is over a week old.

A nightly dump can only take the database back to last night. **Restoring to a point in time**, below, goes back to any moment in the last 7 days.

The backups sit on the same disk as the database, so a lost server loses them too. The **off-server copy** below fixes that; until it's set up, Admin → Status says backups are kept on this server only.

### Off-server copy

Once it's set up, each night's dump and apps' files are also copied to a bucket the deployment names, with [restic](https://restic.net) (ADR 0060). restic encrypts everything on the server before it leaves, keeps 30 days of copies (`OFFSITE_KEEP_DAILY`), and sends only what changed since the night before. The weekly restore test then restores the newest dump **from the bucket**, so it proves the copy, not only the file on this disk. Admin → Status shows the last copy and where the last restore came from, and says "Backups need a look" when a copy failed or is over a day old.

Any S3-compatible bucket works (AWS S3, Backblaze B2, Wasabi, Cloudflare R2, MinIO, a second Garage, or the organisation's own object store). Where the bucket lives is this deployment's choice about where its data may be kept: write it down with the deployment's other settings.

1. **Make a bucket** for this deployment, with **versioning on** and a lifecycle rule that deletes noncurrent versions after, say, 60 days.
2. **Make a key that can add but not erase.** restic needs to read, list, write and delete objects in its bucket (it tidies its own locks and old copies). Give the key exactly those on that one bucket, and nothing else: not `s3:DeleteObjectVersion`, not `s3:PutBucket*` or `s3:PutLifecycleConfiguration`. With versioning on, a delete only hides an object, so someone who takes over the server can hide copies but not erase them; the lifecycle rule erases them later. On AWS that policy is:
   ```json
   { "Version": "2012-10-17", "Statement": [
     { "Effect": "Allow", "Action": ["s3:ListBucket", "s3:GetBucketLocation"], "Resource": "arn:aws:s3:::augur-backups" },
     { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::augur-backups/*" } ] }
   ```
3. **Make the encryption password** (`openssl rand -hex 32`) and **keep a copy off the server** (a password manager): without it nobody, you included, can read the copies.
4. **Set it in `.env`**, then `pc up -d backup`:
   ```sh
   OFFSITE_REPOSITORY=s3:https://s3.eu-west-2.amazonaws.com/augur-backups/<this deployment>
   OFFSITE_PASSWORD=<the password>
   OFFSITE_ACCESS_KEY_ID=<the key's id>
   OFFSITE_SECRET_ACCESS_KEY=<the key's secret>
   OFFSITE_REGION=eu-west-2   # if the provider wants one
   ```
   The backup container makes the repository on first use, copies today's backup straight away, and restores it from the bucket once to prove it. `pc logs backup` shows each step; `infra/deploy/backups/offsite.json` and `restore-test.json` hold the results.

- **Copy now**: `pc exec backup /bin/sh /backup/backup.sh --offsite`.
- **Test a restore from the bucket now**: `pc exec backup /bin/sh /backup/backup.sh --restore-test --offsite`.
- **List the copies**: `pc exec backup /tools/restic snapshots`.
- **Restore from the bucket** (the server's own backups are gone): on the new server, set the same `OFFSITE_*` in `.env`, start Postgres and the backup container, fetch the newest copy into `infra/deploy/backups/`, then restore it as above:
  ```sh
  pc up -d postgres backup
  pc exec backup /tools/restic restore latest --host augur --tag augur-db --target /backups/from-offsite
  # The dump is in infra/deploy/backups/from-offsite/backups/; load it as in "Restore" above.
  pc exec backup /tools/restic restore latest --host augur --tag augur-files --target /backups/from-offsite
  # Apps' files are in .../from-offsite/objects/{data,meta}: copy them into Garage's volumes as in
  # "Restore apps' files" above, in place of unpacking the archive.
  ```

- **Take one now**: `pc exec backup /bin/sh /backup/backup.sh --once` (it skips a day that already has one; delete today's file first to force it).
- **Test a restore now**: `pc exec backup /bin/sh /backup/backup.sh --restore-test`. The result is in `infra/deploy/backups/restore-test.json`.
- **Restore**: stop everything but Postgres, load the dump, then start again. The dump drops and recreates each database itself.
  ```sh
  pc stop tailscale web gateway identity registry events keycloak backup
  gunzip -c infra/deploy/backups/platform-2026-10-18.sql.gz | pc exec -T postgres psql -U platform -d postgres
  pc up -d
  ```
- **Restore apps' files**: stop Garage, unpack the archive into its volumes, and make the newest metadata snapshot its database:
  ```sh
  pc stop garage
  # The compose project is called "platform", so its volumes are platform_garage-meta and platform_garage-data.
  pc run --rm --no-deps -v platform_garage-meta:/r/meta -v platform_garage-data:/r/data -v "$PWD/infra/deploy/backups:/backups:ro" \
    --entrypoint sh backup -c 'cd /r && tar -xzf /backups/objects-2026-10-18.tar.gz && cp "meta/snapshots/$(ls meta/snapshots | sort | tail -n 1)/db.sqlite" meta/db.sqlite && rm -f meta/db.sqlite-wal meta/db.sqlite-shm'
  pc up -d
  ```

### Restore to a point in time

Postgres archives every change it makes (its write-ahead log, WAL) into the `wal-archive` volume as it goes, gzipped, at most 15 minutes after it was made (`PITR_ARCHIVE_SECONDS`), and the backup container takes a **base backup** of the whole database each night beside the dump, as `base-YYYY-MM-DD/` (ADR 0064). Replaying the archived changes onto a base backup brings the database back as it was at any moment you choose, from the oldest base backup to the newest archived change: a row deleted by mistake at 10:31 can be had back by going to 10:30. The last 7 base backups are kept (`PITR_KEEP_DAYS`), and archived changes older than the oldest go.

With the off-server copy set up, the newest base backup and the WAL archive are copied to the bucket too, every hour, and the bucket keeps the same 7 days of them. So a lost server loses at most about an hour of changes, not a day.

Once a week the restore test also proves this: it marks a moment on the live database, restores the newest base backup into a throwaway Postgres, replays every archived change since, and checks the result reached the mark and that the platform's and Keycloak's tables are there. **Admin → Status** shows "Point in time" with how far back the database can go and the last test, and says "Backups need a look" when Postgres isn't archiving or its archiving fails, a base backup failed, the copy off the server failed, or the test failed or is over a week old. The results are in `infra/deploy/backups/pitr.json` and `pitr-test.json`.

The first start after this arrived restarts Postgres with archiving on (`pc up -d` does it); the backup container then takes the first base backup and runs the first test straight away.

- **Test it now**: `pc exec backup /bin/sh /backup/backup.sh --pitr-test`.
- **Go back to a moment.** It replaces the whole database (every app's data and Keycloak's) with how it was then: everything after that moment is gone from the live database, though the current data is kept in `infra/deploy/backups/` first. Times are UTC.
  ```sh
  pc stop                            # everything, Postgres too
  pc run --rm --no-deps -v platform_pgdata:/pgdata --entrypoint /bin/sh backup \
    /backup/restore-to-time.sh "2026-11-05 10:30:00"
  pc up -d postgres
  pc logs -f postgres                # wait for "archive recovery complete"
  pc up -d
  ```
  It picks the newest base backup taken before that moment, keeps the current data as `pgdata-before-restore-<now>.tar.gz` (delete it once you are happy with the result; nothing else does), and tells Postgres to replay the archive up to the moment and then open. A moment later than the newest archived change makes Postgres stop with "recovery ended before configured recovery target was reached": run it again with an earlier time. To undo a restore, stop Postgres and unpack that tarball into the volume the same way.
- **Go back to a moment when the server is lost**: on the new server, set the same `OFFSITE_*` in `.env`, fetch the base backups and the archive from the bucket, then go back as above:
  ```sh
  pc up -d backup-tools && pc run --rm --no-deps --entrypoint /tools/restic backup restore latest --host augur --tag augur-wal --target /
  pc run --rm --no-deps --entrypoint /tools/restic backup restore latest --host augur --tag augur-base --target /
  # For an older base backup: pc run --rm --no-deps --entrypoint /tools/restic backup snapshots --tag augur-base,
  # then restore that snapshot's id in place of latest.
  ```

## What's in it

- **Platform services**: identity, registry, events, models (the model gateway, off until you set a model and turn it on; see [Agents and models](agents.md)) and the gateway. Only the gateway is reachable, and only through `/api`. Services talk to each other on the compose network, each signed in as itself: the realm job makes each platform service's Keycloak client from its `*_CLIENT_SECRET` on every `up`.
- **Apps**: Home, and Artifacts, the document libraries, which every deployment ships with (its code name, and the name of its containers, is Folio). It's an ordinary app all the same: its service (`folio`) and rendition worker (`folio-worker`) run in their own containers with their own sign-in, schema and bucket, and it puts itself in Admin, Apps when it starts. Turn it off there, org-wide or floor by floor; it can't be removed. Explorer (code name Auspex) and Data Atlas ship the same way, in containers `auspex` and `atlas`; Data Atlas has its own schema too ([Data Atlas](atlas.md)).
- **The front door** (`web`): nginx serving the shell and the apps' frontends, with `/api` and `/sso` behind it. Each build of an app's frontend is kept in Garage's `augur-frontends` bucket and served from a folder of its own, `/apps/<id>/<version>_<digest>/`, so it never changes under someone using it, and a new build of the same version (on the workbench, say) reaches browsers straight away. The shell's page has a Content Security Policy: the browser runs only scripts from the platform's own address, the shell's own inline scripts (its import map and the note shown if the kit can't be loaded), the kit's site when `KIT_URL` names another, and the sites in `APP_ORIGINS`, and the page talks only to the platform (plus those sites). Fonts come from Google Fonts.
- **Storage**: Postgres (with pgvector) holds every service's and app's schema. Garage holds apps' files, reachable only inside the compose network; the `storage` container gives each app in `APP_STORAGE` its own login, schema and bucket ([App storage](app-storage.md)).
- **Sign-in**: Keycloak, imported on first start from `infra/deploy/keycloak/platform-realm.json`, with no test users, then kept up to date by the realm job (above). Keycloak reads that file only once. If you change `PLATFORM_URL` later, update the **shell** client's redirect URIs and web origins in the admin console.
- **Sign-in pages and emails**: AUGUR's own Keycloak image (`keycloak`, built and signed with each release) carries AUGUR's sign-in and email theme ([ADR 0041](decisions/0041-keycloakify-sign-in-theme.md)), and the realm job turns it on. The pages show the organisation's name (`ORG_NAME`, the same setting identity uses) and, if `ORG_LOGO_URL` is set, its logo; the product's name is the realm's display name, which the realm job sets from `ORG_PRODUCT_NAME` (default `AUGUR`), so emails' subjects and passkey prompts show it too. They are offered in the languages in `REALM_LANGUAGES` (default `en`; any language Keycloak has, the first being the default), with a language menu when there is more than one, and each person's choice is kept as their `locale`. Every word on them is Keycloak's own, so each language is complete. On a Keycloak without the theme, such as Keycloak's own image, the realm job leaves Keycloak's look and says so in `pc logs keycloak-config`.

### Limits at the front door

The front door (`web`) holds every caller to a few limits, set in `.env` and applied by `pc up -d`:

- **Keycloak's own console is closed.** `/sso/admin` and the `master` realm (which holds Keycloak's own admin) answer 404, so nobody on the network can try its admin password. To change realm settings by hand, set `KEYCLOAK_CONSOLE=open`, `pc up -d`, make the change, then remove it and `pc up -d` again.
- **Requests a second from one address.** The API takes `API_RATE_PER_SECOND` (30), with `API_RATE_BURST` (200) let through at once, since a page fires many calls together; sign-in takes `SSO_RATE_PER_SECOND` (10) with `SSO_RATE_BURST` (50). Past them the answer is 429, *Too Many Requests*. The address is the one the proxy in front saw (Tailscale, or a load balancer), passed on in `X-Forwarded-For` and only believed from private addresses.
- **The largest upload**, `MAX_UPLOAD_MB` (2048). Each app has its own lower limit under it.

### Logs, memory and health

- **Logs** are kept by Docker, at most three files of 10 MB per container (`LOG_MAX_SIZE`, `LOG_MAX_FILES` in `.env`), so they can't fill the disk. `pc logs` reads them as before. For anything longer, look in the deployment's Grafana, which keeps 72 hours ([Traces, metrics and logs](#traces-metrics-and-logs)).
- **Memory limits** on the containers that can take a lot: Keycloak (`KEYCLOAK_MEM_LIMIT`, 2g; it sizes its Java heap from it), Artifacts' rendition worker (`FOLIO_WORKER_MEM_LIMIT`, 4g; reading a large upload is what needs it) and the observability stack (`OTEL_LGTM_MEM_LIMIT`, 2g). A container that goes over is stopped and started again by Docker, and `pc ps` shows it restarting. Raise the limit in `.env` and `pc up -d` if it keeps happening; a server with 16 GB fits the defaults with room to spare.
- **Health**: every AUGUR service, the front door, Postgres, Keycloak and Garage have a healthcheck, and `pc ps` shows each as `healthy`. Keycloak's is its own readiness check on its management port, which isn't reachable from outside the container. The front door, identity and the realm job wait for Keycloak to be healthy, and the storage job for Garage. Keycloak's first start after an upgrade can take a few minutes while it migrates its database; Compose waits up to five.
- **Timeouts between services**: one AUGUR service waits at most 5 seconds for another (`SERVICE_CALL_TIMEOUT_SECONDS`) before it gives up and answers that the other can't be reached right now, so a hung service slows only what needs it instead of every request through the gateway. Identity waits up to 15 seconds for Keycloak's admin API, and calls to the model gateway up to 3 minutes. Raise it only if `pc logs` shows a slow but working server giving up.
- **Query time limits**: Postgres cancels any one query from an AUGUR service after a minute (`DATABASE_STATEMENT_TIMEOUT_SECONDS`; 0 for no limit), so a query stuck on a lock or a bad plan fails its request instead of holding a connection until the service runs out. Migrations are never limited.

### The UI kit

The shell and every app share one copy of the UI kit (React, Common and Quill), the version this AUGUR release pinned in `release/kit.json` ([ADR 0048](decisions/0048-kit-served-from-a-kit-url.md)). The front door serves it at `PLATFORM_URL/kit/<version>/`, and `KIT_URL` in `.env` says where browsers load it from:

- **Unset, or `/kit/`** (the default): from this server. Nothing else to do.
- **A CDN in front**: set `KIT_URL` to an https address, ending in `/`, that serves the same files at the same paths, for example a CDN that mirrors `PLATFORM_URL/kit/`. It must send `Access-Control-Allow-Origin` for `PLATFORM_URL`, because the browser loads the kit as modules. Then `pc up -d web`. The page names the full version, so the CDN can keep each file forever.

The page holds every kit file to the hash in the release, so a CDN that serves anything else is refused, and the shell then shows a note naming `KIT_URL` instead of a blank page. The front door's Content Security Policy allows the kit's site when it isn't this one. A `KIT_URL` that isn't a path or an https address is ignored and the default is used: `pc logs web` says so.

## Open AUGUR to the internet for a while

AUGUR is private to your tailnet. To reach it from anywhere for a while (a phone off the tailnet, a demo on someone else's laptop), open it through [Tailscale Funnel](https://tailscale.com/kb/1223/funnel):

```sh
infra/deploy/public.sh on 2h     # 30m, 2h, 1d; 2h when not given, 24 hours at most
infra/deploy/public.sh status    # open or private, and until when
infra/deploy/public.sh off       # close it now
```

It's the address AUGUR already has (`PLATFORM_URL`), so sign-in, Keycloak's redirects and `APP_ORIGINS` need no changes, and your tailnet keeps working throughout. Switching restarts the `tailscale` container, so the address drops for a few seconds.

- **What's opened**: only the front door (`web`): the shell, apps, `/api` and sign-in. Nothing else on the server is reachable (the CI runner and the other containers aren't), and Keycloak's own console answers 404 to the internet even with `KEYCLOAK_CONSOLE=open`: Tailscale marks every request that comes through Funnel, and the front door goes by that.
- **It closes by itself** when the time is up. The time is kept in `infra/deploy/tailscale/public-until`, which the `tailscale` container checks every 10 seconds, so it holds over a restart or a reboot, and a time gone by is private. Run `on` again before then to keep it open longer.
- **It's said, not hidden**: while it's open, Admin → Status says *Open to the internet until …* above everything else.
- **Who gets in**: anyone with the address reaches the sign-in page, and only people with an account get past it. Sign-in keeps its limits (above) and Keycloak locks an account out for a while after 10 wrong passwords. Funnel relays traffic through Tailscale, so large uploads are slower than on the tailnet.

**Once, before the first time**, allow Funnel for the AUGUR machine in your tailnet's policy. In the [Tailscale admin console](https://login.tailscale.com/admin):

1. **Machines**: find the AUGUR machine (named after `TS_HOSTNAME`) and note whether it shows a tag, such as `tag:augur`. It has one if its auth key was tagged.
2. **Access controls**: in the policy file, add an entry to `nodeAttrs` (make the list if it isn't there) and save:
   ```json
   "nodeAttrs": [
     { "target": ["autogroup:member"], "attr": ["funnel"] }
   ]
   ```
   For a tagged machine, put its tag as the target instead (`"target": ["tag:augur"]`): `autogroup:member` covers machines signed in as a person, not tagged ones.
3. **DNS**: HTTPS Certificates are already on if AUGUR works at its `https://` address; Funnel needs them too.

The policy reaches the machine within a minute, with no restart. `public.sh on` checks it first and says so if Funnel isn't allowed yet. If Tailscale still won't start open, the container comes back private by itself rather than going down, and `public.sh status` says what happened (`pc logs tailscale` has the details).

## Traces, metrics and logs

Each service sends OpenTelemetry to the deployment's own Grafana stack (otel-lgtm), which also runs AUGUR's alert rules, or to your organisation's collector. Set `GRAFANA_ADMIN_PASSWORD` and `ALERT_WEBHOOK_TOKEN` in `.env`. See [observability.md](observability.md).

## Sample data

A dev, staging or demo server can be filled with synthetic people, floors, documents and entities by `pnpm seed` (docs/seed.md). It works only where `.env` sets `SEED_ALLOWED=true`, and Admin's Status says whether it is allowed. Never set it where real people work.

## Upgrading

See [upgrade.md](upgrade.md) for moving from one release to the next.

## If something's wrong

- **The address doesn't resolve**: check that the `platform` machine appears in the Tailscale admin console, and that MagicDNS is on. `pc logs tailscale` shows whether the auth key was accepted.
- **Certificate errors**: HTTPS Certificates must be on in the admin console's DNS page.
- **"You're not signed in" loops, or the sign-in page says invalid redirect**: `PLATFORM_URL` must match the address in your browser exactly, with `https` and no trailing slash.
- **The page says AUGUR could not load its UI kit**: the browser couldn't fetch the kit from `KIT_URL`, or what it got didn't match the release's hashes. Open `KIT_URL` followed by the version and `kit.json` in a browser; if it doesn't load or differs from `PLATFORM_URL/kit/<version>/kit.json`, fix the CDN or remove `KIT_URL` from `.env` and `pc up -d web`.
- **An app is listed but won't open, and the browser console says "Refused to load the script… Content Security Policy"**: its site is allowed in Admin but not in `APP_ORIGINS` (see Day to day).
- **Apps are unavailable**: run `pc logs gateway registry`. If the gateway says the token issuer doesn't match, `PLATFORM_URL` changed after Keycloak first started (see above).

## Glossary

- **AUGUR**: the product, and one install of it, a **deployment**: one server running this guide's containers.
- **Release**: one version of AUGUR as a whole, tagged `augur@<version>`, with signed images. `PLATFORM_VERSION` says which one a server runs.
- **Ring**: what kind of server this is (`SERVER_RING`): `dev`, the **workbench** AUGUR is built on; `preview`, a **staging** server that takes releases before production; `production`, every other.
- **Channel**: which releases a server is offered: stable, beta (preview) or dev. A ring has a default channel.
- **Bake**: the hours a release runs on a preview server before it can be made stable. Backstage counts them from the server's reports.
- **Tailnet**: your private Tailscale network. AUGUR is reachable only from devices on it, unless you [open it for a while](#open-augur-to-the-internet-for-a-while). **MagicDNS** gives each machine a name, and **HTTPS Certificates** give it a certificate. An **auth key** lets a machine join.
- **The front door**: the `web` container, the only one reachable. It serves the shell and the apps, and passes `/api` to the gateway and `/sso` to Keycloak.
- **Keycloak**: the sign-in service. Its **realm** `platform` holds the people and the rules for signing in. The **realm job** (`keycloak-config`) sets those rules on every `up`.
- **Admin** and **deployment admin**: an admin manages people, departments and apps in Admin. A deployment admin also runs the deployment itself: its settings, upgrades and backups.
- **Floor**: a level of the organisation (the organisation, a department, a team). Apps show people what their floor allows.
- **Platform apps** and **pillar apps**: the apps that ship with AUGUR. Platform apps are for using and managing it (Home, Admin, Upgrade Centre, Explorer). Pillar apps are the foundation of its output (Artifacts, Mandate, Data Atlas).
- **Preflight**: `scripts/preflight.mjs`, the check before an install (`--install`) or an upgrade.
- **Read key**: the GitHub token a deployment uses to see and pull private releases.
- **Backup**: the nightly dump of the whole database, with apps' files. The **restore test** loads it into a throwaway database each week. The **off-server copy** puts both in a bucket elsewhere, with restic.
- **WAL** and **base backup**: Postgres's record of every change, archived as it goes, and a nightly copy of the database files. Together they allow a **point-in-time restore** to any moment in the last 7 days.
- **Backstage**: the company's portal above every deployment. Each deployment sends it a signed **report** of what it runs every 15 minutes, and Backstage raises the alarm when one is late.
- **Updater**: the optional container that applies upgrades for you, and runs the **app runner**, which installs and updates apps from their own releases.
- **`pc`**: the alias for `docker compose` with this deployment's files (First start, step 1).
