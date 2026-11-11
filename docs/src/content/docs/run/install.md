---
title: Install AUGUR
description: Install AUGUR on an empty Linux server, private, backed up and reporting, from start to finish.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 1
---

Follow this page from top to bottom on an empty server, and AUGUR is running, backed up and reporting to
Backstage, with no step outside it. The [quickstart](../../get-started/quickstart-server/) is the short
version; this is the whole procedure.

Everything runs in Docker on one machine. The server runs images built and signed for an AUGUR release,
pulled from GitHub's container registry (`ghcr.io/harry-burton-dev/im-platform/<part>:<version>`). Nothing
is built on the server, and every container runs as an unprivileged user.

```
your laptop ──tailnet──▶ tailscale ──▶ web (nginx) ─┬─ /            the shell and app bundles
                         (HTTPS)                    ├─ /api/  ──▶ gateway ──▶ identity, registry, events ──▶ postgres
                                                    └─ /sso/  ──▶ keycloak (sign-in) ──────────────────────▶ postgres
```

:::caution[Reaching it]
Today a deployment is reached only through a private [Tailscale](https://tailscale.com) network, a
**tailnet**: there are no open ports, and Tailscale gives it an HTTPS address only your devices can reach.
Installing on your own network without Tailscale is [planned](../../planned/).
:::

## Before you start

Have these ready. The preflight (step 3) checks what it can of them before anything starts.

1. **A server**: Linux, with 4 CPUs, 16 GB of memory and 200 GB of disk for a staging or small production
   server (AUGUR's memory limits are sized for 16 GB). It needs Docker with the Compose plugin
   (`docker compose version` prints a version) and git, and nothing else: no Node, no Tailscale.
2. **Your tailnet.** In the [Tailscale admin console](https://login.tailscale.com/admin):
   - **DNS**: turn on MagicDNS and **HTTPS Certificates**. Note your tailnet name, for example
     `tail1234.ts.net`.
   - **Settings → Keys**: generate an auth key. A reusable key is easiest. If your policy uses tags, tag it
     (say `tag:augur`): a tagged machine's key never expires.
   - **A name for the machine**: `TS_HOSTNAME` in `.env`, `platform` unless you set it, and not already used
     on the tailnet. Give each server its own, such as `augur-staging`. AUGUR's address is then
     `https://<TS_HOSTNAME>.<tailnet name>`.

   The server doesn't need Tailscale installed itself. The `tailscale` container joins your tailnet as its
   own machine, named after `TS_HOSTNAME`.
3. **Its entry in Backstage**, if it reports there (a staging server must): the deployment's name in
   Backstage's `org/deployments.yaml`, and Backstage's address. Step 6 joins them up.
4. **A read key**, only if AUGUR's packages aren't public to you: one GitHub token with only
   **read:packages**. After step 1, save it as `infra/deploy/secrets/github-read-key` (owned by user 1000),
   set `GITHUB_READ_USER` in `.env`, and sign Docker in with it once (`docker login ghcr.io`). The
   [upgrade guide](https://github.com/harry-burton-dev/augur/blob/main/docs/upgrade.md#the-read-key) has the
   steps. A server that can't reach GitHub runs releases from your own registry instead
   ([Mirroring releases](https://github.com/harry-burton-dev/augur/blob/main/docs/mirror.md)).
5. **For later, but before anyone real works on it**: the organisation's [email relay](../email/) and a
   bucket off the server for [backups](../backups/#off-server-copy). The off-server copy holds `.env` and
   `secrets/` too, encrypted. Keep its `OFFSITE_*` settings in your password manager: they are what gets a
   [lost server](../restore-a-lost-server/) back.

## 1. Get the release

```sh
git clone https://github.com/harry-burton-dev/augur.git augur && cd augur
git checkout augur@<version>     # the release you'll run: the newest augur@ under Releases
cp infra/deploy/.env.example infra/deploy/.env && chmod 600 infra/deploy/.env
alias pc='docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env'
```

Every command after this runs from the checkout and uses `pc`; put the alias in your shell's profile. The
folder's name doesn't matter: the Compose project is always called `platform`.

## 2. Fill in the settings

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

The preflight (step 3) fills in these 21 secrets, each with 64 random hex characters: `POSTGRES_PASSWORD`, `KEYCLOAK_ADMIN_PASSWORD`, `IDENTITY_DATABASE_PASSWORD`, `REGISTRY_DATABASE_PASSWORD`, `EVENTS_DATABASE_PASSWORD`, `MODELS_DATABASE_PASSWORD`, `PERMISSIONS_DATABASE_PASSWORD`, `KNOWLEDGE_DATABASE_PASSWORD`, `KEYCLOAK_DATABASE_PASSWORD`, `GARAGE_RPC_SECRET`, `GARAGE_ADMIN_TOKEN`, `FRONTENDS_BUCKET_SECRET`, `IDENTITY_CLIENT_SECRET`, `REGISTRY_CLIENT_SECRET`, `EVENTS_CLIENT_SECRET`, `MODELS_CLIENT_SECRET`, `KNOWLEDGE_CLIENT_SECRET`, `PERMISSIONS_CLIENT_SECRET`, `GRAFANA_ADMIN_PASSWORD`, `ALERT_WEBHOOK_TOKEN`, `OPENFGA_TOKEN`.
<!-- /settings -->

- `PLATFORM_VERSION` is the release you checked out, without `augur@`, for example `0.24.0`.
- `PLATFORM_URL` is `https://<TS_HOSTNAME>.<tailnet name>`, for example `https://platform.tail1234.ts.net`,
  with no trailing slash.
- `PLATFORM_ADMIN_*` is you: the first person who can sign in, as an admin and deployment admin. The password
  is only for the first sign-in, when you're asked to choose a new one. `PLATFORM_ADMIN_DEPARTMENT` is your
  department (`Administration` unless you change it). People see its name, so give it the one your
  organisation uses.
- `SERVER_RING` says what kind of server this is: `production` (the default), `preview` for a
  [staging server](../staging/), or `dev` for a workbench AUGUR is built on.
- `ORG_NAME`, optional: what the organisation is called at first start (`Organisation` unless you set it).
  After that an admin changes it in Admin → Organisation ([Settings and secrets](../settings/#organisation-settings)),
  and `ORG_NAME` is no longer read. The sign-in pages show it only until the realm job has applied the name
  kept in Admin.
- `ORG_PRODUCT_NAME`, optional: what people see the product called, in the browser tab, on the sign-in pages
  and in emails (`AUGUR` unless you set it, for example `Example, built on AUGUR`). It takes effect at the next
  `pc up -d`.
- `DESKTOP_APP`, optional: the app drawn on the desktop, under the app bar and over the background, by its id
  (`home` unless you set it). Set it empty for a bare desktop. The logo button at the start of the app bar
  goes there. It takes effect at the next `pc up -d`.

The secrets are made for you in step 3. Each is a long random string, different from every other, and
Compose refuses to start without the required ones. To set one yourself instead, `openssl rand -hex 32` makes
one.

**Database logins.** `POSTGRES_PASSWORD` is Postgres's admin login, used only by the storage job and
backups. Each of AUGUR's services and Keycloak connects with its own login, which owns only its own schema
(Keycloak: its own database) and can't read anyone else's. The storage job makes them from the
`*_DATABASE_PASSWORD` values on every `up`, as it does apps' logins, so changing one in `.env` and running
`pc up -d` changes it.

## 3. Run the preflight

The preflight fills in the secrets and checks the server can take AUGUR, before anything starts. It needs
nothing but Docker:

```sh
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/augur" -w /augur node:22-alpine node scripts/preflight.mjs --install --fill-secrets
```

`--fill-secrets` writes a random value into each blank secret in `.env` and never changes one that's set.
Then it checks, one line each:

- **Release**: the checkout is the release `PLATFORM_VERSION` names.
- **Settings**: every required setting is set, and each value fits what it must be: `PLATFORM_URL` an https
  address with no path, `TS_AUTHKEY` a Tailscale key, `PLATFORM_ADMIN_EMAIL` an email address, bucket keys
  64 hex characters, passwords at least 16 characters, `SERVER_RING` one of its three. A name in `.env` that
  no setting has is pointed out, in case it's a typo.
- **Secrets**: no two are the same.
- **Address**: `PLATFORM_URL` names the machine `TS_HOSTNAME` makes.
- **Ring**: what kind of server this is, and whether sample data is allowed (`SEED_ALLOWED`).
- **Read key**: `GITHUB_READ_USER` and `infra/deploy/secrets/github-read-key` are both there, or neither.
- **`.env`** can't be read by other users on the server.
- **Memory and disk**, against the size above.
- And, for reading, what isn't set up yet: reporting to Backstage, the off-server copy, email.

A line starting `✗` stops the install: fix it and run the command again (without `--fill-secrets` it changes
nothing). Lines starting `-` are for reading. When it ends `✓ Ready`, go on.

`KEYCLOAK_ADMIN_PASSWORD`, which it made, is Keycloak's own admin: the
[way back in](../settings/#if-every-deployment-admin-is-locked-out) if every deployment admin loses their
sign-in. Copy it from `.env` into your password manager now.

## 4. Start AUGUR

```sh
pc up -d
```

The first pull takes a minute or two. Keycloak needs about a minute to start, and Tailscale fetches its
certificate on the first request, so the first page can be slow. `pc ps` shows each container `healthy` when
it's ready, and the jobs that run once (`storage`, `keycloak-config`, `backup-tools`, `knowledge-migrate`) as
exited with `0`. `pc logs <service>` says what's wrong with one that isn't.

## 5. Sign in and check it

1. From any device on your tailnet, open `PLATFORM_URL` and sign in as `PLATFORM_ADMIN_USER` with
   `PLATFORM_ADMIN_PASSWORD`. Choose your own password. A passkey is on offer in Account → Sign-in and
   security, and Admin → Organisation can ask everyone for a second step.
2. Open **Deployment → Health**. Every part should say it's working. On **Deployment → Backups**, the first backup, the first
   restore test and the first point-in-time test run when the backup container starts, so give it a few
   minutes; a part that isn't working says why.
3. In the Tailscale admin console's **Machines**, the machine named after `TS_HOSTNAME` is there. If its key
   wasn't tagged, open its menu and choose **Disable key expiry**, or it leaves your tailnet when the key
   expires (180 days by default).

## 6. Finish setting up

1. **Report to Backstage**
   ([upgrade guide](https://github.com/harry-burton-dev/augur/blob/main/docs/upgrade.md#reporting-to-backstage)):
   set `DEPLOYMENT_ID` to the deployment's name in `org/deployments.yaml` and `PORTAL_URL` to Backstage's
   address, then `pc up -d registry`. Copy the deployment's key (**Copy key** in Deployment's Reporting
   section) into the entry's `augur.dev/report-key` annotation. Within 15 minutes Backstage shows the
   deployment, and from then it raises the alarm when a report is more than 30 minutes late, so it notices
   when the whole server is down.
2. **Prove the alert path**
   ([Observability](https://github.com/harry-burton-dev/augur/blob/main/docs/observability.md#alerts)): open
   Grafana through `ssh -L 3001:127.0.0.1:3001 <server>` at `http://localhost:3001`, sign in as `admin` with
   `GRAFANA_ADMIN_PASSWORD` from `.env`, and under **Alerting → Contact points**, open **AUGUR notices** and
   press **Test**. A notice reaches you, and every deployment admin, in AUGUR within a minute.
3. **[Email](../email/)**, so people can reset a forgotten password.
4. **The [off-server copy](../backups/#off-server-copy)**, so a lost server doesn't lose its backups. Until
   then, Deployment → Backups says backups are kept on this server only.
5. **Turn on the updater**, if this server should upgrade itself
   ([upgrade guide](https://github.com/harry-burton-dev/augur/blob/main/docs/upgrade.md#the-updater)).

Run the preflight once more (without `--fill-secrets`): what's left under `-` is what you chose not to set
up. Write down where this deployment's bucket is, its Backstage name and its ring with its other records.

## Check it worked

- `pc ps` shows every long-running container `healthy`.
- Deployment → Health says every part is working, and Deployment → Backups shows a backup and a restore test.
- The preflight ends `✓ Ready` with nothing under `-` you meant to set up.

If something isn't right, see [If something's wrong](../troubleshooting/).
