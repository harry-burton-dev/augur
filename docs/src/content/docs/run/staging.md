---
title: A staging server
description: Run a staging server that takes preview releases before production, with sample people and no real ones.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 12
---

A staging server runs preview releases before they reach production, with sample people and no real ones, so
a release can bake there before it's made stable.

## Install it

Follow [Install AUGUR](../install/), with these differences:

- **`SERVER_RING=preview`** in step 2. It takes preview (beta) releases by default.
- **It reports to Backstage** (step 6, item 1), so its bake hours and its heartbeat reach Backstage with no
  override or hand export. Give it its own `TS_HOSTNAME` and its own entry in `org/deployments.yaml`.
- **Everything else is its own**: its own read key, its own bucket (or its own path in one), its own auth key
  if they aren't reusable. Nothing is shared with production, so a mistake on staging stays there.
- **The same size as production**, so what it shows about memory and speed holds there.

## Sample data

A dev, staging or demo server can be filled with synthetic people, floors, documents and entities by
`pnpm seed`. It works only where `.env` sets `SEED_ALLOWED=true`, and Admin → Status says whether it is
allowed. The run suite (`augur-run`) runs only where it's allowed too. Never set it where real people work.

Set `SEED_ALLOWED=true`, run `pc up -d`, then fill the server with the seed's cast, as the
[sample data guide](https://github.com/harry-burton-dev/augur/blob/main/docs/seed.md) says.

## Next

- [Wipe and refresh](../wipe-and-refresh/) takes it back to empty between runs.
- [Take a server out of service](../retire/) when it's no longer needed.
