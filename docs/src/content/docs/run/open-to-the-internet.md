---
title: Open AUGUR to the internet for a while
description: Reach a deployment from anywhere for a few hours through Tailscale Funnel, then close it again.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 15
---

A deployment is private to its tailnet. To reach it from anywhere for a while (a phone off the tailnet, a demo
on someone else's laptop), open it through [Tailscale Funnel](https://tailscale.com/kb/1223/funnel):

```sh
infra/deploy/public.sh on 2h     # 30m, 2h, 1d; 2h when not given, 24 hours at most
infra/deploy/public.sh status    # open or private, and until when
infra/deploy/public.sh off       # close it now
```

It's the address AUGUR already has (`PLATFORM_URL`), so sign-in, Keycloak's redirects and `APP_ORIGINS` need
no changes, and your tailnet keeps working throughout. Switching restarts the `tailscale` container, so the
address drops for a few seconds.

## What it means

- **What's opened**: only the front door (`web`): the shell, apps, `/api` and sign-in. Nothing else on the
  server is reachable, and Keycloak's own console answers 404 to the internet even with
  `KEYCLOAK_CONSOLE=open`: Tailscale marks every request that comes through Funnel, and the front door goes by
  that.
- **It closes by itself** when the time is up. The time is kept in `infra/deploy/tailscale/public-until`, which
  the `tailscale` container checks every 10 seconds, so it holds over a restart or a reboot, and a time gone by
  is private. Run `on` again before then to keep it open longer.
- **It's said, not hidden**: while it's open, Admin → Status says *Open to the internet until …* above
  everything else.
- **Who gets in**: anyone with the address reaches the sign-in page, and only people with an account get past
  it. Sign-in keeps its [limits](../limits/#limits-at-the-front-door), and Keycloak makes each wrong password
  wait longer after 10 in a row. Funnel relays traffic through Tailscale, so large uploads are slower than on
  the tailnet.

## Allow Funnel, once

Before the first time, allow Funnel for the AUGUR machine in your tailnet's policy. In the
[Tailscale admin console](https://login.tailscale.com/admin):

1. **Machines**: find the AUGUR machine (named after `TS_HOSTNAME`) and note whether it shows a tag, such as
   `tag:augur`. It has one if its auth key was tagged.
2. **Access controls**: in the policy file, add an entry to `nodeAttrs` (make the list if it isn't there) and
   save:
   ```json
   "nodeAttrs": [
     { "target": ["autogroup:member"], "attr": ["funnel"] }
   ]
   ```
   For a tagged machine, put its tag as the target instead (`"target": ["tag:augur"]`): `autogroup:member`
   covers machines signed in as a person, not tagged ones.
3. **DNS**: HTTPS Certificates are already on if AUGUR works at its `https://` address; Funnel needs them too.

The policy reaches the machine within a minute, with no restart. `public.sh on` checks it first and says so if
Funnel isn't allowed yet.

## If it goes wrong

If Tailscale won't start open, the container comes back private by itself rather than going down, and
`public.sh status` says what happened (`pc logs tailscale` has the details).
