# Running AUGUR on your own server

Everything runs in Docker on one machine. It's private to your tailnet: there are no open ports, and Tailscale gives it an HTTPS address that only your devices can reach.

```
your laptop ──tailnet──▶ tailscale ──▶ web (nginx) ─┬─ /            the shell and app bundles
                         (HTTPS)                    ├─ /api/  ──▶ gateway ──▶ identity, registry, events ──▶ postgres
                                                    └─ /sso/  ──▶ keycloak (sign-in) ──────────────────────▶ postgres
```

The setup is in `infra/deploy/`. The server runs images CI built and signed for an AUGUR release, pulled from GitHub's container registry (`ghcr.io/harry-burton-dev/im-platform/<part>:<version>`); nothing is built on the server. They run as unprivileged users.

## Before you start

- On the server: Docker with the Compose plugin (`docker compose version` should work), and git access to this repo for the deploy files.
- While the repository is private, its images are too. Make a [classic personal access token](https://github.com/settings/tokens/new?scopes=read:packages) with only **read:packages**, and sign the server in once: `docker login ghcr.io -u <your GitHub login>`, pasting the token as the password.
- In the [Tailscale admin console](https://login.tailscale.com/admin):
  - **DNS**: turn on MagicDNS and **HTTPS Certificates**. Note your tailnet name, for example `tail1234.ts.net`.
  - **Settings → Keys**: generate an auth key. A reusable key is easiest. Tag it if you use ACL tags.

The server doesn't need Tailscale installed itself. The `tailscale` container joins your tailnet as its own machine, named after `TS_HOSTNAME`.

## First start

```sh
git clone https://github.com/harry-burton-dev/im-platform.git platform && cd platform
git checkout augur@0.1.1        # the release you'll run: the newest augur@ under Releases
cp infra/deploy/.env.example infra/deploy/.env
```

Fill in `infra/deploy/.env`:

- `PLATFORM_VERSION`: the same release, without `augur@`, for example `0.1.1`.
- `PLATFORM_URL`: `https://<TS_HOSTNAME>.<tailnet name>`, for example `https://platform.tail1234.ts.net`.
- `TS_AUTHKEY`: the key from the admin console.
- `POSTGRES_PASSWORD`, `KEYCLOAK_ADMIN_PASSWORD`, `IDENTITY_CLIENT_SECRET`, `REGISTRY_CLIENT_SECRET`, `EVENTS_CLIENT_SECRET`: long random strings, each different. `openssl rand -hex 32` makes one.
- `PLATFORM_ADMIN_*`: you. This is the first person who can sign in, as an admin. The password is only for the first sign-in, when Keycloak asks you to choose a new one.

Then:

```sh
docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env up -d
```

The first pull takes a minute or two. Keycloak needs about a minute to start, and Tailscale fetches its certificate on the first request, so the first page can be slow. Open `PLATFORM_URL` from any device on your tailnet and sign in.

Check on it with `docker compose -f infra/deploy/compose.yml ps` and `... logs -f <service>`.

## Day to day

To shorten the commands: `alias pc='docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env'`.

- **Update** to a new release: see [upgrade.md](upgrade.md). In short, check out its `augur@<version>` tag, set `PLATFORM_VERSION` to it, then `pc pull && pc up -d --remove-orphans`. Services migrate their own database schemas on start.
- **Try a change before it's released**: build the images from your checkout with `pc -f infra/deploy/compose.build.yml up -d --build`, with `PLATFORM_VERSION=local` so a later pull doesn't mistake them for a release.
- **Add people**: open **Admin** (admins see it in Apps and on Title). **People** adds someone and gives you a one-time password to pass on; they choose their own when they first sign in. The same screen changes roles and departments, turns someone's sign-in off, and makes a new one-time password. **Departments** adds, renames and fills departments (one can sit inside another), and **Apps** turns an app off without removing it. Every change is in the audit log. Identity manages people in Keycloak as `KEYCLOAK_ADMIN_USER` and keeps departments in its own tables (the first start copies Keycloak's groups in once), so Keycloak's own console (`PLATFORM_URL/sso/admin`) is only needed for realm settings.
- **Backups** happen on their own (below).
- **Remove an app** from the catalogue, rather than turning it off in Admin's **Apps** screen (for example the old samples, `sample-board` and `sample-palette`):
  ```sh
  pc exec registry node -e "fetch('http://localhost:8082/v1/apps/' + process.argv[1], { method: 'DELETE', headers: { 'x-user-id': 'server-admin', 'x-user-name': 'Server admin', 'x-user-roles': 'admin' } }).then((r) => console.log(r.status))" sample-board
  ```
  `204` means it's gone. Removing it is recorded in the audit log.
- **An app whose code lives on another site** (its manifest's `entry` is a full address such as `https://apps.example.org/maps/entry.js`, not a path like `/apps/maps/entry.js`) needs that site allowed in two places. In Admin, **Apps**, **Where apps load from**, add `https://apps.example.org`: until then the registry refuses to register the app. And add it to `APP_ORIGINS` in `.env` (space separated), then `pc up -d web`, so the browser will run its code. The site must serve the entry with a CORS header such as `Access-Control-Allow-Origin: PLATFORM_URL`. Removing a site in Admin stops offering its apps straight away; they show as **Blocked** in Apps until it's allowed again.
- **Stop**: `pc down`. Data stays in the `pgdata` volume; `pc down -v` deletes it.

## Backups

The `backup` container dumps the whole database every night at 02:00 UTC into `infra/deploy/backups/`, as `platform-YYYY-MM-DD.sql.gz`, and keeps the last 14 days. It also takes one when it first starts. Everything lives in that dump: the platform's data, people's preferences, and Keycloak's users. Change the time or how long to keep them with `BACKUP_HOUR_UTC` and `BACKUP_KEEP_DAYS` in `.env`.

Once a week (Sunday, after the backup; `RESTORE_TEST_WEEKDAY` changes the day) it also **tests a restore**: it loads the newest backup into a throwaway database inside the backup container, checks the platform's tables and Keycloak's people came back, then throws it away. The live database is never touched. It runs once on first start too. **Admin → Status** shows the last backup and the last restore test, and its heading says "Backups need a look" when the last backup failed or is over a day old, or the last restore test failed or is over a week old.

The backups sit on the same disk as the database, so copy `infra/deploy/backups/` somewhere else now and then (another machine, or cloud storage).

- **Take one now**: `pc exec backup /bin/sh /backup/backup.sh --once` (it skips a day that already has one; delete today's file first to force it).
- **Test a restore now**: `pc exec backup /bin/sh /backup/backup.sh --restore-test`. The result is in `infra/deploy/backups/restore-test.json`.
- **Restore**: stop everything but Postgres, load the dump, then start again. The dump drops and recreates each database itself.
  ```sh
  pc stop tailscale web gateway identity registry events keycloak backup
  gunzip -c infra/deploy/backups/platform-2026-10-18.sql.gz | pc exec -T postgres psql -U platform -d postgres
  pc up -d
  ```

## What's in it

- **Platform services**: identity, registry, events, models (the model gateway, off until you set a model and turn it on; see [Agents and models](agents.md)) and the gateway. Only the gateway is reachable, and only through `/api`. Services talk to each other on the compose network, each signed in as itself: identity makes each platform service's Keycloak client from its `*_CLIENT_SECRET` when it starts.
- **Apps**: Home. The Library app isn't deployed while it's paused.
- **The front door** (`web`): nginx serving the shell and the apps' frontends, with `/api` and `/sso` behind it. The shell's page has a Content Security Policy: the browser runs only scripts from the platform's own address, the shell's import map, and the sites in `APP_ORIGINS`, and the page talks only to the platform (plus those sites). Fonts come from Google Fonts.
- **Sign-in**: Keycloak, imported on first start from `infra/deploy/keycloak/platform-realm.json`, with no test users. Keycloak reads that file only once. If you change `PLATFORM_URL` later, update the **shell** client's redirect URIs and web origins in the admin console.

## Upgrading

See [upgrade.md](upgrade.md) for moving from one release to the next.

## If something's wrong

- **The address doesn't resolve**: check that the `platform` machine appears in the Tailscale admin console, and that MagicDNS is on. `pc logs tailscale` shows whether the auth key was accepted.
- **Certificate errors**: HTTPS Certificates must be on in the admin console's DNS page.
- **"You're not signed in" loops, or the sign-in page says invalid redirect**: `PLATFORM_URL` must match the address in your browser exactly, with `https` and no trailing slash.
- **An app is listed but won't open, and the browser console says "Refused to load the script… Content Security Policy"**: its site is allowed in Admin but not in `APP_ORIGINS` (see Day to day).
- **Apps are unavailable**: run `pc logs gateway registry`. If the gateway says the token issuer doesn't match, `PLATFORM_URL` changed after Keycloak first started (see above).
