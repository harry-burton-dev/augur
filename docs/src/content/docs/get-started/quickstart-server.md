---
title: "Quickstart: run AUGUR"
description: Install AUGUR on one Linux server and sign in, in about half an hour.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 2
---

By the end of this page AUGUR is running on a server of yours, and you're signed in as its first admin.

:::caution[Reaching it]
Today a deployment is reached through a private [Tailscale](https://tailscale.com) network (a **tailnet**):
only your own devices can open it, and Tailscale gives it an HTTPS address. Running AUGUR on your own network
or on the internet, without Tailscale, is planned.
:::

## Before you start

- A Linux server with **4 CPUs, 16 GB of memory and 200 GB of disk**, with Docker and its Compose plugin
  (`docker compose version` prints a version), curl and tar. Nothing else: no Node, no Tailscale.
- A Tailscale tailnet with **MagicDNS** and **HTTPS Certificates** turned on, and an **auth key** from
  Settings → Keys. A reusable, tagged key is easiest.
- A name for the server on your tailnet, such as `augur-staging`. AUGUR's address will be
  `https://<name>.<your tailnet>.ts.net`.

## 1. Get the release

Pick the newest `augur@<version>` release on GitHub, then on the server:

```sh
version=<version>
mkdir augur && cd augur
curl -fL "https://github.com/harry-burton-dev/augur/releases/download/augur%40$version/augur-deploy-$version.tar.gz" | tar -xz
sha256sum --quiet -c SHA256SUMS
cp infra/deploy/.env.example infra/deploy/.env && chmod 600 infra/deploy/.env
alias pc='docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env'
```

Every command from here runs in that folder and uses `pc`. [Install AUGUR, step 1](../../run/install/#1-get-the-release) shows how to check the bundle's signature too.

## 2. Fill in what only you know

Open `infra/deploy/.env` and set:

| Setting | What to put |
| --- | --- |
| `PLATFORM_VERSION` | The release you checked out, without `augur@`, such as `0.24.0` |
| `TS_HOSTNAME` | The server's name on your tailnet |
| `PLATFORM_URL` | `https://<TS_HOSTNAME>.<your tailnet>.ts.net`, with no slash at the end |
| `TS_AUTHKEY` | Your Tailscale auth key |
| `PLATFORM_ADMIN_USER`, `PLATFORM_ADMIN_PASSWORD` | You, the first person who can sign in, and a password for the first sign-in only |
| `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_FIRST_NAME`, `PLATFORM_ADMIN_LAST_NAME` | Your email address and name |

Every other setting has a default or is generated in the next step. The
[deployment settings](../../reference/schemas/settings/) reference lists them all.

## 3. Run the preflight

The preflight fills in every secret and checks that the server can take AUGUR:

```sh
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/augur" -w /augur node:22-alpine \
  node scripts/preflight.mjs --install --fill-secrets
```

Fix any line that starts with `✗` and run it again. When it ends with `✓ Ready`, copy
`KEYCLOAK_ADMIN_PASSWORD` from `.env` into your password manager: it's the way back in if every admin
loses their sign-in.

## 4. Start AUGUR

```sh
pc up -d
```

The first start takes a few minutes. `pc ps` shows every container as `healthy`, and the one-off jobs
(`storage`, `keycloak-config`, `backup-tools`) as exited with `0`.

## 5. Sign in

1. From a device on your tailnet, open your `PLATFORM_URL` and sign in with `PLATFORM_ADMIN_USER` and
   `PLATFORM_ADMIN_PASSWORD`. Choose your own password when asked.
2. Open **Deployment → Health**. Every part should say it's working. Backups take a few minutes to run for the
   first time.

AUGUR is running.

## What's next

- Set up email, the off-server backup copy and alerts: [Install AUGUR](../../run/install/#6-finish-setting-up)
  has each step.
- Add people in **Admin → People**.
- [Build your first app](../quickstart-app/).
