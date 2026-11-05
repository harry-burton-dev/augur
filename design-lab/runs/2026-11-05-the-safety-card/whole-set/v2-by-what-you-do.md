## Release notes that need you

The notes are grouped by what they ask of you, not by release. Read the
first two groups in full. Read the third only where the "if" fits your
server. Skim the fourth.

[open: the release each note came with. Only three are dated. You can't
tell from here which notes are new to your server, or whether you must
go through a release in between.]

By hand, make each secret with `openssl rand -hex 32` and add it to `.env`
before `pc up -d`. An upgrade from the Upgrade Centre makes the secrets up
for you.

## 1. Do this before you upgrade

**Each service signs in as itself.** Add `IDENTITY_CLIENT_SECRET`,
`REGISTRY_CLIENT_SECRET` and `EVENTS_CLIENT_SECRET`. Remove
`SERVICE_TOKEN`. Identity makes the matching Keycloak clients. An app with
its own service needs a sign-in from Admin, Apps (**Issue a new
sign-in**) as its `SERVICE_CLIENT_SECRET`.

**Mandate ships with AUGUR.** Add `MANDATE_CLIENT_SECRET` and
`MANDATE_DATABASE_PASSWORD` (required), and `MANDATE_BUCKET_SECRET` if you
want it (optional). It runs as a new container, `mandate`, and upgrades
with AUGUR. If the app runner installed it before, its data stays: the
same login, schema (`app_mandate`) and sign-in (`app-mandate`) are reused,
and the new updater stops the runner's own Mandate containers.

**Each service gets its own database login.** Add
`IDENTITY_DATABASE_PASSWORD`, `REGISTRY_DATABASE_PASSWORD`,
`EVENTS_DATABASE_PASSWORD`, `MODELS_DATABASE_PASSWORD` and
`KEYCLOAK_DATABASE_PASSWORD` (all required). The storage job makes the
logins on the first `up`.

**Server rings.** Add `SERVER_RING` (required): `preview` on the server
that runs what's on its way to production, `production` on every other.
A production server follows stable releases only, and runs no pull
requests' builds unless `ALLOW_PR_PREVIEWS=on`.

**Data Atlas ships with AUGUR.** Add `ATLAS_CLIENT_SECRET`,
`ATLAS_DATABASE_PASSWORD` and `ATLAS_BUCKET_SECRET`.

**Explorer ships with AUGUR.** Add `AUSPEX_CLIENT_SECRET`.

**App storage.** Add `GARAGE_RPC_SECRET` and `GARAGE_ADMIN_TOKEN`.
Postgres moves to `pgvector/pgvector:0.8.0-pg16`; data carries over.

**The read key**, while the repository is private: one GitHub token per
deployment that can only read packages, saved as
`infra/deploy/secrets/github-read-key` with `GITHUB_READ_USER` in `.env`.
It replaces `release-feed-token` and `image-pull-token`. Not needed with a
mirror. [cut: the GitHub set-up steps; see the guide.]

**The model gateway**, only if you want Agents: add `MODELS_CLIENT_SECRET`
and `MODEL_API_URL`, `MODEL_API_KEY`, `MODEL_NAME`. Without the secret no
model calls are made.

## 2. Take these releases by hand

**Keycloak 26.8 (augur@0.18.0). This can't be undone.** Keycloak changes
its database on its first start. Before you upgrade:
1. Take a backup and test it ("Before you start", step 4). Keep the file
   name: `infra/deploy/backups/platform-<date>.sql.gz`.
2. Check `KEYCLOAK_ADMIN_PASSWORD` in `.env` is still Keycloak's master
   admin password; if you changed it in the console, put the current one
   there.
3. Upgrade by hand, not in an upgrade window. The first start takes a
   minute or two longer.
4. Check: `pc logs keycloak-config` ends with "The platform realm is up to
   date", and `pc ps -a keycloak-config` shows it exited with 0.
   [open: what to do if not.] If identity's log says it lacks rights,
   `pc up -d keycloak-config identity`.

Going back is a restore of that backup; anything changed since is lost.
Set `PLATFORM_VERSION` back, check out that release's deploy files, then:
```sh
pc stop tailscale web gateway identity registry events keycloak backup
gunzip -c infra/deploy/backups/platform-<date>.sql.gz | pc exec -T postgres psql -U platform -d postgres
pc up -d --remove-orphans
```
For people: new passwords need 15 characters or more and can't be the
username, the email or a known breached password; nobody must change the
one they have. Admins and deployment admins set up a code app at next
sign-in unless they use a passkey. Sessions end after 8 hours unused or
10 hours at most.

**Apps' frontends by version.** It changes `compose.yml` and
`garage.toml`. Add `FRONTENDS_BUCKET_SECRET` first; without it nothing
breaks, but frontends aren't kept by version.

**Artifacts ships with AUGUR.** It changes `compose.yml`. Add
`FOLIO_CLIENT_SECRET`, `FOLIO_DATABASE_PASSWORD` and `FOLIO_BUCKET_SECRET`
first. The rendition worker's image is about 2 GB.

**Images from releases (the first `augur@` release).** Once: sign the
server in to GitHub's container registry (a **read:packages** token), add
`PLATFORM_VERSION=<the release>`, and use `git checkout augur@<version>`,
not `git pull`.

## 3. Check one thing, if it fits your server

**Don't skip the release with the repository's new name.** A server that
doesn't run it refuses everything released after it. [open: the note
says to run it "before the rename", which happened on 5 November 2026.]
Images and the feed stay at `ghcr.io/harry-burton-dev/im-platform`.

**If your server has less than 8 GB of memory,** set `KEYCLOAK_MEM_LIMIT`
and `FOLIO_WORKER_MEM_LIMIT` lower first. New limits: Keycloak 2 GB, the
rendition worker 4 GB, observability 2 GB. Logs are capped at three files
of 10 MB; bigger ones go when containers are recreated.

**If one of these is already in `.env`,** check it: `FEED_SIGNER`,
`IMAGE_SIGNER`, `AUGUR_DEV_SIGNER`, `DOMAIN_EVENTS_KEEP_DAYS`,
`OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_TRACES_SAMPLER`,
`OTEL_TRACES_SAMPLER_ARG`. It takes effect at the upgrade.

**Set `DEPLOYMENT_TIME_ZONE`** (such as `Europe/London`). Without it,
upgrade windows are in UTC.

**If someone other than the first admin upgrades,** give them
`deployment-admin` in Admin, People. Without it the Upgrade Centre
refuses them and names the role. Installing or changing apps needs it too.

**If an app is off for the organisation and on for some teams,** its
service must now name the team's floor. A refused call shows in
`pc logs <app>` as a 403.

**If you use the old `release-feed-token`,** it shows as not signed:
swap it for the read key. `FEED_SIGNER` is only for a fork.

**If an app has its own service,** it should add the service kit's
`signedCallers` hook; until then it works on plain headers.

## 4. Nothing to do: worth knowing

- **AUGUR won't upgrade by itself** until an admin has upgraded it once
  on this server from the Upgrade Centre and it finished. After that, a
  production server installs patch releases by itself on Sunday at
  02:00 for two hours (in `DEPLOYMENT_TIME_ZONE`). A major, a 0.x minor,
  or one needing a setting only you can give waits for an admin.
- **Each upgrade is watched for 10 minutes** and goes back by itself if
  sign-in fails twice, a part stops answering, or more than 5% of at
  least 20 calls fail.
- **Names:** people see Explorer and Artifacts. Containers, `.env` names
  and addresses (`/auspex`, `/folio`) are unchanged. The shell says AUGUR;
  your server's `platform` identifiers stay.
- **Artifacts, Explorer and Data Atlas come from their own repositories**
  (augur@0.17.0). Nothing changes on the server. Going back to 0.16.x is
  the code step; past 0.18.0, the Keycloak restore first.
- **Sign-in pages** use AUGUR's look; optional `ORG_LOGO_URL`, `REALM_LANGUAGES`.
- **Uploads:** an app that doesn't set `maxUpload` gets 10 MB, not 50 MB.
- **Keep `KEYCLOAK_ADMIN_PASSWORD` in `.env`** though identity no longer
  reads it: it's the way back in if every deployment admin loses their code.
- **Optional set-ups:** the updater, the app runner (`APP_SECRETS_KEY`;
  never change it once apps are installed), reporting to Backstage,
  sample data (`SEED_ALLOWED=true`), a halted-release test on dev or
  preview, a new address (everyone signs in again). [cut: their steps.]
- **The Updates page** was replaced by the Upgrade Centre.
