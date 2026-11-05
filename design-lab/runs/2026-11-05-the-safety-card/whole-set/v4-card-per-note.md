## Release notes that need you

Every note below is a card with the same parts, newest release first.
Read the first line of each card: it says whether you must act.

- **From**: the release that brought it. Most are `[open]`: the notes
  don't say. Notes are newest first, so a note lower down is older.
- **Verdict**: **Do before** (add or place something before `pc up -d`),
  **By hand** (don't leave this release to the updater or a window),
  **Check** (only if a condition holds), or **Nothing to do**.
- **Way back**: what going back to the release before needs.

`openssl rand -hex 32` makes each secret below. "By hand" means the
guide's upgrade steps, without the Upgrade Centre's updater.

---

### Each service signs in as itself; `SERVICE_TOKEN` is gone
**From** [open: release; the note calls it "the release that removes the shared token"] · **Do before** · **Way back** [open]
- **Do:** before you upgrade, add `IDENTITY_CLIENT_SECRET`, `REGISTRY_CLIENT_SECRET` and `EVENTS_CLIENT_SECRET` to `.env`. Remove `SERVICE_TOKEN`.
- **If** an app has its own service: in Admin, Apps, choose **Issue a new sign-in**, and use it as that app's `SERVICE_CLIENT_SECRET`.
- **Why:** identity makes the matching Keycloak clients when it starts.

### Mandate now ships with AUGUR
**From** [open] · **Do before** (by hand) · **Way back** keeps the data; reinstall to run it
- **Do:** by hand, add `MANDATE_CLIENT_SECRET` and `MANDATE_DATABASE_PASSWORD` (required) and, if you want it, `MANDATE_BUCKET_SECRET` (optional) to `.env` before `pc up -d`. An upgrade from the Upgrade Centre makes them up for you.
- **If** the app runner installed Mandate before: nothing to do. AUGUR's container uses the same database login and schema (`app_mandate`) and sign-in (`app-mandate`). The storage job and the realm job set them to the new values, and the aims and parts already there stay. Once the new updater starts, it stops and forgets the runner's own Mandate containers (`app-mandate-blue` or `-green`; Activity names them).
- **What changes:** a new container, `mandate`, at the release `release/shipped-apps.json` pins. Admin → Apps no longer lists it to install; it upgrades with AUGUR.
- **Way back:** to a release before this one, Mandate's data stays and Admin → Apps lists it as installed at its old version, but nothing runs it. Install that version again there; the runner starts it on the same data.

### Settings the guides named now reach their services
**From** [open] · **Check** · **Way back** [open]
- **If** any of these is already in your `.env`: `FEED_SIGNER`, `IMAGE_SIGNER`, `AUGUR_DEV_SIGNER`, `DOMAIN_EVENTS_KEEP_DAYS`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_TRACES_SAMPLER`, `OTEL_TRACES_SAMPLER_ARG`, check it says what you want. It takes effect at the upgrade. Otherwise nothing to do.
- **Why:** before, compose didn't pass them. It now passes them, and `MODEL_TIMEOUT_SECONDS`, `IMAGE_SIGNER_ISSUER` and `CALLER_SIGNING_KEY`. Every setting is described in `infra/deploy/settings.schema.json` (deploy.md).

### Sign-in pages and emails now look like AUGUR
**From** [open] · **Nothing to do** · **Way back** works; Keycloak's own look returns
- **What changes:** Keycloak runs from AUGUR's own image (`ghcr.io/harry-burton-dev/im-platform/keycloak`, tagged and signed like the others), same Keycloak version, with AUGUR's sign-in and email theme (ADR 0041). The realm job turns the theme on. The pages show `ORG_NAME`.
- **Optional:** `ORG_LOGO_URL` for a logo on the sign-in pages; `REALM_LANGUAGES` (say `en,de,fr`) for more languages than English (deploy.md, "What's in it").
- **Way back:** sign-in shows Keycloak's own look, and Keycloak's log says it can't find the `augur` theme each time a page is shown. That is harmless.

### Logs, memory and health now have limits
**From** [open] · **Check** (memory) · **Way back** [open]
- **If** your server has less than 8 GB of memory: before you upgrade, set `KEYCLOAK_MEM_LIMIT` and `FOLIO_WORKER_MEM_LIMIT` lower in `.env` (deploy.md, "Logs, memory and health"). Otherwise nothing to do. [open: what happens if you don't.]
- **What changes:** each container's log is capped at three files of 10 MB. Memory limits: Keycloak 2 GB, Artifacts' rendition worker 4 GB, the observability stack 2 GB. Keycloak and Garage get healthchecks, and containers that need them wait until they're healthy. The upgrade recreates each container with its limits.
- **You lose:** existing logs bigger than the cap, when the container is recreated.

### Keycloak moves to 26.8: back up, take it by hand, and it can't be undone
**From** augur@0.18.0 · **By hand** · **Way back** only with a restore; anything since the backup is lost
- **Do, before you upgrade:**
  1. Take a backup and test it ("Before you start", step 4). Keep the file name: `infra/deploy/backups/platform-<date>.sql.gz`.
  2. Check `KEYCLOAK_ADMIN_PASSWORD` in `.env` is still Keycloak's master admin password. If you changed it in the console, put the current one in `.env`. The realm job signs in with it on every `up`.
- **Do:** 3. Upgrade by hand, not in an upgrade window. Keycloak's first start takes a minute or two longer. A new container, `keycloak-config`, runs once Keycloak is up, sets the realm up and stops; identity starts after it.
- **Check:** 4. `pc logs keycloak-config` ends with "The platform realm is up to date" and lists what it changed; `pc ps -a keycloak-config` shows it exited with 0. [open: what to do if not.]
- **If** identity's log says it lacks rights: `pc up -d keycloak-config identity`.
- **Way back:** a restore of the backup from step 1. Set `PLATFORM_VERSION` back, check out that release's deploy files, then
  ```sh
  pc stop tailscale web gateway identity registry events keycloak backup
  gunzip -c infra/deploy/backups/platform-<date>.sql.gz | pc exec -T postgres psql -U platform -d postgres
  pc up -d --remove-orphans
  ```
- **For people:** new passwords need 15 characters or more and can't be the username, the email or a known breached password; nobody must change the one they have. Admins and deployment admins are asked to set up a code app at their next sign-in, unless they use a passkey; anyone can add either. Sessions end after 8 hours unused or 10 hours at most.
- **Why:** Keycloak 26.0.8 → 26.8.1, realm kept as code (ADRs 0037, 0038, 0057). Identity no longer holds `manage-realm`; `infra/deploy/identity-repair.yml` is gone.

### Artifacts, Explorer and Data Atlas now come from their own repositories
**From** augur@0.17.0 · **Nothing to do** · **Way back** the code step
- **What changes:** nothing on the server. Each app is released in its own repository (`augur-folio`, `augur-auspex`, `augur-atlas`); AUGUR's release takes the one `release/shipped-apps.json` pins, checks that repository signed it, and signs it again (ADR 0049). Images keep their names under `PLATFORM_IMAGES` and come with each AUGUR release; the apps keep their tables and buckets. Mandate, an app the runner installs, moves the same way; the updater takes a backup before its first release from the new repository (ship-an-app.md).
- **Way back** to 0.16.x: check out `augur@0.16.1`, set `PLATFORM_VERSION=0.16.1`, `pc up -d --remove-orphans`. No restore. Going back past 0.18.0 needs the Keycloak 26.8 restore first.

### Sample data, only where you allow it
**From** [open] · **Nothing to do** (optional) · **Way back** [open]
- **What changes:** `pnpm seed` (seed.md) fills a deployment with synthetic people, floors, documents and entities, only where `.env` sets `SEED_ALLOWED=true`.
- **If** you want it on an existing server: also import its sign-in client. Open the Keycloak console (`KEYCLOAK_CONSOLE=open`, deploy.md), choose the `platform` realm, **Clients → Import client**, import the `platform-cli` entry from `infra/deploy/keycloak/platform-realm.json`, then close the console.

### Don't skip the release that comes with the repository's new name
**From** [open] · **Check** (run it) · **Way back** [open]
- **Skip it and** the server refuses everything released after it.
- **What changes:** the repository was renamed from `im-platform` to `augur` on 5 November 2026 (PER-162). From this release the updater and registry take releases, dev builds and the feed signed under either name. [open: the note says a server must run this release "before the rename"; the rename has happened, so it is unclear what that means for a server not yet on it.]
- **Nothing else moves:** images and the feed stay at `ghcr.io/harry-burton-dev/im-platform`, so `PLATFORM_IMAGES` and your read key stay. GitHub forwards the old addresses. Optional: `git remote set-url origin https://github.com/harry-burton-dev/augur.git`.

### Automatic upgrades wait for your first one, and a 0.x minor always waits
**From** [open] · **Nothing to do** · **Way back** [open]
- **What changes:** AUGUR doesn't upgrade itself on a server, dev builds included, until an admin has upgraded it there once from the Upgrade Centre and it finished. Until then **Needs you** says so, with **Upgrade**. A server that already had one carries on.
- A 0.x minor (0.3 to 0.4) counts as a major: Automatic takes only 0.x patches, for AUGUR and apps. A 0.x minor waits under **Needs you** for an admin (ADR 0020, amended 2 November).

### Reporting to Backstage, if you set it up
**From** [open] · **Nothing to do** (optional) · **Way back** [open]
- **What changes:** nothing until you set it up. The Upgrade Centre's Reporting section (under Worth knowing) says reporting isn't set up and what to set (ADR 0019).
- **To set it up:**
  1. Add the deployment to Backstage's `org/deployments.yaml` if it isn't there; note its `metadata.name`.
  2. Set `DEPLOYMENT_ID` to that name and `PORTAL_URL` to Backstage's address in `.env`. Then `docker compose up -d registry`.
  3. Copy the deployment's public key (`GET /api/registry/v1/platform/reporting` as an admin, or **Copy key** in Reporting) into the entry's `augur.dev/report-key` annotation, and let Backstage read the catalog again.
- **How it works:** the registry makes the deployment's own Ed25519 key when first needed and keeps it in the database, so a restored backup reports as the same deployment. It signs and sends a record two minutes after start, when a version, a result or something that needs you changes (it looks every 15 minutes), and once a day. The record holds the name and ring, AUGUR's and each app's version, what's available, each unit's policy and pin, health, last results and the feed's state; no names or ids of people. Backstage refuses a record from a deployment it doesn't list or not signed with the listed key.
- **Air-gapped:** set `DEPLOYMENT_ID` and no `PORTAL_URL`; export the record (**Export the record**, or `GET /api/registry/v1/platform/reporting/export`) and carry it to Backstage. `DEPLOYMENT_REPORTING=off` turns both off.

### Each upgrade is watched for 10 minutes, and goes back by itself if it fails
**From** [open] · **Nothing to do** · **Way back** automatic within the watch
- **What happens:** for 10 minutes after an upgrade the updater signs in every half minute with a fresh token, and checks AUGUR's own calls at the gateway (`GET /traffic`, only reachable from the deployment's own network; apps' errors are counted apart). Every two minutes it checks every part is ready. If sign-in fails twice in a row, a part stops answering, or more than 5% of at least 20 calls fail, it goes back by itself and the Upgrade Centre says what it saw. With a breaking release in between it doesn't go back: it says what it saw and leaves the choice to you. Going back isn't watched.
- **Quiet servers:** with fewer than 20 calls in the 10 minutes, the result says it was too quiet to judge, and a light watch goes on: every 5 minutes it counts calls until there are 20, for at most a day. If more than 5% failed, or sign-in fails twice in a row, it doesn't go back by itself; it shows in **Needs you** for an admin. The registry keeps the count across restarts. Asking for another upgrade ends it (ADR 0020).
- **Also:** the updater does nothing else in those 10 minutes; an app install waits. Both sides need this release: an older updater ignores the watch, and an older gateway has no `/traffic`, so only sign-in is watched.

### Upgrades follow each unit's policy and window; set your time zone
**From** [open] · **Check** (time zone) · **Way back** [open]
- **Do:** set `DEPLOYMENT_TIME_ZONE` in `.env` (such as `Europe/London`). Without it, windows are in UTC.
- **What changes:** AUGUR and every app has one record (ADR 0020): **Automatic**, **Ask first** or **Hold**; how far Automatic goes (patches, or minors too); an optional pin (a range such as `0.13.x`); and weekly windows. A major, a 0.x minor, one needing a setting only a person can give, or one an earlier try didn't finish always waits for an admin. An upgrade an admin asks for starts at once.
- **The default:** on a production server, AUGUR installs its patch releases by itself on Sunday at 02:00, for two hours, in the deployment's time zone. On a preview server or the workbench, at any time. Apps keep theirs: patch and minor releases at any time, set in Admin → Apps. Change any of it in the Upgrade Centre (API: `PUT /platform/units/<unit>/desired-state`). To start every AUGUR upgrade yourself, set its policy to Ask first.
- A failed upgrade, or one that went back by itself, stays in **Needs you** for every admin until one marks it looked at.

### Each AUGUR service gets its own database login
**From** [open] · **Do before** (by hand) · **Way back** the code step
- **Do:** by hand, add `IDENTITY_DATABASE_PASSWORD`, `REGISTRY_DATABASE_PASSWORD`, `EVENTS_DATABASE_PASSWORD`, `MODELS_DATABASE_PASSWORD` and `KEYCLOAK_DATABASE_PASSWORD` to `.env` before you upgrade (all required). The Upgrade Centre makes them up for you.
- **What changes:** identity, registry, events, models and Keycloak stop connecting as Postgres's admin login (`platform`). Each gets a login that owns only its own schema (Keycloak: its own database). On the first `up` the storage job makes the logins and hands each its tables. The backup comes first, as always.
- **Way back:** works; that release connects as `platform` again.

### An app's call that names no floor is now checked on the organisation's floor
**From** [open] · **Check** · **Way back** [open]
- **If** you turned an app off for the organisation and on for some teams: its service must now name the team's floor to send there. A refused call shows in `pc logs <app>` as a 403 saying it isn't granted the scope. Otherwise nothing changes; every app that ships with AUGUR is on for the whole organisation unless you turned one off.
- **What changes:** calls an app's service makes with no floor (notifications, audit, models, people lookups) used to get the app's scopes wherever it was on. Now they're checked on the organisation's floor, as people's calls already were.

### Only a deployment admin can upgrade
**From** [open] · **Check** (who upgrades) · **Way back** [open]
- **If** someone other than the first admin upgrades: give them `deployment-admin` in Admin, People. Without it, the Upgrade Centre's buttons are refused, with the role named.
- **What changes:** upgrading AUGUR, going back, taking back a waiting upgrade, and changing policy, pin or windows need `deployment-admin`, not just `admin` (ADR 0022). The first admin (`PLATFORM_ADMIN_USER`) has held it since the deployment-admin release.

### Apps follow the same rule
**From** [open] · **Nothing to do** · **Way back** [open]
- Installing, upgrading or removing an app, and changing how it takes new releases, need `deployment-admin` too (ADR 0022). Changing how any unit takes updates asks for your password again if you last entered it more than 10 minutes ago. A plain `admin` still sees everything and can mark results looked at.

### Identity no longer holds Keycloak's admin password; keep it in `.env`
**From** [open] · **Nothing to do** · **Way back** [open]
- Identity's own sign-in already holds its rights on every server that has run identity before. **Keep** `KEYCLOAK_ADMIN_PASSWORD` in `.env`: Keycloak reads it on a new server, and it's the way back in if every deployment admin loses their one-time code. If identity's log says it can't manage the realm, see "Keycloak's admin" in deploy.md.

### The registry now checks the release feed is signed
**From** [open] · **Check** (old token, fork) · **Way back** [open]
- **If** you still use the old token path (`release-feed-token`): it shows as not signed. Swap it for the read key (below).
- **If** you publish AUGUR from a fork: `FEED_SIGNER` in `.env` sets which workflow may sign the feed (a regular expression). Otherwise leave it unset.
- **If** you use a mirror (mirror.md): it shows as your organisation's own feed, not signed by the publisher, and doesn't expire. Images are still checked.
- **What changes:** the Feed workflow signs the feed with cosign, keyless, with an expiry two weeks out, renewed every Monday (ADR 0017). The registry turns down a feed not signed by `feed.yml` on `main` or a release branch, whose signature fails, or that has expired; it keeps running what it runs and the Upgrade Centre says why. The registry's image carries cosign and checks offline when `infra/deploy/releases/trusted_root.json` is there.
- **Halted releases** (release-channels.md) are listed, marked halted with the reason, and never offered or installed. A server running one is told so, and where to go.

### A halted release can be installed to test going back, on dev or preview only
**From** [open] · **Nothing to do** · **Way back** that is the point
- On a dev or preview server, a deployment admin can choose **Install … for a test** beside a halted release in the Upgrade Centre; it asks for a reason and may ask for your password (API: `PUT /v1/platform/upgrade/halted` with `version` and `reason`; ADR 0051). The release must be newer, able to upgrade from yours, with no breaking release between. The watch judges it as usual.
- On production (`SERVER_RING=production`) the action is visible but refused, and says why. Every request is audited (`platform.halted-install-requested`, `platform.halted-install-refused`). Automatic policies never take a halted release.

### The read key: one GitHub token per deployment
**From** [open] · **Do before** (while the repository is private) · **Way back** [open]
- **What it is:** a GitHub token that can read this repository's packages and nothing else. With it the registry finds new AUGUR and app releases and the updater pulls them. The feed is at `ghcr.io/harry-burton-dev/im-platform/feed`. It replaces `release-feed-token` and `image-pull-token`, which work until you swap them. A deployment that pulls from a mirror (mirror.md) doesn't need one.
- **Once, in GitHub:**
  1. Sign up a separate account for deployments (a "machine user", such as `augur-deploy`, with its own email), with two-factor authentication on.
  2. As the repository's owner, give that account **Read** on each package (**Packages** on your profile; each of `feed`, `web`, `gateway`, `identity`, `registry`, `events`, `models`, `storage`, `folio`, `folio-worker`, `auspex`, `atlas`, `updater` and each app under `apps/`; **Package settings → Manage access → Invite**, role **Read**). Don't add it to the repository: on a personal account every collaborator can push. (In an organisation, **Read** on the repository covers packages that inherit it.) A new package needs this once, after its first release.
- **For each deployment:**
  1. As that account, make a classic token named after the deployment (such as `augur demo`), with only **read:packages** and an expiry you put in your calendar.
  2. On the server:
     ```sh
     mkdir -p infra/deploy/secrets
     printf '%s' '<the token>' > infra/deploy/secrets/github-read-key
     sudo chown 1000 infra/deploy/secrets/github-read-key && chmod 600 infra/deploy/secrets/github-read-key
     echo '<the token>' | docker login ghcr.io -u <the account> --password-stdin
     ```
     and in `.env`, `GITHUB_READ_USER=<the account>`. `docker login` is for `pc pull`; the updater signs in with the same key.
  3. `pc up -d registry updater`, then **Check now** in the Upgrade Centre. It lists releases, or says why the key was refused. Then `release-feed-token`, `image-pull-token` and `IMAGE_PULL_USER` can go.
- **To take access away:** delete that token (account **Settings → Developer settings → Personal access tokens**). Near its expiry, make a new one and repeat step 2.

### Explorer is the new name people see
**From** [open] · **Nothing to do** · **Way back** [open]
- Explorer is a platform app. Its container, `.env` name (`AUSPEX_CLIENT_SECRET`), sign-in and address (`/auspex`) are unchanged.

### Server rings: a new required setting
**From** [open] · **Do before** · **Way back** [open]
- **Do:** add `SERVER_RING` to `.env`: `preview` on the server that runs what's on its way to production, `production` on every other (release-channels.md). **Upgrade to …** has a field for it. [open: what happens if it is missing.]
- **What changes:** a production server follows stable releases only, and runs no pull requests' builds unless `ALLOW_PR_PREVIEWS=on`.

### Data Atlas now ships with AUGUR
**From** [open] · **Do before** (by hand) · **Way back** [open]
- **Do:** by hand, add `ATLAS_CLIENT_SECRET`, `ATLAS_DATABASE_PASSWORD` and `ATLAS_BUCKET_SECRET` to `.env` before you upgrade. The Upgrade Centre makes them up for you.
- **What changes:** a new container, `atlas`, and its frontend in `web`. It keeps its graph in its own Postgres schema, which storage makes on first start, with a bucket (made for every app; Data Atlas keeps nothing in it). It adds itself to Admin, Apps (atlas.md).

### Explorer now ships with AUGUR
**From** [open] · **Do before** (by hand) · **Way back** [open]
- **Do:** by hand, add `AUSPEX_CLIENT_SECRET` to `.env` before you upgrade. The Upgrade Centre makes it up for you.
- **What changes:** a new container, `auspex`, and its frontend in `web`. Explorer shows people where they are, who's there, and why they can or can't use each app. It keeps nothing of its own and adds itself to Admin, Apps on first start.

### Artifacts is the new name people see
**From** [open] · **Nothing to do** · **Way back** [open]
- Artifacts opens into its own side menu, with **All apps** in the top bar as the way back. Its containers, `.env` names (`FOLIO_*`), schema, bucket and address (`/folio`) are unchanged.

### Each app's frontend is kept by version
**From** [open] · **By hand** · **Way back** [open]
- **Do:** this release changes `compose.yml` and Garage's `garage.toml`, so upgrade by hand. Before you upgrade, add `FRONTENDS_BUCKET_SECRET` to `.env` (the registry's key to the bucket).
- **Skip the setting and** nothing breaks: apps are served from where their manifests say, and the registry's log says frontends aren't kept by version.
- **What changes:** each version of an app's frontend is kept at `/apps/<id>/<version>/`, so holding an app at an older version in Admin, Apps gives people that version's code too. `storage` makes the bucket (`augur-frontends`), the registry writes each version, and the front door serves it from Garage. Artifacts gives its own on every start.

### Artifacts now ships with AUGUR
**From** [open] · **By hand** · **Way back** [open]
- **Do:** this release changes `compose.yml`, so upgrade by hand. Before you upgrade, add `FOLIO_CLIENT_SECRET` (its sign-in, made in Keycloak by identity), `FOLIO_DATABASE_PASSWORD` and `FOLIO_BUCKET_SECRET` (set up by `storage`) to `.env`.
- **What changes:** three new containers: `folio`, its rendition worker `folio-worker`, and its frontend in `web`. It adds itself to Admin, Apps; nothing to install. The worker's image is about 2 GB (the models that read PDF and Word files come with it). To not offer it yet, turn it off in Admin, Apps, org-wide or by floor; it can't be removed. Its files are in the nightly backup.

### The Updates page (since replaced by the Upgrade Centre)
**From** [open] · **Nothing to do** (replaced) · **Way back** [open]
- Admin got an **Updates** page that read the repository's GitHub releases with a read-only token. The read key (above) now does this. How servers did it before: a fine-grained token for this repository only, **Contents: Read-only**, saved as `infra/deploy/secrets/release-feed-token`, owned by user 1000, `chmod 600`. Without it, Updates said the feed refused it.
- **Optional:** `RELEASE_CHANNEL=stable` or `beta` (default: the channel you run); `RELEASE_FEED_URL` for a mirror, or `off`.

### The updater: optional, runs upgrades from the Upgrade Centre
**From** [open] · **Nothing to do** (optional set-up) · **Way back** goes back by itself if a part fails
- **What it does:** checks every image is signed by the Release workflow and named by the release, checks settings, takes and test-restores a backup, pulls, then restarts Keycloak (up to five minutes), storage's set-up, identity, registry, events, models, the shipped apps (in `release/shipped-apps.json` order), gateway and web, waiting for each. A release with an image it doesn't know is refused before anything changes; upgrade that one by hand. If a part doesn't answer, every part goes back and the page says why and which backup it took. Migrated data stays as it is.
- **Deploy files:** it writes a release's changed `infra/deploy` files from that release's updater image, checked against the signed release file. It stops if a changed file was **edited on the server** (put it back with `git checkout augur@<your version> -- infra/deploy/<file>`; keep your change in `.env` or a `compose.override.yml`), or if a **required setting only you can give** wasn't entered (**Upgrade to …** has a field per new setting; settings ending `_SECRET`, `_PASSWORD` or `_TOKEN` it makes up itself). Afterwards `infra/deploy` is ahead of your checkout: don't `git checkout` or `git pull` over it.
- **To turn it on, once:**
  1. In `.env`: `COMPOSE_PROFILES=updater`, `PLATFORM_DIR=<full path of infra/deploy>`, `UPDATER_CLIENT_SECRET=<openssl rand -hex 32>`.
  2. User 1000 must be able to write `infra/deploy`. If `id -u` prints 1000 and you own the folder, nothing to do; otherwise `sudo setfacl -R -m u:1000:rwX -m d:u:1000:rwX infra/deploy`.
  3. For private images, the deployment's read key.
  4. `pc up -d`. An upgrade you ask for starts within half a minute.
- Docker must listen on `/var/run/docker.sock` (not rootless). It has the run of the server; only it reaches Docker (through `docker-proxy`) and only an admin who just entered their password can ask it. Cancel a waiting page upgrade before upgrading by hand.
- **One look of the watch:** `pc exec -T updater node dist/index.js check` prints one line of JSON and exits 1 on any problem.

### The app runner: installs apps that don't ship with AUGUR
**From** [open] · **Nothing to do** (optional set-up) · **Way back** per app, by itself within 5 minutes
- **To turn it on** (updater set up first): add `APP_SECRETS_KEY=<openssl rand -hex 32>` to `.env` and `pc up -d`. Keep it as safe as `POSTGRES_PASSWORD`. **Don't change it once apps are installed**: they'd lose their database login and bucket key until reinstalled.
- **What it does:** runs apps in their own Compose project, `augur-apps`, in `infra/deploy/apps/` (don't edit those files). Each install: verify the signer (`APP_PUBLISHERS` adds trusted ones), make storage, set the sign-in, start in the unused blue or green slot, wait up to 3 minutes for `/healthz`, switch, watch 5 minutes (two misses send it back), retire the old version after 10 minutes.
- In Admin → Apps: **Install**, **New releases** (stable or betas), **When one is out** (**Automatic**, **Ask first**, **Hold**), **Remove from the server** (data stays). Every action is in Activity. Scripts: `/api/registry/v1/app-runner/…`.
- `pc down` can't remove the network while apps run: first `docker compose -p augur-apps -f infra/deploy/apps/compose.yml down`.

### Images now come from the release, not built on the server
**From** the first `augur@` release · **By hand**, once · **Way back** [open]
- **Do, once, before this upgrade:**
  1. Sign the server in to GitHub's container registry (deploy.md; a token with only **read:packages**).
  2. Add `PLATFORM_VERSION=<the release>` to `.env`.
  3. Upgrade with the usual steps, using `git checkout augur@<version>`, not `git pull`.
- **What changes:** `web` listens on 8080; every image runs unprivileged; `tailscale/serve.json` already points at 8080. Old local images can go with `docker image prune`.

### The model gateway arrives, off until you want it
**From** [open] · **Do before** (for Agents) · **Way back** [open]
- **Do, to get it ready:** add `MODELS_CLIENT_SECRET` to `.env`, and `MODEL_API_URL`, `MODEL_API_KEY` and `MODEL_NAME` (or `MODEL_API_URL=stand-in` to try it) (agents.md).
- **Skip it and** no model calls are made, because none could be recorded. Models stay off until an admin turns them on in Admin.

### Upload limits move to each app
**From** [open] · **Nothing to do** · **Way back** [open]
- Uploads stream through without being held. Each app is held to its manifest's `maxUpload`, or less where an admin lowered it in Admin, Apps. An app that doesn't say gets 10 MB, where everything got 50 MB before.

### The gateway signs the caller
**From** [open] · **Check** (apps with their own service) · **Way back** [open]
- Nothing to add. The gateway makes its key and services fetch it (signed-caller.md). **If** an app has its own service, it should add the service kit's `signedCallers` hook; until then it keeps working on plain headers.

### App storage: Garage and a storage job
**From** [open] · **Do before** · **Way back** [open]
- **Do:** before you upgrade, add `GARAGE_RPC_SECRET` and `GARAGE_ADMIN_TOKEN` to `.env`. `APP_STORAGE` can stay unset.
- **What changes:** two new containers: `garage` (the object store) and `storage` (sets up each app's storage and stops). Postgres moves to `pgvector/pgvector:0.8.0-pg16`, the same version with pgvector; data carries over.

### Renamed to AUGUR
**From** [open] · **Nothing to do** · **Way back** [open]
- The shell, page title and Admin say AUGUR; packages are `@augur/*`. Your server's identifiers stay, so nobody is signed out: realm `platform`, database and Compose project `platform`, `PLATFORM_*` keys, address `https://platform.<tailnet>.ts.net`.
- **Optional, sign-in page title:** Keycloak read the realm file only on first start, so the page says "Platform". In the Keycloak console (`PLATFORM_URL/sso/admin`, with `KEYCLOAK_CONSOLE=open`; deploy.md), `platform` realm, **Realm settings**, set **Display name** to `AUGUR`.
- **Optional, address:** to be at `https://augur.<tailnet>.ts.net`, set `TS_HOSTNAME=augur` and `PLATFORM_URL` to match, and update the **shell** client's redirect URIs and web origins in the Keycloak console before `pc up -d`. **Everyone signs in again.**
