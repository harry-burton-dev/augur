# Upgrading AUGUR

Moving a running server from one release to the next. Commands use the `pc` alias from [deploy.md](deploy.md):

```sh
alias pc='docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env'
```

## Before you start

The **Upgrade Centre** (`/upgrades`) shows whether a newer release is out, what changes in each part, and a **Needs you first** list: a release you have to go through first, settings to add, breaking changes, and apps that won't open on the new SDK. It fills in the version for the steps below. The registry checks once a day; **Check now** checks straight away.

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

Every release has been through the [deploy test](https://drive.google.com/drive/folders/1m2NCsXrXQxhsbnDfIqgezh8nmKY6XBa2) in CI: the release before it is upgraded to it with data, and gone back to. Your server can still differ, so check it yourself too.

- `pc ps` shows each of AUGUR's services as `healthy` about a minute after it starts: Compose asks each one's `/healthz` every 30 seconds. One that stays `unhealthy` or `starting` is the one to look at in `pc logs`.
- Open **Admin → Status**. Give it a minute: every part should be Running, with the new versions in the Version column.
- Sign in as yourself and as someone without the admin role, and open an app or two.
- `pc logs --since 10m gateway identity registry events` shouldn't show errors. Every log line carries a `requestId`; the same id is in the `x-request-id` header of the response, so a problem someone reports can be found across every service's logs.

## Release notes that need you

Each note starts with the release it came in (**From**). If your server already runs that release or a later one, it's done. Before you upgrade, read every note from a release after yours; **From** unreleased means the next release.

Adding a note: put it at the top, with `**From** unreleased` as its first line. The Version packages pull request writes the release in, and `pnpm check:upgrade-notes` fails a note without one.

### Upgrades no longer stop at the restore test

**From** unreleased

- **If an upgrade was turned back with "didn't restore in the test" and `type public.vector does not exist`, run this once on the server before you upgrade again.** The test runs in the backup container your server already has, which before this release lacked pgvector, so the release that fixes it can't get past it on its own. From the folder AUGUR is in:
  ```sh
  sed -i 's#^    image: postgres:16-alpine$#    image: pgvector/pgvector:0.8.7-pg16-bookworm#' infra/deploy/compose.yml && pc up -d backup
  ```
  Then ask for the upgrade again on the Updates page. The release puts the same image in its own compose.yml, so nothing else changes.
- **Nothing to do otherwise.** The updater's log now says why an upgrade didn't go ahead, beside `rolled-back`.

### The app bar replaces Title and Orbit

**From** unreleased

- **Nothing to run.** People see the new navigation after the upgrade: a bar of tiles across the desktop, one per group of apps (Platform, Pillars, Apps), which docks beside an app as the rail with that app's pages.
- **Tell people Esc no longer leaves an app.** Home in the rail is the way back to the desktop. Where someone moves the bar to is kept with their other preferences.

### Two-step accounts aren't linked to Entra, and leavers' events can't be lost

**From** unreleased

- **Entra:** an account holding a two-step role is no longer linked automatically at its first sign-in through Entra; that sign-in is refused and says why. If two steps for everyone is on, that's every account that already exists, and only people with no account yet get one through Entra. Accounts already linked aren't touched. The realm job rebuilds the first sign-in flow on the next `pc up -d`, and for those few seconds a first sign-in gets Keycloak's own flow, which asks for the old password.
- **Nothing to run for old entries.** The events service's migrations take the notes out of Activity for people already deleted, and delete the notices that they asked to leave.
- A name on an upgrade someone asked for goes when the registry hears `platform.person.deleted`. It reads back the 30 days of events the events service keeps, so someone deleted before that keeps their name on the upgrades they asked for. Only the Upgrade Centre's history shows it.
- A night identity can't say how long Activity is kept now removes nothing, where it used to remove what was older than 365 days. If `pc logs events` says `Activity retention: nothing removed tonight` every night, fix what it names.
### Artifacts asks for two more scopes

**From** unreleased

- **Scopes**: Artifacts now asks for `events:subscribe` and `inbox:write`. It's still served without them, but gets them only once an admin allows them in Admin, Apps: allow them after upgrading.
- **Deleted people**: people deleted more than 30 days before the upgrade keep their names in Artifacts.

### Backups are root's alone, and the off-server copy carries .env

**From** unreleased

- **Backups**: dumps and archives in `infra/deploy/backups/` are now readable by root alone, and Status's results move to `infra/deploy/backups/status/`, the only part the gateway sees. Read a dump through the backup container, as the guides now do (`pc run --rm --no-deps -T --entrypoint gunzip backup -c /backups/<file>`).
- **Off-server copy**: `.env` and `secrets/` now go into it each night, encrypted with `OFFSITE_PASSWORD`. Keep every `OFFSITE_*` setting off the server: they're what a lost server needs ([deploy.md, Restore a lost server](deploy.md#restore-a-lost-server), which replaces the old steps; those copied an empty database over the real copies). The copy also refuses a dump with no AUGUR in it, and a repository another server filled, until `backup.sh --adopt-offsite`.
- **Networks**: telemetry has a network of its own, which apps the runner installs aren't on, and Artifacts' rendition worker reaches only Postgres, Garage and `otel-lgtm`, with read-only files, 2 processors (`FOLIO_WORKER_CPUS`) and an in-memory `/tmp` of 1g (`FOLIO_WORKER_TMP_SIZE`). On a server with fewer than 2 processors, set `FOLIO_WORKER_CPUS=1` before upgrading, or Docker won't start the worker.
- **The updater** writes `.env` whole, refuses an upgrade with less than 2 GiB free, keeps a note of an upgrade under way (`infra/deploy/.updater-upgrade.json`) so it goes back after a restart partway through, and, with a breaking release between, never goes back by itself once a part has restarted on the new one. It waits up to 5 minutes for each part.
- After upgrading, check Admin → Status still shows the last backup and the off-server copy. If Status says the copy holds backups this server didn't make, and they are this server's, run `pc exec backup /bin/sh /backup/backup.sh --adopt-offsite` once.

### Upgrades only take settings they add, and removed apps stay removed

**From** unreleased

**Upgrade to …** now takes only settings the upgrade adds, and never one that says what the server trusts, such as `SERVER_RING`, `IMAGE_SIGNER` or `APP_PUBLISHERS`. Set those in `.env` on the server.

An app an admin removed can no longer register itself back. If you want it again, install it from Admin, or have an admin register it. Automatic upgrades and app updates now wait while a release feed has a problem or has expired, and a production server refuses app releases that haven't been promoted.

### Leavers' accounts are deleted after the retention period

**From** unreleased

Identity now deletes a leaver's account once the organisation's leaver retention has passed (Admin → Organisation, Security and retention; 90 days unless a deployment admin changed it; ADR 0072). It can't be undone: Activity loses their personal values and Keycloak deletes the account. Anyone who left more than that many days before you upgrade is deleted within five minutes of identity starting. If you want to keep someone longer, raise the retention before upgrading. Apps that follow `platform.person.deleted` should delete or anonymise what they keep about that person.

### The organisation's logo, sign-in notice, languages and security move into Admin

**From** unreleased

Admin → Organisation now also keeps the organisation's logo, a sign-in notice, the languages offered and, for a deployment admin, two steps for everyone and how long leavers and Activity are kept (docs/deploy.md, "Organisation settings"). Nothing to do. If you set `ORG_LOGO_URL`, it still wins; take it out of `.env` to use the logo kept in Admin. Languages chosen in Admin replace `REALM_LANGUAGES`. The sign-in pages pick up the notice, languages and the organisation's name at the next `pc up -d`.

### An app's updates are in the Upgrade Centre only

**From** unreleased

Admin → Apps no longer has an installed app's **New releases**, **When one is out**, waiting version, history or **Go back**, nor a **Needs you** list of app updates: they were a second copy of what the Upgrade Centre (`/upgrades`) does, and they now live only there. Admin → Apps keeps installing new apps from their releases, each job's steps, developers and previews, and **Remove from the server**, and links to the Upgrade Centre from each installed app. Nothing changes on the server; each app keeps the channel and policy it had.

### Data Atlas can draw a base map from a file you keep

**From** augur@0.23.0

Nothing to do: Data Atlas's maps work without one, drawing points on a plain background and saying why. To add a base map, put a vector PMTiles file in `maps/` beside your compose file and set `ATLAS_MAP_TILES=/maps/<file>.pmtiles` in `.env`, then `pc up -d atlas`. docs/atlas.md, Maps, says how to cut one for your region. No map request leaves the server.

### The first admin's department is called Administration on new servers

**From** augur@0.23.0

Nothing to do on a server that's already running: its departments keep their names, because the realm reads `PLATFORM_ADMIN_DEPARTMENT` only at first start. On a new server, the first admin's department is now called `Administration` instead of `Platform` unless `PLATFORM_ADMIN_DEPARTMENT` names another. To rename an existing one, use Admin → Departments.
### Idle accounts are warned, then turned off

**From** augur@0.23.0

Where email is set up, Keycloak now emails someone who hasn't signed in for 60 days and turns their sign-in off at 90 (Admin → Organisation, Idle accounts, to change the days or turn it off). The count starts at each person's next sign-in after this upgrade, so nobody is turned off sooner than 90 days from now. Deployment admins are never turned off. If you'd rather not, turn idle accounts off in Admin → Organisation, then run `pc up -d keycloak-config` so it applies straight away (docs/people.md, Idle accounts).

### People are emailed when how they sign in changes

**From** augur@0.23.0

Once email is set up (`SMTP_*`), Keycloak emails each person when their password, code app or passkeys change. The realm job turns this on at `pc up -d`, and people see it in Account → Sign-in and security. Failed sign-ins aren't emailed. Nothing to do.

### Adding someone sends an invite email

**From** augur@0.23.0

Where email is set up (`SMTP_*`, docs/deploy.md, Email), Admin → People → Add a person now emails an invite by default: a link that lasts 72 hours to confirm their email and choose a password. The one-time password is still there under **How they start**, and is the only choice where email isn't set up. Nothing to do, unless your relay refuses mail from Keycloak: then Admin says the invite couldn't be sent, and Admin → Status, Email says why.

### Email comes from the organisation's sender

**From** augur@0.22.0

AUGUR's email now comes from the sender set in Admin → Organisation: the organisation's name unless an admin changed it, rather than the product's name. Once an address is set there, it replaces `SMTP_FROM`. Nothing to do. The realm job now also reads identity's database, using the `IDENTITY_DATABASE_PASSWORD` identity already uses. After changing the sender, run `pc up -d` so Keycloak's emails pick it up.

### Desktops without a GPU can go without blur

**From** augur@0.22.0

Nothing to do unless your organisation's desktops have no GPU, such as virtual desktops. There, set `FOCUS_DEPTH=scrim` in `.env` and `pc up -d web`: dialogs, menus and the palette then dim what's behind them instead of blurring it, which is slow without a GPU. Unset, nothing changes (docs/deploy.md, "Desktops without a GPU").

### Activity keeps a year

**From** augur@0.20.0

Activity (Admin's record of who did what) now keeps entries for 365 days. Each night at 03:00 UTC the events service removes older ones, and Activity records how many it removed. On the first night after the upgrade, anything older than a year goes. To keep it, download it first, signed in as an admin: open `/api/events/v1/audit/export?since=2025-01-01T00:00:00Z&until=2026-01-01T00:00:00Z` on your AUGUR's address (CSV, at most 366 days per download; Admin's own download button comes with a later release). When the organisation's policy sets a different period (Admin, Settings), the events service uses that instead.

### Grafana's password is required

**From** augur@0.20.0

`GRAFANA_ADMIN_PASSWORD` is now required, because Grafana with none signs in as admin/admin. An upgrade from the Upgrade Centre makes one up and writes it to `.env`, where you read it to sign in. By hand, set it before `pc up -d` (`openssl rand -hex 16`), even with `OTEL_LGTM_REPLICAS=0`. Settings you enter for an upgrade are still never stored: if the registry restarts before the updater takes them, the upgrade ends at once, failed, nothing changed, and says to ask again. The registry also turns down a signed feed issued before the newest one it has taken since it started, so an older feed still in date can't be replayed to hide a newer release or a halt; the Upgrade Centre says so.

### Time limits between services and on database queries

**From** augur@0.20.0

One AUGUR service now waits at most 5 seconds for another (`SERVICE_CALL_TIMEOUT_SECONDS`), and Postgres cancels any one query from a service after a minute (`DATABASE_STATEMENT_TIMEOUT_SECONDS`, 0 for no limit; migrations are never limited). Nothing to do. On a slow server, if `pc logs` shows a working service giving up ("could not be reached", or "canceling statement due to statement timeout"), raise the value in `.env` and run `pc up -d` ([deploy.md](deploy.md#logs-memory-and-health)).

### Each service signs in as itself

**From** augur@0.2.0

`SERVICE_TOKEN` is gone. Before upgrading, add `IDENTITY_CLIENT_SECRET`, `REGISTRY_CLIENT_SECRET` and `EVENTS_CLIENT_SECRET` to `.env` (`openssl rand -hex 32` for each), and remove `SERVICE_TOKEN`. Identity makes the matching Keycloak clients when it starts. An app with its own service needs a sign-in from Admin, Apps (**Issue a new sign-in**) as its `SERVICE_CLIENT_SECRET`.

### Restoring the database to a point in time

**From** augur@0.20.0

From this release Postgres archives its changes as it makes them, and the backup container takes a base backup each night beside the dump, so the database can go back to any moment in the last 7 days (ADR 0064; [deploy.md](deploy.md#restore-to-a-point-in-time)). The Upgrade Centre doesn't restart Postgres or the backup container: after upgrading, run `pc up -d postgres backup` once. Postgres restarts with archiving on (a few seconds without the database), then the backup container takes the first base backup and tests a replay. Until then Admin → Status says "Backups need a look" and why. It needs disk for 7 base backups, each about the size of the database, beside the dumps.

### SDK 2: the shell stops serving Lit

**From** augur@0.20.0

From the release on SDK 2.0 the shell no longer serves `lit` or `@augur/ui-kit`. Nothing to do for the apps that ship with AUGUR: Home, Admin, the Upgrade Centre, Explorer, Artifacts, Mandate and Data Atlas never used them, and their manifests accept SDK 2. An app of your own that imports Lit stops loading: move it to React and Quill first (docs/build-an-app.md). An app of your own that doesn't import Lit keeps working once its manifest's `sdk` range also accepts 2, say `^1.4.0 || ^2.0.0`; until then the shell shows it as made for an older version.

### The deployment watches itself

**From** augur@0.19.0

otel-lgtm, Grafana's OpenTelemetry stack, now runs in every deployment, keeps 72 hours and runs AUGUR's alert rules ([observability.md](observability.md#alerts)). Its alerts reach deployment admins as notices through the registry, with `ALERT_WEBHOOK_TOKEN`: the updater makes it up when you upgrade from the Upgrade Centre; by hand, add it to `.env` (`openssl rand -hex 32`) before `pc up -d`. Set `GRAFANA_ADMIN_PASSWORD` (`openssl rand -hex 16`) too, to sign in to Grafana. It takes up to 2 GB of memory (`OTEL_LGTM_MEM_LIMIT`); a server with its own collector sets `OTEL_EXPORTER_OTLP_ENDPOINT` to it and `OTEL_LGTM_REPLICAS=0`. The `observability` profile does nothing now and can come out of `COMPOSE_PROFILES`. The registry's report to Backstage now goes every 15 minutes.

### Email through your relay (optional)

**From** augur@0.19.0

AUGUR can now send email through the organisation's SMTP relay: password resets and address checks from the sign-in pages. Nothing changes until you add `SMTP_HOST` and `SMTP_FROM` (and `SMTP_USER` and `SMTP_PASSWORD` if the relay wants a sign-in) to `.env` and run `pc up -d`; see [Email](deploy.md#email). `pc logs keycloak-config` then says the relay is set.

### Organisation settings move to Admin

**From** augur@0.20.0

Admin → Organisation now holds the organisation's name, time zone and email sender (ADR 0042). Nothing to do: the name your server already shows, which came from `ORG_NAME` at first start, stays as it is, and the time zone starts as UTC. From this release identity ignores a changed `ORG_NAME`: change the name in Admin instead. The sign-in pages still show `ORG_NAME` for now, so keep the two the same.

### Mandate ships with AUGUR

**From** augur@0.19.0

Mandate, intent passed down the floors, now ships with every release like Artifacts, Explorer and Data Atlas: a new container, `mandate`, at the release `release/shipped-apps.json` pins. Admin → Apps no longer lists it as something to install, and it's upgraded with AUGUR from now on.

New settings: `MANDATE_CLIENT_SECRET` and `MANDATE_DATABASE_PASSWORD` (required), and `MANDATE_BUCKET_SECRET` (optional). The updater makes them up when you upgrade from the Upgrade Centre; by hand, add them to `.env` (`openssl rand -hex 32`) before `pc up -d`.

**A server whose app runner installed Mandate keeps its data.** AUGUR's container uses the same database login and schema (`app_mandate`) and the same sign-in (`app-mandate`) the runner gave it: the storage job sets the login's password, and the realm job the sign-in's secret, to the new values, and the aims and parts already there stay. Once the new updater starts, it stops the runner's own Mandate containers (`app-mandate-blue` or `-green`, Activity names them) and forgets them, so AUGUR's is the only one. Nothing to do yourself.

Going back to a release before this one: Mandate's data stays in the database, and Admin → Apps lists it as installed again, at the version it had, but nothing runs it. Install that version again there and the runner starts it on the same data.

### Settings the guides named now reach their services

**From** augur@0.19.0

Some settings the guides told you to put in `.env` never reached the service that reads them: `FEED_SIGNER`, `IMAGE_SIGNER`, `AUGUR_DEV_SIGNER`, `DOMAIN_EVENTS_KEEP_DAYS`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_TRACES_SAMPLER` and `OTEL_TRACES_SAMPLER_ARG`. From this release compose passes them, with `MODEL_TIMEOUT_SECONDS`, `IMAGE_SIGNER_ISSUER` and `CALLER_SIGNING_KEY`. Nothing to do unless one is already in your `.env`: it takes effect at the upgrade, so check it says what you want. Every setting is now described in `infra/deploy/settings.schema.json` ([deploy.md](deploy.md#settings-and-secrets)).

### AUGUR's sign-in pages and emails

**From** augur@0.19.0

Keycloak now runs from AUGUR's own image (`ghcr.io/harry-burton-dev/im-platform/keycloak`, tagged and signed like the others) instead of Keycloak's, with the same Keycloak version and AUGUR's sign-in and email theme (ADR 0041). The realm job turns the theme on. Nothing to do: the pages show `ORG_NAME`, as identity does. Optional, in `.env`: `ORG_LOGO_URL` for a logo on the sign-in pages, and `REALM_LANGUAGES` (say `en,de,fr`) to offer more languages than English (docs/deploy.md, "What's in it"). Going back to a release before this one puts Keycloak's own image back: sign-in shows Keycloak's own look again, and Keycloak's log says it can't find the `augur` theme each time a page is shown, which is harmless.

### Log limits, memory limits and healthchecks

**From** augur@0.18.0

Every container's log is now capped at three files of 10 MB, and Keycloak, Artifacts' rendition worker and the observability stack have memory limits (2 GB, 4 GB and 2 GB). Keycloak and Garage have healthchecks, and the containers that need them wait until they're healthy. Nothing to do on most servers: the upgrade recreates each container with its limits. Existing logs bigger than the cap go when the container is recreated. On a server with less than 8 GB of memory, set `KEYCLOAK_MEM_LIMIT` and `FOLIO_WORKER_MEM_LIMIT` lower in `.env` first (docs/deploy.md, "Logs, memory and health").

### Keycloak 26.8 and the realm job

**From** augur@0.18.0

This release moves Keycloak from 26.0.8 to 26.8.1 and keeps the realm as code (ADRs 0037, 0038 and 0057). Keycloak migrates its database on its first start on 26.8, and **that can't be undone**: going back to the release before means restoring Keycloak's database from the backup you take first. Take this release by hand, with the steps above, rather than leaving it to an upgrade window.

1. Take a backup and test it (step 4 above). Keep the file name: `infra/deploy/backups/platform-<date>.sql.gz`.
2. Check `KEYCLOAK_ADMIN_PASSWORD` in `.env` is still Keycloak's master admin password. If you changed it in the console, put the current one in `.env`: the realm job signs in with it on every `up`.
3. Upgrade as usual. A new container, `keycloak-config`, runs once Keycloak is up, sets the realm up and stops; identity starts after it. Keycloak's first start on 26.8 takes a minute or two longer while it migrates.
4. Check: `pc logs keycloak-config` ends with "The platform realm is up to date" and lists what it changed, and `pc ps -a keycloak-config` shows it exited with 0.

What changes for people:

- Passwords need 15 characters or more, and can't be the username, the email or a known breached password. Nobody is made to change a password they already have; the rule applies to the next one they choose.
- Admins and deployment admins are asked to set up a code app at their next sign-in, unless they sign in with a passkey. Anyone can add a passkey or a code app.
- Sessions end after 8 hours unused or 10 hours at most.
- Identity no longer holds `manage-realm`: it can't change sign-in settings, and `infra/deploy/identity-repair.yml` is gone. If identity's log says it lacks rights, `pc up -d keycloak-config identity`.

**Going back** is a restore of the backup from step 1, which puts Keycloak's database back as it was before 26.8 (anything changed since is lost): set `PLATFORM_VERSION` back, check out that release's deploy files, then

```sh
pc stop
pc up -d postgres
pc ps postgres            # again until it says healthy
pc run --rm --no-deps -T --entrypoint gunzip backup -c /backups/platform-<date>.sql.gz | pc exec -T postgres psql -U platform -d postgres
pc up -d --remove-orphans
```

### Artifacts, Explorer and Data Atlas come from their own repositories

**From** augur@0.19.0

Since augur@0.17.0, AUGUR no longer builds Artifacts, Explorer and Data Atlas itself. Each one is released in its own repository (`augur-folio`, `augur-auspex`, `augur-atlas`), and AUGUR's release takes the release `release/shipped-apps.json` pins, checks that repository signed it, and signs it again as AUGUR's (ADR 0049). Nothing changes on the server: the images keep their names under `PLATFORM_IMAGES`, they still come with each AUGUR release, and the apps keep their tables and buckets. An app the app runner installs (Mandate) moves the same way, and the updater takes a backup before its first release from the new repository (docs/ship-an-app.md, "An app in its own repository").

**Going back** to a release that built them here (0.16.x) is the usual code step in [Going back](#going-back): check out `augur@0.16.1`, set `PLATFORM_VERSION=0.16.1`, `pc up -d --remove-orphans`. No restore is needed. Neither 0.17.0 nor the apps' releases in it are breaking, so their migrations only add ([versioning.md](versioning.md#database-migrations)), and 0.17.0's deploy test went from 0.16.1 to 0.17.0 and back on the same data. Going back past 0.18.0 is the exception: Keycloak 26.8's database needs the restore in "Keycloak 26.8 and the realm job" first.

### Sample data, where you allow it

**From** augur@0.18.0

`pnpm seed` (docs/seed.md) fills a deployment with synthetic sample people, floors, documents and entities, and only where `.env` sets `SEED_ALLOWED=true`; nothing changes on a server that doesn't. To use it on a server that already exists, also add its sign-in client, which Keycloak doesn't import into an existing realm: open the Keycloak admin console (`KEYCLOAK_CONSOLE=open`, deploy.md), choose the `platform` realm, **Clients → Import client**, and import the `platform-cli` entry from `infra/deploy/keycloak/platform-realm.json`. Then close the console again.

### AUGUR's repository gets a new name

**From** augur@0.15.0

AUGUR's repository was renamed from `im-platform` to `augur` on 5 November 2026 (Linear PER-162). Every release is signed by the repository's workflows, so from this release the updater and registry take AUGUR's releases, dev builds and feed signed under either name. A server must run this release **before** the rename, or it refuses everything released after it.

Nothing else moves. Images and the feed stay at `ghcr.io/harry-burton-dev/im-platform`, so `PLATFORM_IMAGES` and your read key stay as they are, and GitHub forwards the old addresses to the new one. A git checkout of the repository keeps working too; to use the new address, run `git remote set-url origin https://github.com/harry-burton-dev/augur.git`.

### The first upgrade on each server is yours, and a 0.x minor waits for you

**From** augur@0.15.0

Two defaults changed (ADR 0020, amended 2 November):

- **Automatic waits for one upgrade by hand.** On each server, AUGUR doesn't upgrade by itself, dev builds included, until an admin has upgraded it there once from the Upgrade Centre and it finished. Until then **Needs you** says so, with **Upgrade**. A server where an admin has already upgraded AUGUR and it finished carries on as before.
- **A 0.x minor counts as a major.** Under semver a 0.x minor (0.3 to 0.4) may break things, so Automatic takes only 0.x patches, for AUGUR and apps alike. A 0.x minor waits under **Needs you** for an admin, whatever the record says about minors.

### Reporting to Backstage

**From** augur@0.15.0

From this release a deployment can tell the company's Backstage what it runs (ADR 0019). Nothing changes until you set it up; until then the Upgrade Centre's Reporting section, under Worth knowing on its front page, says reporting isn't set up and what to set.

1. Add the deployment to Backstage's `org/deployments.yaml`, if it isn't there, and note its `metadata.name`.
2. Set `DEPLOYMENT_ID` in `.env` to that name, with `PORTAL_URL` set to the Backstage address. Then `docker compose up -d registry`.
3. Copy the deployment's public key, shown by `GET /api/registry/v1/platform/reporting` as an admin (or **Copy key** in the Upgrade Centre's Reporting section), into the annotation `augur.dev/report-key` on that entry, and let Backstage read the catalog again.

The registry makes the deployment's own Ed25519 key the first time it's needed and keeps it in the database, so a restored backup reports as the same deployment. It signs a record of what the server runs and sends it two minutes after it starts (so after each AUGUR upgrade), whenever a version, an upgrade's result or something that needs you changes (it looks every 15 minutes), and once a day. The record holds the deployment's name and ring, AUGUR's and each app's version, what's available, each unit's policy and pin, health, the last results, and the feed's state. It holds no names or ids of people. Backstage refuses a record from a deployment it doesn't list, or not signed with the key it lists.

An air-gapped server sets `DEPLOYMENT_ID` and no `PORTAL_URL`: nothing is sent, and an admin exports the record (**Export the record** in the Upgrade Centre's Reporting section, or `GET /api/registry/v1/platform/reporting/export`) and carries the file to the deployment's card in Backstage. `DEPLOYMENT_REPORTING=off` turns both off.

### Each upgrade is watched for 10 minutes

**From** augur@0.15.0

An upgrade to a newer release isn't done once every part answers: the updater watches it for 10 more minutes (ADR 0020). Every half minute it signs in as itself, with a fresh token (so Keycloak and its database must both work), and checks how AUGUR's own services' calls went at the gateway (`GET /traffic`, which only the deployment's own network reaches; apps are counted apart, so an app's errors can't send AUGUR back). Every two minutes it checks that every part is still ready. If sign-in fails twice in a row, a part stops answering, or more than 5% of at least 20 calls fail, it goes back to the release it came from by itself, as it does when a part doesn't come up, and the Upgrade Centre says what it saw. If a breaking release lies between, it doesn't go back by itself: it says what it saw, and the release keeps running for you to decide (Going back, below). Going back to an earlier release isn't watched. With fewer than 20 calls in the 10 minutes, as is usual in a night-time window, the result says it was too quiet to judge errors, and a light watch goes on (ADR 0020, amended 2 November). Every 5 minutes the updater signs in and counts AUGUR's calls since its last look, until there have been 20, for at most a day. If more than 5% of them failed, or sign-in fails twice in a row, AUGUR doesn't go back by itself, because by then people's work is on the new release: it shows in **Needs you** with what it saw, for an admin to decide (Going back, below). The registry keeps the count, so a restarted updater carries on. Asking for another upgrade ends it.

The updater does nothing else in those 10 minutes, so an app install asked for meanwhile starts after. Both sides need this release: an older updater ignores the watch, and an older gateway has no `/traffic`, so only sign-in is watched.

### Upgrades follow each unit's policy and window

**From** augur@0.15.0

AUGUR and every installed app now have one record each saying how they take new releases (ADR 0020): **Automatic**, **Ask first** or **Hold**; how far Automatic goes (patch releases only, or minor ones too); an optional pin, a version range such as `0.13.x`; and the weekly windows an automatic upgrade may start in. A major release, a 0.x minor, one that needs a setting only a person can give, or one an earlier try didn't finish always waits for an admin, and nothing starts by itself until an admin has upgraded AUGUR on that server once. An upgrade an admin asks for starts at once, whatever the window.

Until an admin changes it, **AUGUR on a production server installs its patch releases by itself on Sunday at 02:00, for two hours**, in the deployment's time zone. On a preview server or the workbench it installs them at any time. Apps keep what they had: patch and minor releases, at any time, with the channel and policy set on each app's page in the Upgrade Centre. To change any of it, use the Upgrade Centre (the API is `PUT /platform/units/<unit>/desired-state` in contracts/registry.openapi.yaml); to keep AUGUR's upgrades to the ones you start, set its policy to Ask first.

- Set `DEPLOYMENT_TIME_ZONE` in `.env` to your time zone, such as `Europe/London`. Without it windows are in UTC.
- A failed upgrade or one that went back by itself stays in the Upgrade Centre's **Needs you** for every admin until one of them marks it looked at.

### Each platform service gets its own database login

**From** augur@0.15.0

Identity, the registry, events, models and Keycloak stop connecting as Postgres's admin login (`platform`). Each gets a login that owns only its own schema, or for Keycloak its own database. The release adds five required settings: `IDENTITY_DATABASE_PASSWORD`, `REGISTRY_DATABASE_PASSWORD`, `EVENTS_DATABASE_PASSWORD`, `MODELS_DATABASE_PASSWORD` and `KEYCLOAK_DATABASE_PASSWORD`. The Upgrade Centre makes them up for you. If you upgrade by hand, add each to `.env` first (`openssl rand -hex 32`). On the first `up`, the storage job makes the logins and hands each one the tables its service made while it ran as `platform`. The upgrade's backup comes first, as always. Going back to the earlier release still works, because that release connects as `platform` again.

### A call that names no floor is checked on the organisation's

**From** augur@0.15.0

An app's service calls (notifications, audit, models, people lookups) that name no floor used to get the app's scopes wherever it was on at all. Now they're checked on the organisation's floor, as the gateway already checked people's calls. Nothing changes for an app that is on for the whole organisation, which is every app AUGUR ships with unless you turned one off. If you turned an app off for the organisation and on for some teams, its service must now name the team's floor to send there. A refused call shows in that app's service log (`pc logs <app>`) as a 403 saying it isn't granted the scope.

### Only a deployment admin can upgrade

**From** augur@0.15.0

Upgrading AUGUR, going back to an earlier release, taking back a waiting upgrade, and changing how a unit takes updates (policy, pin, windows) now need the `deployment-admin` role, not just `admin` (ADR 0022). The first admin (`PLATFORM_ADMIN_USER`) has held it since the deployment-admin release, because identity gives it to them when nobody else has it. Anyone else who upgrades needs it in Admin, People. Someone without it sees the Upgrade Centre's buttons refused with the role named.

### Apps follow the same rule

**From** augur@0.15.0

Installing, upgrading or removing an app, and changing how it takes new releases (Admin, Apps: "New releases" and "When one is out"), now need `deployment-admin` too, as AUGUR's own upgrades do (ADR 0022). Changing how any unit takes updates, AUGUR included, now asks for your password again if you last entered it more than 10 minutes ago, as an upgrade does. A plain `admin` still sees everything and can mark results looked at.

### Keycloak's admin leaves identity

**From** augur@0.15.0

Identity no longer gets `KEYCLOAK_ADMIN_PASSWORD`. Its own sign-in already holds its rights on every server that has started identity before, so there's nothing to do. Keep the password in `.env`: Keycloak reads it on a new server, and it's the way back in if every deployment admin loses their one-time code. If identity's log ever says its sign-in can't manage the realm, see **Keycloak's admin** in deploy.md.

### The signed feed

**From** augur@0.15.0

From this release the registry checks the release feed before it believes it (ADR 0017). The Feed workflow signs it with cosign, keyless, as the Release workflow signs images, and gives it an expiry two weeks out; it runs again every Monday, so a feed that stops being renewed runs out. The registry turns down a feed that isn't signed by `feed.yml` on `main` or a release branch, whose signature doesn't verify, or that has expired. It keeps running what it runs, and the Upgrade Centre says why. Nothing to set for the publisher's feed: the registry's image now carries cosign, and checks offline when `infra/deploy/releases/trusted_root.json` is there.

- **A mirror** ([mirror.md](mirror.md)) is shown as your organisation's own feed, not as signed by the publisher, and doesn't expire. Each image is still checked as before.
- **The old token path** (`release-feed-token`, reading GitHub's releases straight) is shown as not signed. Swap it for [the read key](#the-read-key).
- `FEED_SIGNER` in `.env` overrides which workflow may sign the feed, as a regular expression. Leave it unset unless you publish AUGUR from a fork.

A release its publisher **halted** (the Halt rollout workflow, [release-channels.md](release-channels.md#halting-a-release)) is still listed in the Upgrade Centre, marked halted with the reason, but is never offered, chosen as the next upgrade or installed. A server running one is told so first, and where to go: a newer release that isn't halted, or back to the one before.

### Installing a halted release to test going back

**From** augur@0.18.0

On a **dev or preview** server only, a deployment admin can install a halted release on purpose, to prove AUGUR goes back by itself from a broken one (ADR 0051). In the Upgrade Centre, open AUGUR and choose **Install … for a test** beside the halted release; it asks for the reason and may ask for your password again (the API is `PUT /v1/platform/upgrade/halted` with `version` and `reason`). On a production server the action stays visible but can't be used, and says why. The release must be newer than the one the server runs, able to upgrade from it, and have no breaking release in between, because going back by itself is the point. The watch then judges it like any other upgrade. A production server (`SERVER_RING=production`) always refuses, and every request, allowed or refused, is in the audit log (`platform.halted-install-requested`, `platform.halted-install-refused`). Automatic policies never take a halted release, so it doesn't come back after the server went back.

### The read key

**From** augur@0.6.0

While the repository is private, a deployment needs one **read key**: a GitHub token that can read this repository's packages and nothing else. With it, the registry checks GitHub for new AUGUR releases (the Upgrade Centre) and new app releases (Admin → Apps) itself, and the updater pulls both. The releases are listed in a feed the Release workflow keeps beside the images, `ghcr.io/harry-burton-dev/im-platform/feed`, so the one token GitHub's container registry accepts covers everything. It replaces the two tokens servers needed before (`release-feed-token` and `image-pull-token`), which still work until you swap them.

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
3. `pc up -d registry updater`, then **Check now** in the Upgrade Centre. It lists releases, or says the key was refused and why. The old `release-feed-token`, `image-pull-token` and `IMAGE_PULL_USER` can then go.

To take a deployment's access away, delete its token in the account's **Settings → Developer settings → Personal access tokens**; the others carry on. When a token is near its expiry, make a new one and repeat step 2.

A deployment that pulls from a mirror ([mirror.md](mirror.md)) has no use for a read key: its feed and images are in your own registry.

### Auspex is called Explorer

**From** augur@0.15.0

Auspex now shows as **Explorer**, a platform app. Its container, `.env` name (`AUSPEX_CLIENT_SECRET`), sign-in and address (`/auspex`) haven't changed, so there's nothing to do.

### Server rings

**From** augur@0.9.0

A new required setting, `SERVER_RING`: `preview` on the server that runs what's on its way to production, `production` on every other (docs/release-channels.md). **Upgrade to …** has a field for it. A production server follows stable releases only, and runs no pull requests' builds unless `ALLOW_PR_PREVIEWS=on`.

### Data Atlas ships with AUGUR

**From** augur@0.7.0

Data Atlas, the entities the org knows about (ships, people, places) and how they connect, is now part of every release: a new container, `atlas`, and its frontend inside `web`. It keeps its graph in its own Postgres schema, which the storage container makes on its first start along with a bucket (made for every app; Data Atlas keeps nothing there), and it puts itself in Admin, Apps. It needs three new settings: `ATLAS_CLIENT_SECRET` (its sign-in), `ATLAS_DATABASE_PASSWORD` and `ATLAS_BUCKET_SECRET`. An upgrade from the Upgrade Centre makes them up for you. Upgrading by hand, add each to `.env` first (`openssl rand -hex 32`). See [atlas.md](atlas.md).

### Auspex ships with AUGUR

**From** augur@0.7.0

Auspex, which shows people where they are on AUGUR, who's there, and why they can or can't use each app, is now part of every release: a new container, `auspex`, and its frontend inside `web`. It keeps nothing of its own (no schema, no bucket) and puts itself in Admin, Apps on its first start. It needs one new setting, `AUSPEX_CLIENT_SECRET`, its sign-in: an upgrade from the Upgrade Centre makes it up for you. Upgrading by hand, add it to `.env` first (`openssl rand -hex 32`). See [auspex.md](auspex.md).

### Folio is called Artifacts

**From** augur@0.6.0

Folio now shows as **Artifacts** everywhere people see it, and opens straight into its own side menu, with **All apps** in the top bar as the way back. Its containers, `.env` names (`FOLIO_*`), schema, bucket and address (`/folio`) haven't changed, so there's nothing to do.

### Apps' frontends by version

**From** augur@0.6.0

Each version of an app's frontend is now kept on its own, at `/apps/<id>/<version>/`, so holding an app at an older version in Admin, Apps gives people that version's code as well as its manifest. The `storage` container makes a bucket for them (`augur-frontends`), the registry writes each version there as the app gives it, and the front door serves it from Garage. Folio gives its own on every start. This release changes `compose.yml` and Garage's `garage.toml`, so it's upgraded by hand, not from the Updates page. Before upgrading, add to `.env`:

- `FRONTENDS_BUCKET_SECRET` (`openssl rand -hex 32`): the registry's key to that bucket.

Then upgrade as usual. Without it nothing breaks: apps are served from where their manifests say, as before, and the registry's log says frontends aren't kept by version.

### Folio ships with AUGUR

**From** augur@0.4.0

Folio, the document libraries, is now part of every release: three new containers start (`folio`, its rendition worker `folio-worker`, and Folio's frontend inside `web`), and Folio puts itself in Admin, Apps on its first start. There's nothing to install or allow in Admin. This release changes `compose.yml`, so it's upgraded by hand, not from the Updates page. Before upgrading, add to `.env` (`openssl rand -hex 32` for each):

- `FOLIO_CLIENT_SECRET`: Folio's sign-in, which identity makes in Keycloak on the next start.
- `FOLIO_DATABASE_PASSWORD` and `FOLIO_BUCKET_SECRET`: its database login and its bucket's secret, which the `storage` container sets up.

Then upgrade as usual. The worker's image is large (about 2 GB: the models that read PDFs and Word files come with it, so nothing is fetched at run time). If you'd rather not offer Folio yet, turn it off in Admin, Apps, org-wide or floor by floor; it can be turned off but not removed. Its files are in the nightly backup with the other apps'.

### The Updates page

**From** augur@0.3.0

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

**From** augur@0.3.0

An optional container that runs an upgrade asked for with **Upgrade to …** in the Upgrade Centre. It checks every image is signed by this repository's Release workflow and is the one the release names, checks the settings it needs are set, takes a backup and test-restores it, pulls, then restarts AUGUR's Keycloak (waiting up to five minutes, as its first start on a new Keycloak minor migrates its database), reruns storage’s set-up and restarts identity, registry, events, models, the apps that ship with AUGUR (in the order `release/shipped-apps.json` lists them, which its image carries), gateway and web in turn, waiting for each to answer on its new version. A release with an image for something the server runs that this updater doesn't know is refused before anything changes, so no part is restarted without being checked; the page says which, and that release is upgraded by hand. Going back to a release from before AUGUR's own Keycloak image leaves Keycloak running; it takes Keycloak's own image the next time it's recreated. If one doesn't answer, it puts every part back on the release you were on, and the page says why and which backup was taken. With a breaking release between, it doesn't once any part has restarted on the new release, since the old one may not read what was migrated: the page says the server is partly on the new release, for you to decide ([upgrade-went-back.md](upgrade-went-back.md)). Each part gets up to 5 minutes, as services migrate their databases on their first start.

**What it holds to.** Before it changes anything it checks there are at least 2 GiB free in `infra/deploy` (the backup and the images land on that disk). Settings entered on the page only add: one that says what the server trusts (`SERVER_RING`, `IMAGE_SIGNER`, `PLATFORM_IMAGES`, `APP_SECRETS_KEY`, any `COMPOSE_*` and the like), one `.env` already has, or one that isn't a plain setting name is refused, even if the registry let it through. `.env` is written whole and renamed into place; where the updater can't keep the file's owner it writes it in place instead, keeping `.env.before-upgrade` beside it until the write checks out (if a message says that file holds the old settings, copy it over `.env` first). While an upgrade runs it keeps a note of it in `infra/deploy/.updater-upgrade.json` (the old `.env` among it, readable by the updater alone): if the updater or the server restarts partway, it goes back using it, with the same breaking-release rule. Don't delete it during an upgrade; it goes when the upgrade ends. Data a new release migrated stays as it is: [Going back](#going-back) says when you'd restore that backup.

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
4. `pc up -d`. The realm job makes the updater's sign-in, and an upgrade you ask for starts within half a minute.

Docker must be listening on `/var/run/docker.sock` (rootless Docker isn't). From then on, upgrade from the page, or by hand as above; both work. An upgrade waiting on the page while you upgrade by hand is best cancelled first.

To see what the watch after an upgrade would see right now, after an upgrade by hand say, run one look of it: `pc exec -T updater node dist/index.js check`. It signs in as the updater, reads AUGUR's calls at the gateway for the last 10 minutes and asks every part whether it's ready, then prints one line of JSON: `ok`, what it looked at, and each problem in a sentence. It exits 1 when there's any. Unlike the watch, it doesn't let sign-in miss once or wait for a part to come back.

### The app runner

**From** augur@0.6.0

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
7. **watch**: when an older version was serving, the new one must keep answering `/healthz` on its version for 5 minutes, checked every half minute. If it misses twice in a row, the runner registers the old version again, points the gateway back at it and stops the new one, and Admin → Apps says why. A version installed before the runner kept its manifest can't be gone back to by itself: the result says so, and you install it again by hand. A first install has nothing to go back to, so it isn't watched.
8. **retire**: the old version keeps running 10 more minutes for shells still holding the old manifest, then stops.

Admin → Apps lists, under the catalogue, the apps this repository has released that aren't installed, with **Install**; it says what each one asks for, and asks for your password again before anything is installed or removed. The registry reads the releases every 15 minutes, or at once with **Check for releases**: the same GitHub releases Updates reads, with the same token (`APP_FEED_URL` points it elsewhere, and `off` turns it off; it's off by itself when `RELEASE_FEED_URL` is a mirror).

How an installed app takes new releases, installing a newer one, going back and its history are on its page in the **Upgrade Centre** (`/upgrades`); Admin → Apps links there. In its settings:

- **Releases from**: **Production**, **Preview**, or **Dev builds** (every merge into `main`; not on a production server).
- **How new releases arrive**: **Automatic** (the default) installs a newer version by itself when it's a fix or a feature that asks for nothing new: no major version or 0.x minor, no new scopes, storage, kinds of floor or bigger uploads, an SDK range this AUGUR opens, and the same signer. Anything else waits under **Needs you** with why. **Ask first** makes every version wait for you, and **Hold** offers none. A version that failed to install isn't tried again by itself.

Admin → Apps still follows each job step by step on the installed app, keeps its developers and previews, and **Remove from the server** stops an app's containers; its data stays, and removing it from the catalogue too stops it being listed. Every install, update, removal and choice is in Activity.

Scripts can do the same through the registry (`/api/registry/v1/app-runner/…` in `contracts/registry.openapi.yaml`), with an `app-release.json` in place of a version from the feed:

```sh
curl -X POST https://<platform>/api/registry/v1/app-runner/jobs -H "authorization: Bearer <admin token>" \
  -H 'content-type: application/json' -d "{\"action\":\"install\",\"release\":$(cat app-release.json)}"
```

Pull requests that change an app can run as previews beside it, for the app's developers alone, each with scratch storage of its own: see [app-previews.md](app-previews.md).

Apps join the platform's network: the one the updater itself is on, usually `platform_default` (`APPS_NETWORK` in `.env` names another). So `pc down` can't remove that network while they run: stop them first with `docker compose -p augur-apps -f infra/deploy/apps/compose.yml down`. They restart by themselves with Docker, like the platform.

### Images from releases (the first `augur@` release)

**From** augur@0.2.0

The server stops building images and pulls the ones CI built and signed for the release instead. Once, before this upgrade:

1. Sign the server in to GitHub's container registry, as in [deploy.md](deploy.md#before-you-start) (a token with only **read:packages**).
2. Add `PLATFORM_VERSION=<the release>` to `.env`.
3. Upgrade with the steps above, `git checkout augur@<version>` rather than `git pull`.

The web container now listens on 8080 and every image runs as an unprivileged user; the new `tailscale/serve.json` already points at 8080. Your old locally built images can go with `docker image prune`.

### The model gateway

**From** augur@0.2.0

A new service, `models`, starts with the upgrade. Nothing changes until you want Agents: models are off, and stay off until an admin turns them on in Admin. To get it ready, add to `.env`:

- `MODELS_CLIENT_SECRET` (`openssl rand -hex 32`): its own sign-in, which identity makes in Keycloak on the next start. Without it no model calls are made, because none could be recorded.
- `MODEL_API_URL`, `MODEL_API_KEY` and `MODEL_NAME` for the model to use, or `MODEL_API_URL=stand-in` to try it with a model that doesn't think. See [Agents and models](agents.md).

Then upgrade as usual.

### Upload limits

**From** augur@0.3.0

Uploads now stream through the front door and the gateway without being held, and the gateway holds each app to its own limit: its manifest's `maxUpload`, or less where an admin lowered it in Admin, Apps. An app that doesn't say gets 10 MB at once, where everything got 50 MB before; the platform's own services keep their own limits. Nothing to add to `.env`. Upgrade as usual.

### Signed caller

**From** augur@0.3.0

The gateway now signs the person it passes on, and the platform's services believe only the signed caller (see [Signed caller](signed-caller.md)). Nothing to add to `.env`: the gateway makes its key when it starts and services fetch it from the gateway. Upgrade as usual. An app with its own service should add the service kit's `signedCallers` hook; until it does, it keeps working on the plain headers.

### App storage

**From** augur@0.3.0

Apps can now keep their own database schema and files (see [App storage](app-storage.md)). Two new containers start: `garage`, the object store, and `storage`, which sets up each app's storage and stops. Postgres moves to the same version with pgvector added (`pgvector/pgvector:0.8.0-pg16`), so the data carries over as it is. Before upgrading, add to `.env` (`openssl rand -hex 32` for each):

- `GARAGE_RPC_SECRET` and `GARAGE_ADMIN_TOKEN`.

Then upgrade as usual. No app uses storage yet, so `APP_STORAGE` can stay unset.

### Renamed to AUGUR

**From** augur@0.2.0

Nothing to do beyond the usual upgrade. The shell, page title and Admin say AUGUR, and packages are `@augur/*`. Your server's identifiers are left alone so nobody is signed out and no data moves: the Keycloak realm is still `platform`, the database and Compose project are still `platform`, the `.env` keys keep their `PLATFORM_` names, and your address stays `https://platform.<tailnet>.ts.net`.

Two optional touches:

- **Sign-in page title**: Keycloak only reads the realm file on first start, so your sign-in page still says "Platform". In the Keycloak console (`PLATFORM_URL/sso/admin`, with `KEYCLOAK_CONSOLE=open` in `.env`; see [deploy.md](deploy.md), Limits at the front door), open the `platform` realm, **Realm settings**, and set **Display name** to `AUGUR`.
- **Address**: to be at `https://augur.<tailnet>.ts.net`, set `TS_HOSTNAME=augur` and change `PLATFORM_URL` to match in `.env`, then in the Keycloak console update the **shell** client's redirect URIs and web origins to the new address before `pc up -d`. Everyone signs in again.

## Going back

**If an upgrade went back by itself, didn't install, or kept running after its watch saw a problem**, start from [upgrade-went-back.md](upgrade-went-back.md), a printable card for that night: four checks, and when a restore is worth it.

**Upgrade Centre → Go back** does this for you while no release between is breaking ([release-channels.md](release-channels.md#going-back)). By hand:

Code and data are separate, so going back is two steps, and the second is only needed if the new release migrated data:

1. **Code**: the same steps with the version you noted: `git checkout augur@<it>`, set `PLATFORM_VERSION` back, `pc up -d --remove-orphans`. The old images are still on the server, so nothing is downloaded.
2. **Data**, only if the older services fail on the newer tables: restore the backup you took before upgrading, as in [deploy.md](deploy.md#backups). Anything changed since that backup is lost, so check Admin → Activity first for what that is.

For one app rather than the whole platform, Admin → Apps can give the shell an earlier version of the app instead ([versioning.md](versioning.md#going-back-to-an-earlier-app-version)).
