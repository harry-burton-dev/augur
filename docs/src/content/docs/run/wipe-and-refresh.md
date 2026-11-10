---
title: Wipe and refresh
description: Take a dev or staging server back to empty, and keep its settings and its address.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 13
---

Use this to take a dev or [staging](../staging/) server back to empty, on the same release or a newer one,
and keep its settings and its machine on the tailnet. Never on a server where real people work: every app's
data, and everyone but you, is gone.

## Steps

```sh
pc down
docker volume rm platform_pgdata platform_wal-archive platform_garage-meta platform_garage-data platform_otel-lgtm
sudo rm -rf infra/deploy/backups/*                 # this server's own backups, now of nothing
# For a newer release: git fetch --tags && git checkout augur@<version>, and set PLATFORM_VERSION to it.
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/augur:ro" -w /augur node:22-alpine node scripts/preflight.mjs --install
pc up -d
```

Then sign in again as in [Install AUGUR, step 5](../install/#5-sign-in-and-check-it): Keycloak starts from its
realm file, with you as the only person.

The `tailscale` volume stays, so the machine and its address stay too. `pc down -v` would remove it as well,
and it would join again with `TS_AUTHKEY`, which a one-off key can't.

## Afterwards

- **The deployment's reporting key is new**, because it lived in the database: copy it into Backstage again
  ([Install AUGUR, step 6](../install/#6-finish-setting-up), item 1), or Backstage refuses its reports.
- **The off-server copy keeps the copies from before**, until `OFFSITE_KEEP_DAILY` days pass. To start that
  clean too, point `OFFSITE_REPOSITORY` at a new path.
- **On staging, seed it again** ([sample data](../staging/#sample-data)).
