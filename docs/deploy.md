# Running the platform on your own server

Everything runs in Docker on one machine. It's private to your tailnet: there are no open ports, and Tailscale gives it an HTTPS address that only your devices can reach.

```
your laptop ──tailnet──▶ tailscale ──▶ web (nginx) ─┬─ /            the shell and app bundles
                         (HTTPS)                    ├─ /api/  ──▶ gateway ──▶ identity, registry, events ──▶ postgres
                                                    └─ /sso/  ──▶ keycloak (sign-in) ──────────────────────▶ postgres
```

The setup is in `infra/deploy/`. Each service image is built from this repo on the server, so there's no registry to push to.

## Before you start

- On the server: Docker with the Compose plugin (`docker compose version` should work), and git access to this repo.
- In the [Tailscale admin console](https://login.tailscale.com/admin):
  - **DNS**: turn on MagicDNS and **HTTPS Certificates**. Note your tailnet name, for example `tail1234.ts.net`.
  - **Settings → Keys**: generate an auth key. A reusable key is easiest. Tag it if you use ACL tags.

The server doesn't need Tailscale installed itself. The `tailscale` container joins your tailnet as its own machine, named after `TS_HOSTNAME`.

## First start

```sh
git clone https://github.com/harry-burton-dev/im-platform.git platform && cd platform
cp infra/deploy/.env.example infra/deploy/.env
```

Fill in `infra/deploy/.env`:

- `PLATFORM_URL`: `https://<TS_HOSTNAME>.<tailnet name>`, for example `https://platform.tail1234.ts.net`.
- `TS_AUTHKEY`: the key from the admin console.
- `POSTGRES_PASSWORD`, `SERVICE_TOKEN`, `KEYCLOAK_ADMIN_PASSWORD`: long random strings. `openssl rand -hex 32` makes one.
- `PLATFORM_ADMIN_*`: you. This is the first person who can sign in, as an admin. The password is only for the first sign-in, when Keycloak asks you to choose a new one.

Then:

```sh
docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env up -d --build
```

The first build takes a few minutes. Keycloak needs about a minute to start, and Tailscale fetches its certificate on the first request, so the first page can be slow. Open `PLATFORM_URL` from any device on your tailnet and sign in.

Check on it with `docker compose -f infra/deploy/compose.yml ps` and `... logs -f <service>`.

## Day to day

To shorten the commands: `alias pc='docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env'`.

- **Update**: `git pull && pc up -d --build`. Services migrate their own database schemas on start.
- **Add people**: Keycloak's admin console is at `PLATFORM_URL/sso/admin`. Sign in as `KEYCLOAK_ADMIN_USER` (default `keycloak-admin`), switch to the **platform** realm, and add users under **Users**. Give someone the realm role `admin` to make them an admin. Their **Groups** are their departments. The Admin app will do this later.
- **Backups** happen on their own (below).
- **Stop**: `pc down`. Data stays in the `pgdata` volume; `pc down -v` deletes it.

## Backups

The `backup` container dumps the whole database every night at 02:00 UTC into `infra/deploy/backups/`, as `platform-YYYY-MM-DD.sql.gz`, and keeps the last 14 days. It also takes one when it first starts. Everything lives in that dump: the platform's data, people's preferences, and Keycloak's users. Change the time or how long to keep them with `BACKUP_HOUR_UTC` and `BACKUP_KEEP_DAYS` in `.env`.

The backups sit on the same disk as the database, so copy `infra/deploy/backups/` somewhere else now and then (another machine, or cloud storage).

- **Take one now**: `pc exec backup /bin/sh /backup/backup.sh --once` (it skips a day that already has one; delete today's file first to force it).
- **Restore**: stop everything but Postgres, load the dump, then start again. The dump drops and recreates each database itself.
  ```sh
  pc stop tailscale web gateway identity registry events keycloak backup
  gunzip -c infra/deploy/backups/platform-2026-10-18.sql.gz | pc exec -T postgres psql -U platform -d postgres
  pc up -d
  ```

## What's in it

- **Platform services**: identity, registry, events and the gateway. Only the gateway is reachable, and only through `/api`. Services talk to each other on the compose network with `SERVICE_TOKEN`.
- **Apps**: Home, plus the two sample apps (Board and Palette). The samples are registered by the `register-samples` job, which exits once that's done. The Library app isn't deployed while it's paused.
- **Sign-in**: Keycloak, imported on first start from `infra/deploy/keycloak/platform-realm.json`, with no test users. Keycloak reads that file only once. If you change `PLATFORM_URL` later, update the **shell** client's redirect URIs and web origins in the admin console.

## If something's wrong

- **The address doesn't resolve**: check that the `platform` machine appears in the Tailscale admin console, and that MagicDNS is on. `pc logs tailscale` shows whether the auth key was accepted.
- **Certificate errors**: HTTPS Certificates must be on in the admin console's DNS page.
- **"You're not signed in" loops, or the sign-in page says invalid redirect**: `PLATFORM_URL` must match the address in your browser exactly, with `https` and no trailing slash.
- **Apps are unavailable**: run `pc logs gateway registry`. If the gateway says the token issuer doesn't match, `PLATFORM_URL` changed after Keycloak first started (see above).
