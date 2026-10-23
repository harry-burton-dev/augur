# Upgrading AUGUR

Moving a running server from one release to the next. Commands use the `pc` alias from [deploy.md](deploy.md):

```sh
alias pc='docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env'
```

## Before you start

**Admin → Updates** shows whether a newer release is out, what changes in each part, and a **Needs you first** list: a release you have to go through first, settings to add, breaking changes, and apps that won't open on the new SDK. It fills in the version for the steps below. The registry checks once a day; **Check now** checks straight away.

**Upgrade to …** on that page asks the deployment's updater to run these steps for you: it asks for your password again, then the updater takes a backup, pulls, restarts each part and goes back by itself if anything fails, and the page follows each step. The updater is optional: until you've set it up ([The updater](#the-updater)), an upgrade you ask for just waits; cancel it there and use the steps below. It only applies a release whose deploy files (`infra/deploy`) are the ones your server has. One that changes them, such as a new service, says so on the page and is done with these steps.

1. **Read what changed.** The GitHub release for the AUGUR version you're moving to, `augur@<version>` under Releases, gathers every part's changes, any breaking change and any new setting, and says which versions it upgrades from. If you're more than one release behind and it lists a breaking change, go to the release before it first. Each package's `CHANGELOG.md` has the detail. Look for these, which mean you have something to do:
   - **major** on a service or contract: a caller has to change. The platform's own frontends move with it, but anything you've built against that API needs checking ([versioning.md](versioning.md)).
   - a new or renamed setting in `infra/deploy/.env.example`: copy it into your `.env` before starting.
   - "migration" on a service: it changes its database tables when it starts. Within a major version migrations only add (CI holds every change to that), so the release before still runs on them.
2. **Check the server can take it.** Check out the release's deploy files and run its preflight, which needs nothing installed but Docker:
   ```sh
   git fetch --tags && git checkout augur@<version>
   docker run --rm -v "$PWD:/augur:ro" -w /augur node:22-alpine node scripts/preflight.mjs
   ```
   It reads your `.env`. It stops you if your version can't upgrade straight to this one (and names the release to go through first) or a setting this release needs isn't set, and it lists what the release breaks. Run it again until it says **Ready**.
3. **Check Admin → Status.** Everything should be Running and the heading shouldn't say "Backups need a look". Fix that first, so a problem afterwards is clearly the upgrade's.
4. **Take a backup and test it**, so you can go back:
   ```sh
   pc exec backup /bin/sh /backup/backup.sh --now
   pc exec backup /bin/sh /backup/backup.sh --restore-test
   ```
   The last line ends with `restored and checked`. If it says FAILED, stop and look at why before upgrading.
5. **Note where you are**: the `PLATFORM_VERSION` in your `.env`. That's what you'd go back to.

## Upgrade

```sh
v=0.1.2                                   # the release you checked out for the preflight
sed -i "s/^PLATFORM_VERSION=.*/PLATFORM_VERSION=$v/" infra/deploy/.env
pc pull && pc up -d --remove-orphans
```

The pull fetches that release's images before anything stops. Each service migrates its own tables as it starts, and containers whose image didn't change keep running. Keycloak and Postgres only change when their image tag in `compose.yml` does.

## Check

- Open **Admin → Status**. Give it a minute: every part should be Running, with the new versions in the Version column.
- Sign in as yourself and as someone without the admin role, and open an app or two.
- `pc logs --since 10m gateway identity registry events` shouldn't show errors. Every log line carries a `requestId`; the same id is in the `x-request-id` header of the response, so a problem someone reports can be found across every service's logs.

## Release notes that need you

- **Each service signs in as itself** (the release that removes the shared token): `SERVICE_TOKEN` is gone. Before upgrading, add `IDENTITY_CLIENT_SECRET`, `REGISTRY_CLIENT_SECRET` and `EVENTS_CLIENT_SECRET` to `.env` (`openssl rand -hex 32` for each), and remove `SERVICE_TOKEN`. Identity makes the matching Keycloak clients when it starts. An app with its own service needs a sign-in from Admin, Apps (**Issue a new sign-in**) as its `SERVICE_CLIENT_SECRET`.

### The Updates page

Admin gets an **Updates** page, under AUGUR. It reads this repository's GitHub releases, and while the repository is private it needs a read-only token to see them. Once:

1. In GitHub, **Settings → Developer settings → Fine-grained tokens**, make a token for this repository only, with **Contents: Read-only** and nothing else. (The `read:packages` token you sign Docker in with can't read releases.)
2. Save it where only the registry reads it, then upgrade as usual:
   ```sh
   mkdir -p infra/deploy/secrets
   printf '%s' '<the token>' > infra/deploy/secrets/release-feed-token
   sudo chown 1000 infra/deploy/secrets/release-feed-token && chmod 600 infra/deploy/secrets/release-feed-token
   ```
   The registry runs as user 1000. Without the token, Updates says the release feed refused it.

Optional, in `.env`: `RELEASE_CHANNEL=stable` or `beta` (by default, the channel of the release you run), and `RELEASE_FEED_URL` for a mirror, or `off` to check nothing.

### The updater

An optional container that runs an upgrade asked for with **Upgrade to …** on Admin → Updates. It checks every image is signed by this repository's Release workflow and is the one the release names, checks the release's deploy files match your server's and the settings it needs are set, takes a backup and test-restores it, pulls, then reruns storage’s set-up and restarts identity, registry, events, models, gateway and web in turn, waiting for each to answer on its new version. If one doesn't, it puts every part back on the release you were on, and the page says why and which backup was taken. Data a new release migrated stays as it is: [Going back](#going-back) says when you'd restore that backup.

It drives Docker, which can start any container, so it has the run of the server. Only it can reach Docker (through `docker-proxy`, on a network of their own), and only an admin who has just entered their password can ask it for anything. Once, after the upgrade that brings it:

1. In `.env`, turn it on and tell it where it is. `PLATFORM_DIR` is the full path of `infra/deploy` on the server; it's mounted at that same path, so Compose's `./` paths still name your files.
   ```sh
   COMPOSE_PROFILES=updater
   PLATFORM_DIR=/home/you/augur/infra/deploy
   UPDATER_CLIENT_SECRET=<openssl rand -hex 32>
   ```
2. It runs as user 1000 and changes `PLATFORM_VERSION` in `.env`, so user 1000 has to be able to write it. On most servers that's the first account, so if `id -u` prints 1000 there's nothing to do; otherwise `sudo setfacl -m u:1000:rw infra/deploy/.env`.
3. For private images, the same read:packages token the server pulls with: `printf '%s' '<the token>' > infra/deploy/secrets/image-pull-token`, owned by user 1000 like the release feed's, and `IMAGE_PULL_USER=<your GitHub username>` in `.env`.
4. `pc up -d`. Identity makes the updater's sign-in, and an upgrade you ask for starts within half a minute.

Docker must be listening on `/var/run/docker.sock` (rootless Docker isn't). From then on, upgrade from the page, or by hand as above; both work. An upgrade waiting on the page while you upgrade by hand is best cancelled first.

### Images from releases (the first `augur@` release)

The server stops building images and pulls the ones CI built and signed for the release instead. Once, before this upgrade:

1. Sign the server in to GitHub's container registry, as in [deploy.md](deploy.md#before-you-start) (a token with only **read:packages**).
2. Add `PLATFORM_VERSION=<the release>` to `.env`.
3. Upgrade with the steps above, `git checkout augur@<version>` rather than `git pull`.

The web container now listens on 8080 and every image runs as an unprivileged user; the new `tailscale/serve.json` already points at 8080. Your old locally built images can go with `docker image prune`.

### The model gateway

A new service, `models`, starts with the upgrade. Nothing changes until you want Agents: models are off, and stay off until an admin turns them on in Admin. To get it ready, add to `.env`:

- `MODELS_CLIENT_SECRET` (`openssl rand -hex 32`): its own sign-in, which identity makes in Keycloak on the next start. Without it no model calls are made, because none could be recorded.
- `MODEL_API_URL`, `MODEL_API_KEY` and `MODEL_NAME` for the model to use, or `MODEL_API_URL=stand-in` to try it with a model that doesn't think. See [Agents and models](agents.md).

Then upgrade as usual.

### App storage

Apps can now keep their own database schema and files (see [App storage](app-storage.md)). Two new containers start: `garage`, the object store, and `storage`, which sets up each app's storage and stops. Postgres moves to the same version with pgvector added (`pgvector/pgvector:0.8.0-pg16`), so the data carries over as it is. Before upgrading, add to `.env` (`openssl rand -hex 32` for each):

- `GARAGE_RPC_SECRET` and `GARAGE_ADMIN_TOKEN`.

Then upgrade as usual. No app uses storage yet, so `APP_STORAGE` can stay unset.

### Renamed to AUGUR

Nothing to do beyond the usual upgrade. The shell, page title and Admin say AUGUR, and packages are `@augur/*`. Your server's identifiers are left alone so nobody is signed out and no data moves: the Keycloak realm is still `platform`, the database and Compose project are still `platform`, the `.env` keys keep their `PLATFORM_` names, and your address stays `https://platform.<tailnet>.ts.net`.

Two optional touches:

- **Sign-in page title**: Keycloak only reads the realm file on first start, so your sign-in page still says "Platform". In the Keycloak console (`PLATFORM_URL/sso/admin`), open the `platform` realm, **Realm settings**, and set **Display name** to `AUGUR`.
- **Address**: to be at `https://augur.<tailnet>.ts.net`, set `TS_HOSTNAME=augur` and change `PLATFORM_URL` to match in `.env`, then in the Keycloak console update the **shell** client's redirect URIs and web origins to the new address before `pc up -d`. Everyone signs in again.

## Going back

Code and data are separate, so going back is two steps, and the second is only needed if the new release migrated data:

1. **Code**: the same steps with the version you noted: `git checkout augur@<it>`, set `PLATFORM_VERSION` back, `pc up -d --remove-orphans`. The old images are still on the server, so nothing is downloaded.
2. **Data**, only if the older services fail on the newer tables: restore the backup you took before upgrading, as in [deploy.md](deploy.md#backups). Anything changed since that backup is lost, so check Admin → Activity first for what that is.

For one app rather than the whole platform, Admin → Apps can give the shell an earlier version of the app instead ([versioning.md](versioning.md#going-back-to-an-earlier-app-version)).
