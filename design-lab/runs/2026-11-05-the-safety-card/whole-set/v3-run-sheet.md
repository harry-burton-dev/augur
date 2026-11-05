## Release notes that need you

This is one run sheet for an upgrade across many releases. It gathers
every action from the release notes into the order you do them. Work down
it with the server open. Steps marked **If** are only for some servers.

**What these notes don't tell you** (read this first):
- [open: which releases each note came with. Only three are dated: the
  apps from their own repositories (augur@0.17.0), Keycloak 26.8
  (augur@0.18.0), and the first `augur@` release. So you can't tell from
  here which notes are new to your server. This sheet assumes all of them
  are.]
- [open: whether you can upgrade straight from your release to the
  current one, or must go through one in between. These notes don't say.]

"By hand" means the guide's upgrade steps, not the Upgrade Centre's
updater. Make each secret with `openssl rand -hex 32`.

---

### 1. Before you upgrade

**1.1 Take a backup and test it** ("Before you start", step 4). Write down
its file name: `infra/deploy/backups/platform-<date>.sql.gz`. Keycloak
26.8 can't be undone without it (see 5).

**1.2 Check `KEYCLOAK_ADMIN_PASSWORD`** in `.env` is still Keycloak's
master admin password. If you changed it in the Keycloak console, put the
current one in `.env`. From Keycloak 26.8 the realm job signs in with it
on every `up`. Keep it in `.env` after that too: it is the way back in if
every deployment admin loses their one-time code.

**1.3 Add these settings to `.env`.** The Upgrade Centre's updater makes
the secrets up for you; by hand, you add them, before `pc up -d`.

| Setting | For | Required? |
|---|---|---|
| `IDENTITY_CLIENT_SECRET`, `REGISTRY_CLIENT_SECRET`, `EVENTS_CLIENT_SECRET` | each service signs in as itself | yes |
| `MANDATE_CLIENT_SECRET`, `MANDATE_DATABASE_PASSWORD` | Mandate ships with AUGUR | yes |
| `MANDATE_BUCKET_SECRET` | Mandate | optional |
| `IDENTITY_DATABASE_PASSWORD`, `REGISTRY_DATABASE_PASSWORD`, `EVENTS_DATABASE_PASSWORD`, `MODELS_DATABASE_PASSWORD`, `KEYCLOAK_DATABASE_PASSWORD` | each service's own database login | yes |
| `SERVER_RING` (not a secret: `production`, or `preview` on the server that runs what's on its way to production) | server rings | yes |
| `ATLAS_CLIENT_SECRET`, `ATLAS_DATABASE_PASSWORD`, `ATLAS_BUCKET_SECRET` | Data Atlas ships with AUGUR | yes [open: the note says "needs"] |
| `AUSPEX_CLIENT_SECRET` | Explorer ships with AUGUR | yes [open: the note says "needs"] |
| `FOLIO_CLIENT_SECRET`, `FOLIO_DATABASE_PASSWORD`, `FOLIO_BUCKET_SECRET` | Artifacts ships with AUGUR | yes [open: the note says "add"] |
| `FRONTENDS_BUCKET_SECRET` | apps' frontends kept by version | no: without it nothing breaks |
| `GARAGE_RPC_SECRET`, `GARAGE_ADMIN_TOKEN` | app storage | yes [open: the note says "add"] |
| `DEPLOYMENT_TIME_ZONE` (such as `Europe/London`) | upgrade windows | no: without it windows are in UTC |
| `MODELS_CLIENT_SECRET`, and `MODEL_API_URL`, `MODEL_API_KEY`, `MODEL_NAME` (or `MODEL_API_URL=stand-in`) | the model gateway | only for Agents: without the secret no model calls are made |

**1.4 Remove `SERVICE_TOKEN`** from `.env`.

**1.5 If your server has less than 8 GB of memory**, set
`KEYCLOAK_MEM_LIMIT` and `FOLIO_WORKER_MEM_LIMIT` lower in `.env`
(deploy.md, "Logs, memory and health"). New limits: Keycloak 2 GB,
Artifacts' rendition worker 4 GB, the observability stack 2 GB.
[open: what happens if you don't.]

**1.6 If any of these is already in `.env`**, check it says what you
want: `FEED_SIGNER`, `IMAGE_SIGNER`, `AUGUR_DEV_SIGNER`,
`DOMAIN_EVENTS_KEEP_DAYS`, `OTEL_EXPORTER_OTLP_HEADERS`,
`OTEL_TRACES_SAMPLER`, `OTEL_TRACES_SAMPLER_ARG`. They didn't reach their
services before; from the upgrade they do. Leave `FEED_SIGNER` unset
unless you publish AUGUR from a fork.

**1.7 If your server still builds its own images** (before the first
`augur@` release): sign the server in to GitHub's container registry with
a **read:packages** token (deploy.md), add `PLATFORM_VERSION=<the release>`
to `.env`, and use `git checkout augur@<version>`, not `git pull`.

**1.8 While the repository is private, set up a read key** (one GitHub
token per deployment that can only read packages). It replaces
`release-feed-token` and `image-pull-token`, which work until you swap
them; the old `release-feed-token` path shows as not signed. Steps: see
"The read key" in 8. Not needed if you pull from a mirror.

**1.9 Check who will upgrade.** Upgrading needs the `deployment-admin`
role, not just `admin`. The first admin (`PLATFORM_ADMIN_USER`) has it.
Anyone else needs it in Admin, People, or the Upgrade Centre refuses them
and names the role.

### 2. Releases you must not skip or leave to a window

| Release | Why | What to do |
|---|---|---|
| The one that comes with the repository's new name (`im-platform` → `augur`, 5 November 2026) | **Skip it and the server refuses everything released after it.** From it, the updater and registry take releases signed under either name | Run it. [open: the note says "before the rename", which has already happened] |
| Keycloak 26.8 (augur@0.18.0) | Its database change can't be undone | By hand, not in an upgrade window, after 1.1 and 1.2 |
| Apps' frontends by version | It changes `compose.yml` and Garage's `garage.toml` | By hand |
| Artifacts ships with AUGUR | It changes `compose.yml` | By hand |

[open: if you are several releases behind, whether each must be taken in turn.]

### 3. Upgrade
Upgrade as usual, by hand. On the Keycloak 26.8 release, Keycloak's first
start takes a minute or two longer while it migrates. A new container,
`keycloak-config`, runs once Keycloak is up, sets up the realm and stops;
identity starts after it. Containers are recreated with log and memory
limits; existing logs bigger than the cap (three files of 10 MB) are lost.

### 4. Check
- `pc logs keycloak-config` ends with "The platform realm is up to date"
  and lists what it changed.
- `pc ps -a keycloak-config` shows it exited with 0.
- [open: what to do if either doesn't.]
- **If** identity's log says it lacks rights: `pc up -d keycloak-config identity`.
- **If** you turned an app off for the organisation and on for some teams:
  a call its service makes with no floor is now checked on the
  organisation's floor and refused. It shows in `pc logs <app>` as a 403
  saying it isn't granted the scope. Its service must name the team's floor.

### 5. If you need to go back

| What came in | Going back needs |
|---|---|
| Keycloak 26.8 (augur@0.18.0) | **A restore of the backup from 1.1.** Anything changed since is lost. Set `PLATFORM_VERSION` back, check out that release's deploy files, then the commands below |
| Apps from their own repositories (augur@0.17.0) | The code step: check out `augur@0.16.1`, set `PLATFORM_VERSION=0.16.1`, `pc up -d --remove-orphans`. No restore, unless you go back past 0.18.0 |
| Each service's own database login | The code step. The older release connects as `platform` again |
| Mandate ships with AUGUR | Mandate's data stays, and Admin → Apps lists it at its old version, but nothing runs it. Install that version again there |
| AUGUR's sign-in look | Keycloak's own look returns; its log says it can't find the `augur` theme. Harmless |
| Anything else | [open: the notes don't say] |

```sh
pc stop tailscale web gateway identity registry events keycloak backup
gunzip -c infra/deploy/backups/platform-<date>.sql.gz | pc exec -T postgres psql -U platform -d postgres
pc up -d --remove-orphans
```

### 6. After the upgrade
- **AUGUR won't upgrade by itself yet.** It waits until an admin has
  upgraded it once on this server from the Upgrade Centre and it
  finished. Until then **Needs you** says so, with **Upgrade**.
- **After that, by default,** a production server installs AUGUR's patch
  releases by itself on Sunday at 02:00, for two hours, in the
  deployment's time zone (UTC without `DEPLOYMENT_TIME_ZONE`). A preview
  server or the workbench takes them at any time. A major release, a 0.x
  minor, one that needs a setting only you can give, or one an earlier try
  didn't finish always waits for an admin. To start every upgrade
  yourself, set AUGUR's policy to Ask first in the Upgrade Centre.
- **Each upgrade is watched for 10 minutes.** If sign-in fails twice, a
  part stops answering or more than 5% of at least 20 calls fail, it goes
  back by itself (not across a breaking release). On a quiet server a
  light watch goes on for up to a day, and reports to **Needs you**
  instead of going back.
- **Apps with their own service:** in Admin, Apps, **Issue a new sign-in**
  and use it as the app's `SERVICE_CLIENT_SECRET`. They should also add
  the service kit's `signedCallers` hook (until then they work on plain
  headers). An app that doesn't set `maxUpload` now gets 10 MB, not 50 MB.
- **Once the read key works,** remove `release-feed-token`,
  `image-pull-token` and `IMAGE_PULL_USER`.
- **Tell people:** new passwords need 15 characters or more, and can't be
  the username, the email or a known breached password (nobody has to
  change the one they have). Admins and deployment admins set up a code
  app at their next sign-in, unless they use a passkey. Sessions end after
  8 hours unused or 10 hours at most. Explorer and Artifacts are the names
  people see; their containers, `.env` names and addresses (`/auspex`,
  `/folio`) are unchanged.

### 7. Optional set-up (nothing happens until you do it)

| What | How to start |
|---|---|
| The updater (runs upgrades from the Upgrade Centre) | `COMPOSE_PROFILES=updater`, `PLATFORM_DIR=<full path of infra/deploy>`, `UPDATER_CLIENT_SECRET` in `.env`; user 1000 can write `infra/deploy`; the read key; `pc up -d`. Docker on `/var/run/docker.sock` |
| The app runner (apps that don't ship with AUGUR) | With the updater: `APP_SECRETS_KEY` in `.env`, `pc up -d`. Never change it once apps are installed |
| Reporting to Backstage | `DEPLOYMENT_ID` and `PORTAL_URL` in `.env`, then the key on the Backstage entry (Upgrade Centre, Reporting) |
| Sample data | `SEED_ALLOWED=true`, and import the `platform-cli` client in the Keycloak console |
| A logo and more languages on sign-in | `ORG_LOGO_URL`, `REALM_LANGUAGES` (say `en,de,fr`) |
| AUGUR as the sign-in page title | Keycloak console, `platform` realm, **Realm settings**, **Display name** `AUGUR` |
| The address `https://augur.<tailnet>.ts.net` | `TS_HOSTNAME=augur`, `PLATFORM_URL` to match, the **shell** client's redirect URIs and web origins. **Everyone signs in again** |
| Pull-request builds on production | `ALLOW_PR_PREVIEWS=on` |
| Installing a halted release to test going back | dev or preview servers only, **Install … for a test** in the Upgrade Centre |

### 8. The read key, step by step

**Once, in GitHub:**
1. Sign up a separate account for deployments (such as `augur-deploy`,
   with its own email), and turn on two-factor authentication.
2. As the repository's owner, give it **Read** on each package
   (**Packages** on your profile, each package, **Package settings →
   Manage access → Invite**). Don't add it to the repository itself.

**For each deployment:**
1. As that account, make a classic token named after the deployment, with
   only **read:packages** and an expiry in your calendar.
2. On the server:
   ```sh
   mkdir -p infra/deploy/secrets
   printf '%s' '<the token>' > infra/deploy/secrets/github-read-key
   sudo chown 1000 infra/deploy/secrets/github-read-key && chmod 600 infra/deploy/secrets/github-read-key
   echo '<the token>' | docker login ghcr.io -u <the account> --password-stdin
   ```
   and in `.env`, `GITHUB_READ_USER=<the account>`.
3. `pc up -d registry updater`, then **Check now** in the Upgrade Centre.
   It lists releases, or says why the key was refused.

To take access away, delete that deployment's token.
