---
title: Run deployments from files
description: Describe each AUGUR server in a file, install new ones from it, and see how each differs and how it is doing.
status: beta
checkedAgainst: 0.26.1
sidebar:
  order: 14
---

When you run more than one AUGUR server, describe each one in a file and use `augurctl` to install it,
compare it with its file and check how it's doing. It reaches each server over ssh with that server's own
Docker, and never prints a secret.

## What you need

- A checkout of AUGUR's repository, with augurctl's own packages installed: `pnpm install --filter .` in it. That
  needs no package token, unlike a full `pnpm install`.
- `ssh` to each server, as a user who can run Docker there.
- [sops](https://getsops.io) and an [age](https://age-encryption.org) key, if the files keep their secrets
  beside them.
- [cosign](https://docs.sigstore.dev/cosign/system_config/installation/), for `up`: it checks each release's deploy
  bundle here before sending it to the server.
- A folder of deployment files, one per server: `deployments/<name>.yaml`. Keep it in a private repository
  of your own, with the secrets files next to it.

## A deployment file

```yaml
schema: augur.deployment/v1
name: staging-1            # the file's name
ring: preview              # SERVER_RING: dev, preview or production
release: 0.27.0            # PLATFORM_VERSION, or follow when the server's updater keeps it on its ring
host:
  ssh: augur@staging-1     # or local, for this machine
  dir: /opt/augur          # the folder that holds infra/deploy
settings:                  # the .env values that aren't secret
  PLATFORM_URL: https://staging-1.example.org
  TS_HOSTNAME: staging-1
secrets: ../secrets/staging-1.sops.env
apps:
  - id: folio
    version: 0.9.0
```

`scripts/augurctl/deployment.schema.json` is the file's schema. A setting must be one AUGUR knows
([Settings](../settings/)), and a secret goes in the secrets file, never in `settings`. A key AUGUR doesn't know,
such as one left over from an older release, counts as a secret when its name ends in `_SECRET`, `_PASSWORD`,
`_TOKEN`, `_KEY` or `_AUTHKEY`.

## Commands

Run each from the folder that holds `deployments/`, or pass `--dir <folder>`. From inside AUGUR's checkout it is
`pnpm augurctl <command>`. From anywhere else, such as your fleet's own repository, call it with node, so no
other pnpm version is picked:

```sh
node <augur>/scripts/augurctl/augurctl.mjs plan staging-1 --dir deployments
```


| Command | What it does |
| --- | --- |
| `pnpm augurctl check` | Checks every file against the schema and AUGUR's settings. |
| `pnpm augurctl init <name>` | Makes the secrets file: a random value for each secret AUGUR can make up, encrypted with sops for the keys your `.sops.yaml` names. Add the ones only you know (`TS_AUTHKEY`, `PLATFORM_ADMIN_PASSWORD`) with `sops <file>`. It never replaces a secrets file. |
| `pnpm augurctl plan <name>` | Lists how the server differs from its file: its settings, its release and ring, its apps, and, for each secret, only whether it matches. It reads the server's `.env` over ssh to compare, and keeps it in memory only. It exits 0 when nothing differs and 2 when something does. |
| `pnpm augurctl status [<name>...]` | Every server, or the ones named, one line each: its release, what's running and what's unwell, the last backup, the last upgrade and why it went back if it did, and its apps. It exits 1 when there are no deployment files, or when any server can't be read. |
| `pnpm augurctl up <name>` | Installs a new server: fetches the release's [deploy bundle](../install/#1-get-the-release) and checks its signature here, sends it to the server and checks its sums there, makes `.env` from the file and its secrets, and starts AUGUR once the preflight passes. If the preflight stops it, fix what it says and run `up` again. It stops if the server has a `.env` already. |

## The fleet's client

A program changes a running server through the fleet's machine client, the Keycloak client `platform-fleet`
(ADR 0100). Give the server its own secret as `FLEET_CLIENT_SECRET` in `.env`, keep it in the server's
secrets file, and restart identity's set-up (`pc up -d`) to make the client. With it, a caller may, with nobody
signed in:

- upgrade AUGUR to the release the Deployment page offers next;
- set how AUGUR or an app takes new releases (its desired state);
- install an app release the app feed lists, or remove an app;
- read the overview, the installed apps and the app runner's jobs, to follow what it asked for.

It may do nothing else. What it installs depends on the server's ring: a dev or preview server takes any release,
and a production server only one promoted to stable that its publisher hasn't halted. Every change is recorded
under `platform-fleet` and shows on the Deployment page like anyone's. A leaked secret can change what runs on
that one server, within its ring: change the secret in `.env` and run `pc up -d` again to stop the old one
working. Taking `FLEET_CLIENT_SECRET` out of `.env` doesn't delete the client: delete `platform-fleet` in
Keycloak's admin console too.

To change a running server's release or apps, use its Deployment page for now; `plan` shows when it has
drifted from its file. Reading the apps a server runs needs read access to its `infra/deploy/apps/` (owned by
user 1000): `plan` says when it can't, rather than guessing.
