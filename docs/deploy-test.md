# The deploy test

Unit and contract tests say the code works. The deploy test says a server can run it: it starts AUGUR with the real `infra/deploy/compose.yml` and the images built from the commit, the way a server would, and fails when a release won't start, won't upgrade, or can't go back.

The **Deploy test** workflow (`.github/workflows/deploy-test.yml`) runs it on every push to `main` and to a `release/*` hotfix branch, and on pull requests that touch what a server runs: `infra/`, a service's migrations (`src/store.ts`, `release/migrations.lock.json`). It takes about as long as building every image.

## What it checks

1. **A fresh server.** Every part starts on empty volumes. Each service's `/healthz` answers, the front door serves the shell, sign-in (`/sso/realms/platform/.well-known/openid-configuration`) and each pillar app's frontend, and no container keeps restarting.
2. **An upgrade.** The newest `augur@` release starts first and is left to fill its tables, then the commit's images replace it, as `pc up -d` does on a server. The same checks pass, every service reports its new version, and no table that had rows is gone or empty.
3. **Going back.** The release it came from starts again on the upgraded data (docs/upgrade.md, "Going back"). This is what the migration rules in [versioning.md](versioning.md#database-migrations) promise, now tried for real.

Tailscale isn't started: the front door is published on `localhost:8088` instead. The test's own `.env` has new random secrets each time.

## Running it yourself

```sh
docker compose -f infra/deploy/compose.yml -f infra/deploy/compose.build.yml --env-file infra/deploy/.env.example build   # or BUILD=1 below
infra/deploy-test.sh fresh
infra/deploy-test.sh upgrade 0.13.1     # needs docker login ghcr.io with read:packages while the repository is private
```

It runs in its own compose project (`augur-deploy-test`) and removes it, volumes too, when it ends. A real `infra/deploy/.env` in the checkout is put aside while it runs and put back after. `WEB_PORT`, `READY_TIMEOUT` and `LOCAL_TAG` change the port, how long it waits for each start (300 s) and the tag of the local images (`ci`).

When it fails, the workflow log shows `ps` and the last lines of every container's log.
