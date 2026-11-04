# The deploy test

Unit and contract tests say the code works. The deploy test says a server can run it: it starts AUGUR with a release's own `infra/deploy/compose.yml` and images, the way a server would, and fails when a release won't start, won't upgrade, or can't go back.

The **Deploy test** workflow (`.github/workflows/deploy-test.yml`) runs it **once per AUGUR release**: the Release workflow calls it right after it pushes the new release's images, so nothing is built twice and it takes about seven minutes. It doesn't run on pull requests or pushes, to keep CI minutes down. A release it fails stays a beta: don't promote it to stable. To try any two releases, run it from Actions → Deploy test, with the release to test and the one to upgrade from.

## What it checks

1. **A fresh server.** The new release starts on empty volumes. Each service's `/healthz` answers, the front door serves the shell, sign-in (`/sso/realms/platform/.well-known/openid-configuration`) and each pillar app's frontend, and no container keeps restarting.
   Then a real browser (Playwright's own image, `infra/deploy-browser-check.mjs`) signs in as the first admin, sets a new password and a one-time-code app as Keycloak asks (the code is worked out from the key Keycloak shows), and opens Home and each app that ships with AUGUR (`release/shipped-apps.json`). Each one must render. React and the kit must come from the release's kit under `KIT_URL`, each with its hash in the import map (ADR 0048). Each app's frontend must come from `/apps/<id>/`, and no code or style file may fail to load. The workflow keeps a screenshot of each page for 14 days (the run's `browser-check-<version>` artifact). `BROWSER_CHECK=0` skips this step when you run the test yourself.
2. **An upgrade.** The release before it (dev builds aside) starts first, from its own tag's deploy files as a server that checked it out has them, and is left to fill its tables, then the new release replaces it, as `pc up -d` does on a server. The same checks pass, every service reports its new version, and no table that had rows is gone or empty.
3. **No critical vulnerabilities with a fix** in the release's images (Trivy, ADR 0043). One that's accepted goes in `.trivyignore` with why and a date to look again.
4. **Going back.** The release it came from starts again on the upgraded data (docs/upgrade.md, "Going back"). This is what the migration rules in [versioning.md](versioning.md#database-migrations) promise, now tried for real.
5. **Broken on purpose** (`broken`). The new release starts fresh again, this time with the updater (its `updater` profile, its own sign-in secret and `PLATFORM_DIR`, as on a server that turned it on). The updater's one look of the watch after an upgrade (`node dist/index.js check`, docs/upgrade.md, "The updater") must pass; then identity is stopped, as an upgrade can leave a part, and the check must fail and name it; ten calls to an app's API through the front door must be counted under `apps` at the gateway's `/traffic`, not under AUGUR's own; then identity is started again and the check must pass. So the watch is shown to see a real failure on real containers, not only in its unit tests. A whole signed upgrade through the updater isn't run here, to keep CI minutes down: staging tries that with a real release. A release whose updater has no check command says so and skips this.

Tailscale isn't started: the front door is published on `localhost:8088` instead. The test's own `.env` has new random secrets each time.

## Running it yourself

```sh
LOCAL_TAG=0.14.0 infra/deploy-test.sh upgrade 0.13.1   # two published releases (docker login ghcr.io with read:packages)
BUILD=1 infra/deploy-test.sh upgrade 0.13.1            # this checkout, built here, against a release
BUILD=1 infra/deploy-test.sh fresh
BUILD=1 infra/deploy-test.sh broken                    # with the updater: its check must see AUGUR broken
```

A release under test runs only its published images, the shipped apps' included (ADR 0049), so every AUGUR container must carry the release's version. With `BUILD=1`, `infra/deploy/compose.build.yml` builds the platform's images here, and Artifacts, Explorer and Data Atlas run AUGUR's images of the newest beta release (or `SHIPPED_APPS_VERSION`'s), so the version check leaves those four out.

Building every image takes ten minutes or more, so try a change to the compose file or a migration this way on your own machine before its release, rather than in CI.

It runs in its own compose project (`augur-deploy-test`) and removes it, volumes too, when it ends. A real `infra/deploy/.env` in the checkout is put aside while it runs and put back after. `WEB_PORT`, `READY_TIMEOUT` and `LOCAL_TAG` change the port, how long it waits for each start (300 s) and the tag of the local images (`ci`, for images built here).

On GitHub-hosted runners the workflow first deletes toolchains it never uses (.NET, Android, GHC, CodeQL): two releases' images, the Artifacts worker with its models among them, don't fit the runner's free disk otherwise.

When it fails, the workflow log shows `ps` and the last lines of every container's log.
