# The deploy test

Unit and contract tests say the code works. The deploy test says a server can run it: it starts AUGUR with a release's own `infra/deploy/compose.yml` and images, the way a server would, and fails when a release won't start, won't upgrade, or can't go back.

The **Deploy test** workflow (`.github/workflows/deploy-test.yml`) runs it **once per AUGUR release**: the Release workflow calls it right after it pushes the new release's images, so nothing is built twice and it takes about five minutes. It doesn't run on pull requests or pushes, to keep CI minutes down. A release it fails stays a beta: don't promote it to stable. To try any two releases, run it from Actions → Deploy test, with the release to test and the one to upgrade from.

## What it checks

1. **A fresh server.** The new release starts on empty volumes. Each service's `/healthz` answers, the front door serves the shell, sign-in (`/sso/realms/platform/.well-known/openid-configuration`) and each pillar app's frontend, and no container keeps restarting.
2. **An upgrade.** The release before it (dev builds aside) starts first, from its own tag's deploy files as a server that checked it out has them, and is left to fill its tables, then the new release replaces it, as `pc up -d` does on a server. The same checks pass, every service reports its new version, and no table that had rows is gone or empty.
3. **No critical vulnerabilities with a fix** in the release's images (Trivy, ADR 0043). One that's accepted goes in `.trivyignore` with why and a date to look again.
4. **Going back.** The release it came from starts again on the upgraded data (docs/upgrade.md, "Going back"). This is what the migration rules in [versioning.md](versioning.md#database-migrations) promise, now tried for real.

Tailscale isn't started: the front door is published on `localhost:8088` instead. The test's own `.env` has new random secrets each time.

## Running it yourself

```sh
LOCAL_TAG=0.14.0 infra/deploy-test.sh upgrade 0.13.1   # two published releases (docker login ghcr.io with read:packages)
BUILD=1 infra/deploy-test.sh upgrade 0.13.1            # this checkout, built here, against a release
BUILD=1 infra/deploy-test.sh fresh
```

Building every image takes ten minutes or more, so try a change to the compose file or a migration this way on your own machine before its release, rather than in CI.

It runs in its own compose project (`augur-deploy-test`) and removes it, volumes too, when it ends. A real `infra/deploy/.env` in the checkout is put aside while it runs and put back after. `WEB_PORT`, `READY_TIMEOUT` and `LOCAL_TAG` change the port, how long it waits for each start (300 s) and the tag of the local images (`ci`, for images built here).

When it fails, the workflow log shows `ps` and the last lines of every container's log.
