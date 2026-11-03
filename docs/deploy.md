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
- While the repository is private, its images and its releases are too: the deployment needs its own **read key**, one GitHub token with only **read:packages**, saved as `infra/deploy/secrets/github-read-key` (owned by user 1000) with `GITHUB_READ_USER` in `.env`, and Docker signed in with it once (`docker login ghcr.io`). [upgrade.md](upgrade.md#the-read-key) has the steps, including the read-only GitHub account to make it from. With it, the Upgrade Centre and Admin → Apps see new releases, and the updater applies them for you if you turn it on ([upgrade.md](upgrade.md#the-updater)). A server that can't reach GitHub runs releases from your own registry instead ([mirror.md](mirror.md)).
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
- `POSTGRES_PASSWORD`, `KEYCLOAK_ADMIN_PASSWORD`, `IDENTITY_DATABASE_PASSWORD`, `REGISTRY_DATABASE_PASSWORD`, `EVENTS_DATABASE_PASSWORD`, `MODELS_DATABASE_PASSWORD`, `KEYCLOAK_DATABASE_PASSWORD`, `GARAGE_RPC_SECRET`, `GARAGE_ADMIN_TOKEN`, `IDENTITY_CLIENT_SECRET`, `REGISTRY_CLIENT_SECRET`, `EVENTS_CLIENT_SECRET`, `FOLIO_CLIENT_SECRET`, `FOLIO_DATABASE_PASSWORD`, `FOLIO_BUCKET_SECRET`: long random strings, each different. `openssl rand -hex 32` makes one. The `FOLIO_` ones are for Artifacts (Folio in code), the document libraries every deployment ships with.
- **Database logins**: `POSTGRES_PASSWORD` is Postgres's admin login, used only by the storage job and backups. Each platform service (identity, registry, events, models) and Keycloak connects with its own login, which owns only its own schema (Keycloak: its own database) and can't read anyone else's. The storage job makes them from the `*_DATABASE_PASSWORD` values on every `up`, as it does apps' logins, so changing one in `.env` and running `pc up -d` changes it.
- `PLATFORM_ADMIN_*`: you. This is the first person who can sign in, as an admin. The password is only for the first sign-in, when Keycloak asks you to choose a new one.

Then:

```sh
docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env up -d
```

The first pull takes a minute or two. Keycloak needs about a minute to start, and Tailscale fetches its certificate on the first request, so the first page can be slow. Open `PLATFORM_URL` from any device on your tailnet and sign in.

Check on it with `docker compose -f infra/deploy/compose.yml ps` and `... logs -f <service>`.

## Settings and secrets

Each service checks its settings before it starts. In production, a missing one stops it with a list of every problem at once, for example:

```
identity can't start until its settings are fixed:
  - KEYCLOAK_URL is not set: Keycloak as identity reaches it, such as http://keycloak:8080/sso.
```

`pc logs <service>` shows it. Any secret (a password, a client secret, a bucket key, `DATABASE_URL`) can be given as a file instead: set `<NAME>_FILE` to its path inside the container, for a Docker secret or a file decrypted at deploy, and leave `<NAME>` unset. The file's contents, less a final newline, are used.

## Day to day

To shorten the commands: `alias pc='docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env'`.

- **Update** to a new release: see [upgrade.md](upgrade.md). In short, check out its `augur@<version>` tag, set `PLATFORM_VERSION` to it, then `pc pull && pc up -d --remove-orphans`. Services migrate their own database schemas on start.
- **Try a change before it's released**: build the images from your checkout with `pc -f infra/deploy/compose.build.yml up -d --build`, with `PLATFORM_VERSION=local` so a later pull doesn't mistake them for a release, and `NODE_AUTH_TOKEN` set in your shell to a GitHub token with `read:packages` (the builds install the UI kit from GitHub Packages). The Upgrade Centre then shows AUGUR as built from source, based on the last release in the checkout, and offers newer releases against that. To go back to released images without editing `.env`, upgrade from the Upgrade Centre: the workbench (`SERVER_RING=dev`) is offered the newest dev build.
- **Add people**: open **Admin** (admins see it in Apps and on Title). **People** adds someone and gives you a one-time password to pass on; they choose their own when they first sign in. The same screen changes roles and departments, turns someone's sign-in off, and makes a new one-time password. **Departments** adds, renames and fills departments (one can sit inside another), and **Apps** turns an app off without removing it. Every change is in the audit log. Identity manages people in Keycloak as its own sign-in (`platform-identity`), which can manage the `platform` realm and nothing else; its rights come from the realm file on a new server, so identity never holds Keycloak's master admin password (see **Keycloak's admin** below). Identity keeps departments in its own tables (the first start copies Keycloak's groups in once), so Keycloak's own console (`PLATFORM_URL/sso/admin`) is only needed for realm settings. It's closed to the network unless `KEYCLOAK_CONSOLE=open` is in `.env` (below). The realm slows down repeated wrong passwords: after 10 in a row a person waits a minute, growing to 15 minutes, and is never locked out for good. Identity turns this on at start if the realm doesn't have it.
- **Deployment admins** run the deployment itself: its settings, secrets, updates and backups (Admin → Deployment, as it arrives). The role is `deployment-admin`. Identity gives it to `PLATFORM_ADMIN_USER` when nobody has it, and only a deployment admin can give it to someone else, take it away, or turn off, re-email or reset the password of someone who has it, so an admin can't take the deployment over. A deployment admin signs in with a one-time code from an authenticator app as well as their password, and sets one up the first time they sign in with the role. If every deployment admin loses their code, Keycloak's own admin (`KEYCLOAK_ADMIN_USER`, with `KEYCLOAK_CONSOLE=open`) is the way back in: in the console, open the person under **Users**, **Credentials**, and delete their OTP so they set up a new one at their next sign-in. Keep that password somewhere safe and offline.
- **Keycloak's admin**: `KEYCLOAK_ADMIN_PASSWORD` is only read by Keycloak, the first time it starts, to make its master admin. Identity doesn't get it. If identity's log says its own sign-in can't manage the realm (someone removed its roles in the console, say), give identity the admin for one start:

  ```sh
  docker compose -f infra/deploy/compose.yml -f infra/deploy/identity-repair.yml --env-file infra/deploy/.env up -d identity
  ```

  Identity repairs its sign-in and logs that it's done. Then `pc up -d identity`, which starts it again without the password.
- **Apps** that don't ship with AUGUR install and update themselves from their own releases once the [app runner](upgrade.md#the-app-runner) is on: install each from Admin → Apps once. The whole loop, from a developer's pull request to your server, is in [ship-an-app.md](ship-an-app.md).
- **Backups** happen on their own (below).
- **Remove an app** from the catalogue, rather than turning it off in Admin's **Apps** screen (for example the old samples, `sample-board` and `sample-palette`):
  ```sh
  pc exec registry node -e "fetch('http://localhost:8082/v1/apps/' + process.argv[1], { method: 'DELETE', headers: { 'x-user-id': 'server-admin', 'x-user-name': 'Server admin', 'x-user-roles': 'admin' } }).then((r) => console.log(r.status))" sample-board
  ```
  `204` means it's gone. Removing it is recorded in the audit log.
- **An app whose code lives on another site** (its manifest's `entry` is a full address such as `https://apps.example.org/maps/entry.js`, not a path like `/apps/maps/entry.js`) needs that site allowed in two places. In Admin, **Apps**, **Where apps load from**, add `https://apps.example.org`: until then the registry refuses to register the app. And add it to `APP_ORIGINS` in `.env` (space separated), then `pc up -d web`, so the browser will run its code. The site must serve the entry with a CORS header such as `Access-Control-Allow-Origin: PLATFORM_URL`. Removing a site in Admin stops offering its apps straight away; they show as **Blocked** in Apps until it's allowed again.
- **Stop**: `pc down`. Data stays in the `pgdata`, `garage-meta` and `garage-data` volumes; `pc down -v` deletes them.

## Backups

The `backup` container dumps the whole database every night at 02:00 UTC into `infra/deploy/backups/`, as `platform-YYYY-MM-DD.sql.gz`, and keeps the last 14 days. It also takes one when it first starts. Everything lives in that dump: the platform's data, apps' schemas, people's preferences, and Keycloak's users. Apps' files go beside it as `objects-YYYY-MM-DD.tar.gz`. Change the time or how long to keep them with `BACKUP_HOUR_UTC` and `BACKUP_KEEP_DAYS` in `.env`.

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
- **Restore apps' files**: stop Garage, unpack the archive into its volumes, and make the newest metadata snapshot its database:
  ```sh
  pc stop garage
  # The compose project is called "platform", so its volumes are platform_garage-meta and platform_garage-data.
  pc run --rm --no-deps -v platform_garage-meta:/r/meta -v platform_garage-data:/r/data -v "$PWD/infra/deploy/backups:/backups:ro" \
    --entrypoint sh backup -c 'cd /r && tar -xzf /backups/objects-2026-10-18.tar.gz && cp "meta/snapshots/$(ls meta/snapshots | sort | tail -n 1)/db.sqlite" meta/db.sqlite && rm -f meta/db.sqlite-wal meta/db.sqlite-shm'
  pc up -d
  ```

## What's in it

- **Platform services**: identity, registry, events, models (the model gateway, off until you set a model and turn it on; see [Agents and models](agents.md)) and the gateway. Only the gateway is reachable, and only through `/api`. Services talk to each other on the compose network, each signed in as itself: identity makes each platform service's Keycloak client from its `*_CLIENT_SECRET` when it starts.
- **Apps**: Home, and Artifacts, the document libraries, which every deployment ships with (its code name, and the name of its containers, is Folio). It's an ordinary app all the same: its service (`folio`) and rendition worker (`folio-worker`) run in their own containers with their own sign-in, schema and bucket, and it puts itself in Admin, Apps when it starts. Turn it off there, org-wide or floor by floor; it can't be removed. Explorer (code name Auspex) and Data Atlas ship the same way, in containers `auspex` and `atlas`; Data Atlas has its own schema too ([Data Atlas](atlas.md)).
- **The front door** (`web`): nginx serving the shell and the apps' frontends, with `/api` and `/sso` behind it. Each build of an app's frontend is kept in Garage's `augur-frontends` bucket and served from a folder of its own, `/apps/<id>/<version>_<digest>/`, so it never changes under someone using it, and a new build of the same version (on the workbench, say) reaches browsers straight away. The shell's page has a Content Security Policy: the browser runs only scripts from the platform's own address, the shell's import map, and the sites in `APP_ORIGINS`, and the page talks only to the platform (plus those sites). Fonts come from Google Fonts.
- **Storage**: Postgres (with pgvector) holds every service's and app's schema. Garage holds apps' files, reachable only inside the compose network; the `storage` container gives each app in `APP_STORAGE` its own login, schema and bucket ([App storage](app-storage.md)).
- **Sign-in**: Keycloak, imported on first start from `infra/deploy/keycloak/platform-realm.json`, with no test users. Keycloak reads that file only once. If you change `PLATFORM_URL` later, update the **shell** client's redirect URIs and web origins in the admin console.

### Limits at the front door

The front door (`web`) holds every caller to a few limits, set in `.env` and applied by `pc up -d`:

- **Keycloak's own console is closed.** `/sso/admin` and the `master` realm (which holds Keycloak's own admin) answer 404, so nobody on the network can try its admin password. To change realm settings by hand, set `KEYCLOAK_CONSOLE=open`, `pc up -d`, make the change, then remove it and `pc up -d` again.
- **Requests a second from one address.** The API takes `API_RATE_PER_SECOND` (30), with `API_RATE_BURST` (200) let through at once, since a page fires many calls together; sign-in takes `SSO_RATE_PER_SECOND` (10) with `SSO_RATE_BURST` (50). Past them the answer is 429, *Too Many Requests*. The address is the one the proxy in front saw (Tailscale, or a load balancer), passed on in `X-Forwarded-For` and only believed from private addresses.
- **The largest upload**, `MAX_UPLOAD_MB` (2048). Each app has its own lower limit under it.

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

Each service can send OpenTelemetry to a collector: the `observability` profile's Grafana stack on the server, or your organisation's own. It's off until `OTEL_EXPORTER_OTLP_ENDPOINT` is set. See [observability.md](observability.md).

## Upgrading

See [upgrade.md](upgrade.md) for moving from one release to the next.

## If something's wrong

- **The address doesn't resolve**: check that the `platform` machine appears in the Tailscale admin console, and that MagicDNS is on. `pc logs tailscale` shows whether the auth key was accepted.
- **Certificate errors**: HTTPS Certificates must be on in the admin console's DNS page.
- **"You're not signed in" loops, or the sign-in page says invalid redirect**: `PLATFORM_URL` must match the address in your browser exactly, with `https` and no trailing slash.
- **An app is listed but won't open, and the browser console says "Refused to load the script… Content Security Policy"**: its site is allowed in Admin but not in `APP_ORIGINS` (see Day to day).
- **Apps are unavailable**: run `pc logs gateway registry`. If the gateway says the token issuer doesn't match, `PLATFORM_URL` changed after Keycloak first started (see above).
