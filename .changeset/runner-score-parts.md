---
'@augur/updater': minor
---

The app runner runs app contract 3 releases: one container per Score part, `app-<id>-<part>-<slot>`, given only what its resources' provisioners hand it (the gateway, a database login, a bucket, scratch and files folders, telemetry, the floor graphs, settings), its secrets as files mounted as Compose secrets, its memory and CPU limits applied within the deployment's new ceilings, a read-only root with `/tmp`, and refused when its image runs as root. Job parts run to the end before the switch; every service part must answer `/healthz` on the new version. Only `APP_PUBLISHERS` says who may publish apps, and the runner tells the registry the deployment's own networks at start.
