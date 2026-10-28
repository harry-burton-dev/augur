# Running CI on our own server

GitHub bills a private repository's Actions by the minute on its hosted runners. Jobs on a runner of our own cost nothing, so AUGUR's workflows can run on a self-hosted runner instead: a container on a server we already have, in `infra/ci-runner`.

Every job in CI, Release, App previews and Release feed picks its runner from the repository variable `CI_RUNNER`. Unset, they run on GitHub's hosted runners as before. Set to `["self-hosted","augur-ci"]`, they all run on ours. Switching back is deleting the variable, with no code change.

## What it is

One container, `augur-ci-1`, in its own compose project (`augur-ci`), apart from AUGUR's:

- **GitHub's runner** ([myoung34/github-runner](https://github.com/myoung34/docker-github-actions-runner), Ubuntu 24.04, as GitHub's hosted `ubuntu-24.04`), with the system libraries the contract tests' Chromium needs, which the hosted image has.
- **Its own Docker daemon.** Jobs' service containers (Postgres), image builds and test containers run inside it, so a job's ports, container names and clean-ups never touch AUGUR's containers on the same server.
- **A fresh start for each job.** Before each job it removes every container, network and volume the last one left, and empties `/tmp`, as a hosted runner's new machine would. Images and build layers stay a week as a cache, so builds after the first are quicker than on GitHub's runners.
- **Caches that stay.** The pnpm store, pip's, Playwright's and Docling's caches and turbo's task cache live on its volumes from job to job, so on it the workflows skip GitHub's cache (which came down from GitHub at about 7 MB/s, a gigabyte a run), and a build, typecheck or test whose inputs haven't changed replays its last result. Pushes to `main` run every task anyway (`TURBO_FORCE`).
- **Limits**: 4 CPUs and 8 GB by default (`CI_CPUS`, `CI_MEMORY` in its `.env`), so a build never starves AUGUR. The contract tests run as many builds of the reference app at once as that memory allows (about 2.5 GB each: three at 8 GB), so more memory makes them quicker. CI's builds, typechecks and tests likewise run about one turbo task per 2 GB (three at 8 GB; tests two at most).

It isn't on AUGUR's network or the tailnet, and it needs no inbound port: the runner calls out to GitHub over HTTPS for work.

## Set it up

On the server (or any Linux machine with Docker that stays on):

1. **Get the files.** In a checkout of this repository at `main` or later, or copy `infra/ci-runner` across by itself:
   ```sh
   cd infra/ci-runner
   cp .env.example .env && chmod 600 .env
   ```
2. **Get a registration token.** On GitHub: the repository's **Settings → Actions → Runners → New self-hosted runner**, Linux. Under **Configure**, copy the token from the `./config.sh --url … --token <TOKEN>` line (not the download steps; the container does those). It lasts an hour, and is used once.
3. **Put it in `.env`** as `RUNNER_TOKEN=<TOKEN>`. Lower `CI_CPUS` and `CI_MEMORY` if the server has less than about 6 CPUs and 16 GB.
4. **Start it:**
   ```sh
   docker compose -f compose.yml --env-file .env up -d --build
   docker compose -f compose.yml --env-file .env logs -f runner
   ```
   It's ready when the log says `Listening for Jobs`, and **Settings → Actions → Runners** shows `augur-ci-1` as **Idle** with the labels `self-hosted`, `Linux`, `X64`, `augur-ci`. It has its own credentials now; take the token out of `.env`.
5. **Point the workflows at it.** **Settings → Secrets and variables → Actions → Variables → New repository variable**: name `CI_RUNNER`, value `["self-hosted","augur-ci"]`.

A pull request's checks run on it from its next push, once its branch has this change (an older branch still names GitHub's runners itself: merge `main` into it). **Re-run** runs the workflow as it was, so push instead.

## Two jobs at a time

One runner takes one job at a time, so a pull request's five CI jobs queue one after another. For two at a time, take a second token from the same GitHub page, put it in `.env` as `RUNNER_2_TOKEN`, and:

```sh
COMPOSE_PROFILES=two docker compose -f compose.yml --env-file .env up -d --build
```

Each has its own Docker daemon and volumes, and its own `CI_CPUS` and `CI_MEMORY`.

## Looking after it

- **The runner updates itself** when GitHub releases a new version. To update the image (new system libraries), pull this folder again and run step 4's `up -d --build`.
- **Disk**: its Docker daemon's images and build cache, in the `augur-ci_docker-1` volume, are pruned after a week unused. `docker system df` inside it shows what's there: `docker compose -f compose.yml exec runner docker system df`.
- **Stopping it**: `docker compose -f compose.yml down`. Jobs wait for it (up to a day) unless `CI_RUNNER` is deleted, which sends them back to GitHub's runners.
- **Starting over**: `down -v` throws away its registration and caches. Remove the old runner under **Settings → Actions → Runners**, and register again from step 2.
- **Releases are built for the runner's architecture.** On an x86-64 server, as GitHub's runners, nothing changes. On an Arm server, the Release workflow's images would be Arm only.

## Security

A self-hosted runner runs whatever the workflows in a pushed branch say. Here that's only people who can push to this private repository, and the Claude sessions working on it, so what it guards against is mistakes and a compromised dependency (`pnpm install` runs packages' scripts), not strangers.

- **It's privileged**, for its Docker daemon, and a job can reach Docker, so a determined job could reach the server it runs on. Treat it as having the server's trust. The separation from AUGUR (own daemon, network and limits) is against accidents, not attacks. For a hard boundary, run it on a small VM of its own instead: the steps are the same.
- **No long-lived token sits on the server.** The registration token is used once; after that the runner holds only its own credentials, which can do nothing but take this repository's jobs. Jobs get GitHub's usual per-job token, as on hosted runners.
- **Jobs don't run as root** and have no `sudo`.
- **Pull requests from forks** don't run workflows at all in a private repository unless **Settings → Actions → General → Fork pull request workflows** turns that on. Leave it off.
- If the runner is ever suspected, **Settings → Actions → Runners → Remove**, then `down -v` on the server.
