---
title: Take a server out of service
description: End a deployment so nothing is left behind that can sign in, raise an alarm or cost money.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 14
---

When a deployment is no longer needed, end it so nothing is left behind that can sign in, raise an alarm or
cost money.

1. **Tell its people**, and let them take out anything they want to keep.
2. **Take a last backup off the server**: `pc exec backup /bin/sh /backup/backup.sh --offsite`. Decide how long
   to keep the bucket, and note it.
3. **Take it out of Backstage**: remove its entry from `org/deployments.yaml`, so Backstage doesn't raise the
   alarm when its reports stop.
4. **Stop it and remove its data**: `pc down -v`, then delete the checkout with `infra/deploy/.env`,
   `infra/deploy/secrets/` and `infra/deploy/backups/` (`sudo rm -rf`, since containers own some of it).
5. **Take it off the tailnet**: in the Tailscale admin console, remove the machine, and revoke its auth key if
   it was made for this server.
6. **Revoke what it held**: its read key in GitHub, its sign-in at the email relay, and its bucket key. When
   the bucket's time is up, delete the bucket, and only then the encryption password (`OFFSITE_PASSWORD`) and
   `KEYCLOAK_ADMIN_PASSWORD` from your password manager.
