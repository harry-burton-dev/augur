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

To change a running server's release or apps, use its Deployment page for now; `plan` shows when it has
drifted from its file. Reading the apps a server runs needs read access to its `infra/deploy/apps/` (owned by
user 1000): `plan` says when it can't, rather than guessing.
