# Upgrading AUGUR

Moving a running server from one release to the next. Commands use the `pc` alias from [deploy.md](deploy.md):

```sh
alias pc='docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env'
```

## Before you start

**Admin → Upgrade Centre** shows whether a newer release is out, what changes in each part, and a **Needs you first** list: a release you have to go through first, settings to add, breaking changes, and apps that won't open on the new SDK. It fills in the version for the steps below. The registry checks once a day; **Check now** checks straight away.

**Upgrade to …** on that page asks the deployment's updater to run these steps for you: it asks for your password again, then the updater takes a backup, pulls, restarts each part and goes back by itself if anything fails, and the page follows each step. The updater is optional: until you've set it up ([The updater](#the-updater)), an upgrade you ask for just waits; cancel it there and use the steps below. When a release changes the deploy files (`infra/deploy`), such as a new service or a new Keycloak setting, the updater writes them too, and a new required setting that's a secret it makes up itself ([The updater](#the-updater)). The steps below are for a server without the updater, or for when the page says an upgrade has to be done by hand.

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

- `pc ps` shows each of AUGUR's services as `healthy` about a minute after it starts: Compose asks each one's `/healthz` every 30 seconds. One that stays `unhealthy` or `starting` is the one to look at in `pc logs`.
- Open **Admin → Status**. Give it a minute: every part should be Running, with the new versions in the Version column.
- Sign in as yourself and as someone without the admin role, and open an app or two.
- `pc logs --since 10m gateway identity registry events` shouldn't show errors. Every log line carries a `requestId`; the same id is in the `x-request-id` header of the response, so a problem someone reports can be found across every service's logs.

## Release notes that need you

### Each platform service gets its own database login

Identity, the registry, events, models and Keycloak stop connecting as Postgres's admin login (`platform`). Each gets a login that owns only its own schema, or for Keycloak its own database. The release adds five required settings: `IDENTITY_DATABASE_PASSWORD`, `REGISTRY_DATABASE_PASSWORD`, `EVENTS_DATABASE_PASSWORD`, `MODELS_DATABASE_PASSWORD` and `KEYCLOAK_DATABASE_PASSWORD`. The Upgrade Centre makes them up for you. If you upgrade by hand, add each to `.env` first (`openssl rand -hex 32`). On the first `up`, the storage job makes the logins and hands each one the tables its service made while it ran as `platform`. The upgrade's backup comes first, as always. Going back to the earlier release still works, because that release connects as `platform` again.

- **Each service signs in as itself** (the release that removes the shared token): `SERVICE_TOKEN` is gone. Before upgrading, add `IDENTITY_CLIENT_SECRET`, `REGISTRY_CLIENT_SECRET` and `EVENTS_CLIENT_SECRET` to `.env` (`openssl rand -hex 32` for each), and remove `SERVICE_TOKEN`. Identity makes the matching Keycloak clients when it starts. An app with its own service needs a sign-in from Admin, Apps (**Issue a new sign-in**) as its `SERVICE_CLIENT_SECRET`.

### A call that names no floor is checked on the organisation's

An app's service calls (notifications, audit, models, people lookups) that name no floor used to get the app's scopes wherever it was on at all. Now they're checked on the organisation's floor, as the gateway already checked people's calls. Nothing changes for an app that is on for the whole organisation, which is every app AUGUR ships with unless you turned one off. If you turned an app off for the organisation and on for some teams, its service must now name the team's floor to send there. A refused call shows in that app's service log (`pc logs <app>`) as a 403 saying it isn't granted the scope.

### Keycloak's admin leaves identity

Identity no longer gets `KEYCLOAK_ADMIN_PASSWORD`. Its own sign-in already holds its rights on every server that has started identity before, so there's nothing to do. Keep the password in `.env`: Keycloak reads it on a new server, and it's the way back in if every deployment admin loses their one-time code. If identity's log ever says its sign-in can't manage the realm, see **Keycloak's admin** in deploy.md.

### The read key

While the repository is private, a deployment needs one **read key**: a GitHub token that can read this repository's packages and nothing else. With it, the registry checks GitHub for new AUGUR releases (Admin → Upgrade Centre) and new app releases (Admin → Apps) itself, and the updater pulls both. The releases are listed in a feed the Release workflow keeps beside the images, `ghcr.io/harry-burton-dev/im-platform/feed`, so the one token GitHub's container registry accepts covers everything. It replaces the two tokens servers needed before (`release-feed-token` and `image-pull-token`), which still work until you swap them.

Give each deployment its own key, so you can take one away without touching the others. Keys belong to a GitHub account, so use one that can do nothing but read: a separate account for deployments (a "machine user", such as `augur-deploy`, made with its own email address).

**Once, in GitHub:**

1. Sign up for the deployments' account and turn on two-factor authentication for it.
2. As the repository's owner, give that account **Read** on each package: open **Packages** on your profile, then each of `feed`, `web`, `gateway`, `identity`, `registry`, `events`, `models`, `storage`, `folio`, `folio-worker`, `auspex`, `atlas`, `updater` and each app under `apps/`, and under **Package settings → Manage access → Invite**, add the account with the **Read** role. Don't add it to the repository itself: on a repository owned by a personal account every collaborator can push. (If the repository moves to an organisation, giving the account the **Read** role on the repository covers every package that inherits its access.) A package made later, such as a new app's, needs the same once, after its first release.

**For each deployment:**

1. Signed in as the deployments' account, make a [classic token](https://github.com/settings/tokens/new?scopes=read:packages) named after the deployment (such as `augur demo`), with only **read:packages** and an expiry you'll put in your calendar.
2. On the server:
   ```sh
   mkdir -p infra/deploy/secrets
   printf '%s' '<the token>' > infra/deploy/secrets/github-read-key
   sudo chown 1000 infra/deploy/secrets/github-read-key && chmod 600 infra/deploy/secrets/github-read-key
   echo '<the token>' | docker login ghcr.io -u <the account> --password-stdin
   ```
   and in `.env`, `GITHUB_READ_USER=<the account>`. `docker login` is for pulling by hand (`pc pull`); the updater signs itself in with the same key.
3. `pc up -d registry updater`, then **Check now** on Admin → Upgrade Centre. It lists releases, or says the key was refused and why. The old `release-feed-token`, `image-pull-token` and `IMAGE_PULL_USER` can then go.

To take a deployment's access away, delete its token in the account's **Settings → Developer settings → Personal access tokens**; the others carry on. When a token is near its expiry, make a new one and repeat step 2.

A deployment that pulls from a mirror ([mirror.md](mirror.md)) has no use for a read key: its feed and images are in your own registry.

### Server rings

A new required setting, `SERVER_RING`: `preview` on the server that runs what's on its way to production, `production` on every other (docs/release-channels.md). **Upgrade to …** has a field for it. A production server follows stable releases only, and runs no pull requests' builds unless `ALLOW_PR_PREVIEWS=on`.

### Data Atlas ships with AUGUR

Data Atlas, the entities the org knows about (ships, people, places) and how they connect, is now part of every release: a new container, `atlas`, and its frontend inside `web`. It keeps its graph in its own Postgres schema, which the storage container makes on its first start along with a bucket (made for every app; Data Atlas keeps nothing there), and it puts itself in Admin, Apps. It needs three new settings: `ATLAS_CLIENT_SECRET` (its sign-in), `ATLAS_DATABASE_PASSWORD` and `ATLAS_BUCKET_SECRET`. An upgrade from Admin → Upgrade Centre makes them up for you. Upgrading by hand, add each to `.env` first (`openssl rand -hex 32`). See [atlas.md](atlas.md).

### Auspex ships with AUGUR

Auspex, which shows people where they are on AUGUR, who's there, and why they can or can't use each app, is now part of every release: a new container, `auspex`, and its frontend inside `web`. It keeps nothing of its own (no schema, no bucket) and puts itself in Admin, Apps on its first start. It needs one new setting, `AUSPEX_CLIENT_SECRET`, its sign-in: an upgrade from Admin → Upgrade Centre makes it up for you. Upgrading by hand, add it to `.env` first (`openssl rand -hex 32`). See [auspex.md](auspex.md).

### Folio is called Artifacts

Folio now shows as **Artifacts** everywhere people see it, and opens straight into its own side menu, with **All apps** in the top bar as the way back. Its containers, `.env` names (`FOLIO_*`), schema, bucket and address (`/folio`) haven't changed, so there's nothing to do.

### Apps' frontends by version

Each version of an app's frontend is now kept on its own, at `/apps/<id>/<version>/`, so holding an app at an older version in Admin, Apps gives people that version's code as well as its manifest. The `storage` container makes a bucket for them (`augur-frontends`), the registry writes each version there as the app gives it, and the front door serves it from Garage. Folio gives its own on every start. This release changes `compose.yml` and Garage's `garage.toml`, so it's upgraded by hand, not from the Updates page. Before upgrading, add to `.env`:

- `FRONTENDS_BUCKET_SECRET` (`openssl rand -hex 32`): the registry's key to that bucket.

Then upgrade as usual. Without it nothing breaks: apps are served from where their manifests say, as before, and the registry's log says frontends aren't kept by version.

### Folio ships with AUGUR

Folio, the document libraries, is now part of every release: three new containers start (`folio`, its rendition worker `folio-worker`, and Folio's frontend inside `web`), and Folio puts itself in Admin, Apps on its first start. There's nothing to install or allow in Admin. This release changes `compose.yml`, so it's upgraded by hand, not from the Updates page. Before upgrading, add to `.env` (`openssl rand -hex 32` for each):

- `FOLIO_CLIENT_SECRET`: Folio's sign-in, which identity makes in Keycloak on the next start.
- `FOLIO_DATABASE_PASSWORD` and `FOLIO_BUCKET_SECRET`: its database login and its bucket's secret, which the `storage` container sets up.

Then upgrade as usual. The worker's image is large (about 2 GB: the models that read PDFs and Word files come with it, so nothing is fetched at run time). If you'd rather not offer Folio yet, turn it off in Admin, Apps, org-wide or floor by floor; it can be turned off but not removed. Its files are in the nightly backup with the other apps'.

### The Updates page

Admin gets an **Updates** page, under AUGUR (since replaced by the **Upgrade Centre**, [release-channels.md](release-channels.md)). It reads this repository's GitHub releases, and while the repository is private it needs a read-only token to see them. [The read key](#the-read-key) now does this, and the steps below are how servers did it before:

1. In GitHub, **Settings → Developer settings → Fine-grained tokens**, make a token for this repository only, with **Contents: Read-only** and nothing else. (The `read:packages` token you sign Docker in with can't read releases.)
2. Save it where only the registry reads it, then upgrade as usual:
   ```sh
   mkdir -p infra/deploy/secrets
   printf '%s' '<the token>' > infra/deploy/secrets/release-feed-token
   sudo chown 1000 infra/deploy/secrets/release-feed-token && chmod 600 infra/deploy/secrets/release-feed-token
   ```
   The registry runs as user 1000. Without the token, Updates says the release feed refused it.

Optional, in `.env`: `RELEASE_CHANNEL=stable` or `beta` (by default, the channel of the release you run), and `RELEASE_FEED_URL` for a mirror ([mirror.md](mirror.md)), or `off` to check nothing.

### The updater

An optional container that runs an upgrade asked for with **Upgrade to …** on Admin → Upgrade Centre. It checks every image is signed by this repository's Release workflow and is the one the release names, checks the settings it needs are set, takes a backup and test-restores it, pulls, then reruns storage’s set-up and restarts identity, registry, events, models, gateway and web in turn, waiting for each to answer on its new version. If one doesn't, it puts every part back on the release you were on, and the page says why and which backup was taken. Data a new release migrated stays as it is: [Going back](#going-back) says when you'd restore that backup.

**Deploy files and new settings.** Each release's updater image carries that release's deploy files (`infra/deploy`, as `augur@<version>` has them). When the release you upgrade to changes some, the updater takes them from the new release's updater image, checks each against the release file (which the Release workflow signs with the images), writes them into `infra/deploy`, then starts anything they add and makes again anything that mounts a changed file (Keycloak's realm, say). Going back puts the old files back and takes new parts away. Two things stop it, and the page says which:
- A file the release changes has been **edited on the server** since the release you run. The updater never overwrites your edits: put the file back as `augur@<your version>` has it (`git checkout augur@<version> -- infra/deploy/<file>`), and keep your change in `.env` or a `compose.override.yml` of your own instead.
- A **new required setting that only you can give** (an address, say) that you didn't enter. **Upgrade to …** has a field for each new setting the release adds: what you type there goes to the updater (never stored, and only the setting's name is audited) and into `.env`. Leave one empty when it's already in `.env`. A new required setting whose name ends in `_SECRET`, `_PASSWORD` or `_TOKEN` is a long random string, so it gets no field: the updater makes one up and adds it to `.env` itself, and the page says which it made.

After the updater has written deploy files, the server's `infra/deploy` is ahead of your git checkout's: that's expected. Don't `git checkout` or `git pull` over it; if you want the checkout to match, `git fetch --tags && git checkout augur@<version>` for the version you now run, which is what's on disk.

It drives Docker, which can start any container, so it has the run of the server. Only it can reach Docker (through `docker-proxy`, on a network of their own), and only an admin who has just entered their password can ask it for anything. Once, after the upgrade that brings it:

1. In `.env`, turn it on and tell it where it is. `PLATFORM_DIR` is the full path of `infra/deploy` on the server; it's mounted at that same path, so Compose's `./` paths still name your files.
   ```sh
   COMPOSE_PROFILES=updater
   PLATFORM_DIR=/home/you/augur/infra/deploy
   UPDATER_CLIENT_SECRET=<openssl rand -hex 32>
   ```
2. It runs as user 1000 and writes `.env` and the deploy files, so user 1000 has to be able to write `infra/deploy`. On most servers that's the first account, so if `id -u` prints 1000 and you own the folder there's nothing to do; otherwise `sudo setfacl -R -m u:1000:rwX -m d:u:1000:rwX infra/deploy`.
3. For private images, the deployment's [read key](#the-read-key), which the updater signs in with. (Before read keys: the read:packages token the server pulls with, as `infra/deploy/secrets/image-pull-token`, owned by user 1000, with `IMAGE_PULL_USER=<its GitHub username>` in `.env`.)
4. `pc up -d`. Identity makes the updater's sign-in, and an upgrade you ask for starts within half a minute.

Docker must be listening on `/var/run/docker.sock` (rootless Docker isn't). From then on, upgrade from the page, or by hand as above; both work. An upgrade waiting on the page while you upgrade by hand is best cancelled first.

### The app runner

The updater can also install, upgrade and remove apps that don't ship with AUGUR, from their own signed releases ([Versioning](versioning.md#app-releases)), with no change to `compose.yml` or `.env` per app. It runs them in a Compose project of its own, `augur-apps`, which it writes in `infra/deploy/apps/` (`compose.yml`, a settings file per container and `state.json`). Don't edit those: they're rewritten on every install.

To turn it on, with the updater already set up, add one setting to `.env` and `pc up -d`:

```sh
APP_SECRETS_KEY=<openssl rand -hex 32>
```

Every app's database password, bucket secret and sign-in are worked out from it ([app-storage.md](app-storage.md)), so keep it as safe as `POSTGRES_PASSWORD`, and don't change it once apps are installed: they'd lose their database login and bucket key until reinstalled.

An install (a first install, an upgrade or going back to an older version alike) goes:

1. **verify**: the release's signer must be trusted (this repository's Release workflow always is; `APP_PUBLISHERS` in `.env` adds others, as `owner/repo` or `owner/repo/.github/workflows/<file>`), and its service image must carry that workflow's signature.
2. **storage**: when the app asks for a database or a bucket, the storage container makes them for that app alone.
3. **sign-in**: identity sets the app's sign-in to its worked-out secret.
4. **start**: the new version starts in the slot (blue or green) the app isn't using, beside the old one, on the platform's network. It can't add powers, gets no host folders and isn't privileged.
5. **health**: it must answer `/healthz` on its new version within 3 minutes. If it doesn't, it's removed and the old version carries on as if nothing happened.
6. **switch**: the runner registers the new version and points the gateway at it, in that order.
7. **retire**: the old version keeps running 10 more minutes for shells still holding the old manifest, then stops.

Admin → Apps lists, under the catalogue, the apps this repository has released that aren't installed, with **Install**; it says what each one asks for, and asks for your password again before anything is installed or removed. The registry reads the releases every 15 minutes, or at once with **Check for releases**: the same GitHub releases Updates reads, with the same token (`APP_FEED_URL` points it elsewhere, and `off` turns it off; it's off by itself when `RELEASE_FEED_URL` is a mirror).

Open an installed app to choose how it takes new releases:

- **New releases**: stable only, or betas too.
- **When one is out**: **Automatic** (the default) installs a newer version by itself when it's a fix or a feature that asks for nothing new: no major version, no new scopes, storage, kinds of floor or bigger uploads, an SDK range this AUGUR opens, and the same signer. Anything else waits under **Needs you** with why. **Ask first** makes every version wait for you, and **Hold** offers none. A version that failed to install isn't tried again by itself.

The same page follows each job step by step, and **Remove from the server** stops an app's containers; its data stays, and removing it from the catalogue too stops it being listed. Every install, update, removal and choice is in Activity.

Scripts can do the same through the registry (`/api/registry/v1/app-runner/…` in `contracts/registry.openapi.yaml`), with an `app-release.json` in place of a version from the feed:

```sh
curl -X POST https://<platform>/api/registry/v1/app-runner/jobs -H "authorization: Bearer <admin token>" \
  -H 'content-type: application/json' -d "{\"action\":\"install\",\"release\":$(cat app-release.json)}"
```

Pull requests that change an app can run as previews beside it, for the app's developers alone, each with scratch storage of its own: see [app-previews.md](app-previews.md).

Apps join the platform's network: the one the updater itself is on, usually `platform_default` (`APPS_NETWORK` in `.env` names another). So `pc down` can't remove that network while they run: stop them first with `docker compose -p augur-apps -f infra/deploy/apps/compose.yml down`. They restart by themselves with Docker, like the platform.

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

### Upload limits

Uploads now stream through the front door and the gateway without being held, and the gateway holds each app to its own limit: its manifest's `maxUpload`, or less where an admin lowered it in Admin, Apps. An app that doesn't say gets 10 MB at once, where everything got 50 MB before; the platform's own services keep their own limits. Nothing to add to `.env`. Upgrade as usual.

### Signed caller

The gateway now signs the person it passes on, and the platform's services believe only the signed caller (see [Signed caller](signed-caller.md)). Nothing to add to `.env`: the gateway makes its key when it starts and services fetch it from the gateway. Upgrade as usual. An app with its own service should add the service kit's `signedCallers` hook; until it does, it keeps working on the plain headers.

### App storage

Apps can now keep their own database schema and files (see [App storage](app-storage.md)). Two new containers start: `garage`, the object store, and `storage`, which sets up each app's storage and stops. Postgres moves to the same version with pgvector added (`pgvector/pgvector:0.8.0-pg16`), so the data carries over as it is. Before upgrading, add to `.env` (`openssl rand -hex 32` for each):

- `GARAGE_RPC_SECRET` and `GARAGE_ADMIN_TOKEN`.

Then upgrade as usual. No app uses storage yet, so `APP_STORAGE` can stay unset.

### Renamed to AUGUR

Nothing to do beyond the usual upgrade. The shell, page title and Admin say AUGUR, and packages are `@augur/*`. Your server's identifiers are left alone so nobody is signed out and no data moves: the Keycloak realm is still `platform`, the database and Compose project are still `platform`, the `.env` keys keep their `PLATFORM_` names, and your address stays `https://platform.<tailnet>.ts.net`.

Two optional touches:

- **Sign-in page title**: Keycloak only reads the realm file on first start, so your sign-in page still says "Platform". In the Keycloak console (`PLATFORM_URL/sso/admin`, with `KEYCLOAK_CONSOLE=open` in `.env`; see [deploy.md](deploy.md), Limits at the front door), open the `platform` realm, **Realm settings**, and set **Display name** to `AUGUR`.
- **Address**: to be at `https://augur.<tailnet>.ts.net`, set `TS_HOSTNAME=augur` and change `PLATFORM_URL` to match in `.env`, then in the Keycloak console update the **shell** client's redirect URIs and web origins to the new address before `pc up -d`. Everyone signs in again.

## Going back

**Admin → Upgrade Centre → Go back** does this for you while no release between is breaking ([release-channels.md](release-channels.md#going-back)). By hand:

Code and data are separate, so going back is two steps, and the second is only needed if the new release migrated data:

1. **Code**: the same steps with the version you noted: `git checkout augur@<it>`, set `PLATFORM_VERSION` back, `pc up -d --remove-orphans`. The old images are still on the server, so nothing is downloaded.
2. **Data**, only if the older services fail on the newer tables: restore the backup you took before upgrading, as in [deploy.md](deploy.md#backups). Anything changed since that backup is lost, so check Admin → Activity first for what that is.

For one app rather than the whole platform, Admin → Apps can give the shell an earlier version of the app instead ([versioning.md](versioning.md#going-back-to-an-earlier-app-version)).
