# CI/CD: how AUGUR is checked, built and released

Every check, build and release of AUGUR runs in GitHub Actions in this repository, from the
workflows in `.github/workflows/`. This guide says what each one does, when it runs, what it costs,
and how to keep it cheap. What a release *is* (channels, dev builds, promotion, hotfixes, rings)
is in [release-channels.md](release-channels.md); versions and changesets in
[versioning.md](versioning.md).

The decisions behind it: trunk-based `main` and tags ([ADR 0011](decisions/0011-trunk-based-main-and-tags.md)),
versions and releases ([ADR 0013](decisions/0013-versions-and-releases.md)), signed feeds
([ADR 0017](decisions/0017-signed-release-feed.md)), rollout gates ([ADR 0018](decisions/0018-rollout-gates.md)),
Renovate ([ADR 0033](decisions/0033-renovate-for-dependency-updates.md)), lint and scans
([ADR 0043](decisions/0043-ci-lint-and-scans.md)). The kit's Storybook and Chromatic ([ADR 0016](decisions/0016-storybook-on-chromatic.md)) run in the `augur-kit` repository (ADR 0046).

## The rule: scarce but effective

GitHub bills every minute a hosted runner spends on a private repository, rounded **up to a whole
minute per job**. So:

- A pull request runs only the jobs its change needs. A job it doesn't need is skipped at the job
  level (`if:`), before it takes a runner: it costs nothing and counts as passed for a required check.
  A job that starts and then decides to do nothing still costs a minute.
- Anything heavy (image builds, booting the whole stack, every frozen SDK build) runs **once per
  release**, not on every pull request or push.
- The push that merges a pull request doesn't run the pull request's checks again: they ran on the
  same code. (Merge fresh `main` into a pull request before merging it, as the merge rule says, so that
  holds.)
- A new check says what it costs in minutes, and rides an existing job where it can.

## The path of a change

| Step | Workflow | Jobs | Typical billed minutes |
|---|---|---|---|
| Push to a pull request | **CI** | `changes`, `build-test`, `scan`, then only what the change needs | 4–6 (docs or a service), up to ~20 (shell, kits and images) |
| | **App previews** | `preview` for an app in `apps/` that doesn't ship with AUGUR | 2 per app changed |
| | **Renovate changeset** | adds a changeset to a Renovate pull request | under 1 |
| Merge into `main` | **CI** | `changes`, `build-test` (refills the turbo cache) | 3–5 |
| | **Release** | keeps the Version packages pull request up to date | 1 |
| | **AUGUR dev builds** | builds, signs and releases every image as `augur@x.y.z-dev.N` for the workbench | 8–10 |
| | **App dev builds** | the same for each separately released app the merge changed | 2 per app |
| | **Pipeline feed** | after Release and the dev builds, refreshes `feed:pipeline` | 1 |
| Merge the Version packages pull request | **CI** on that pull request first | everything, every frozen SDK build included | ~25 |
| | **Release** | builds, signs and releases each unit whose version moved, as beta | ~15 |
| | **Deploy test** | fresh install, upgrade from the release before, Trivy, going back | ~8 |
| | **Release feed** | publishes the signed `feed:latest` | 1 |
| Make a release stable (Harry) | **Promote to stable** | checks bake time, marks the same build stable | 1–2 |
| Stop a bad release | **Halt rollout** | marks it halted in the feed | 1 |

Measured on 1–2 November 2026, before the cuts in this guide: about 6,400 billed minutes in two
days, about 105 per merged pull request. The biggest parts were CI running everything again on each
push to `main` (about 27 minutes a merge), the contract tests on every pull request (5–9 minutes),
image builds on pull requests (fixed in #232), the dev build (16–20 minutes, six of them the Folio
worker) and jobs that started only to skip themselves (a minute each). With the cuts it should be
roughly 40–50 minutes per merged pull request. To measure it again, see [Measuring](#measuring).

## CI (`ci.yml`)

Runs on every pull request, on pushes to `main` and `release/**`, and by hand (Actions → CI → Run
workflow), which runs everything. A new push to a pull request cancels its previous run.

**`changes`** decides which jobs run (`scripts/ci-changes.sh`). It compares a pull request with
where it left its base branch, and a push with the push before it. The Version packages pull request
(`changeset-release/*`), a run by hand, and any change to `ci.yml` or the script itself run
everything.

| Job | Pull request runs it when it changes | On a push | What it does |
|---|---|---|---|
| `build-test` | always | always | install, boundaries, reasons, ESLint, versions, release file, catalog, licences, repository security (below), script tests, the hotfix rule, a changeset, build, the API reports and (when `platform/packages` changed) publint and Are the Types Wrong on the packed packages (ADR 0052), manifests, migrations (frozen once on `main`), typecheck, tests against Postgres |
| `scan` | always | never | gitleaks on the pull request's commits; OSV-Scanner, failing only on vulnerabilities the pull request brings in (ADR 0043) |
| `contract` | `platform/frontends` (not Admin or the Upgrade Centre), `platform/packages`, `platform/contract`, the Folio pin (`release/shipped-apps.json`, `infra/shipped-app.sh`), the root `package.json` or the lockfile | never | the reference app, today's build and frozen ones from earlier SDK releases, mounted by the real shell in Chromium, with Folio (from the release AUGUR ships) on and off, and axe on the shell once (ADR 0063) |
| `app-scaffold` | the app template, `create-app`, the shared packages, the registry, or the scripts that check apps | never | `pnpm create-app` still makes an app that builds, passes its tests and is accepted |
| `deploy-images` | `infra`, `.dockerignore`, any `package.json`, the workspace file or the lockfile | never | the compose files are valid; the four main images build, the web image serves the shipped apps' frontends, and none runs as root; nginx and its Content Security Policy; the backup and restore scripts |

**The contract tests' frozen builds.** `platform/contract/frozen/` holds a build of the reference app
from each SDK minor whose bundle differed from the one before (a folder stands for the run of
identical minors it starts), and runs only the contract spec. An ordinary pull request runs today's build (Folio on and off) and only the
oldest and newest frozen builds (`CONTRACT_FROZEN=edges`); the Version packages pull request and a
run by hand run every one, so nothing is released without the full set passing.

**The turbo cache.** Turbo keeps each task's output in `TURBO_CACHE_DIR`, saved to GitHub's cache
under the commit. A pull request restores its own last run or, failing that, `main`'s; a task whose
inputs haven't changed replays instead of running. Each push to `main` saves `build-test`'s cache,
which is what new pull requests start from; `contract` falls back to it too.

**Concurrency inside a job.** `build-test` fits turbo's concurrency to the runner's memory (about
2 GB a task after 1.5 GB for Postgres; tests two at a time as they share one database). The contract
runner (`platform/contract/run.mjs`) runs about one shell per 2.5 GB and two cores.

## Releases and dev builds

**Release (`release.yml`)**, on every push to `main` or a hotfix's `release/<unit>-<major.minor>`:
the Changesets action keeps the Version packages pull request open while changesets wait. When that
pull request is merged, it builds and signs AUGUR's images (`infra/release-images.sh`) and each
separately released app whose version moved (`infra/release-app.sh`), publishes them as GitHub
pre-releases (`augur@x.y.z`, `app/<id>@x.y.z`), then calls the Release feed and, for an AUGUR release,
the Deploy test. On any other push it does nothing else and takes about a minute.

**AUGUR dev builds (`augur-dev.yml`)**, on each merge into `main` that changes the platform, a pillar
app's pin, `infra` or `release/` (notes, the contract tests and the Storybook aside): every image, built,
pushed and signed as a release is, released as the pre-release `augur@<next patch>-dev.<run>`. Only
the workbench (`SERVER_RING=dev`) takes it. Merges that land while one is building wait, and only the
newest waiting one runs.

**App dev builds (`app-dev.yml`)** and **App previews (`app-preview.yml`)** do the same for apps
in `apps/` that are released on their own (not Folio, Explorer or Data Atlas, which go out with
AUGUR): a dev build per merge, and a preview per pull request that deployments can switch to
([app-previews.md](app-previews.md)). Closing the pull request deletes its previews. The release feed
is signed again only when a preview was released or deleted, not after every push to the pull request.

**How the images are built.** `infra/release-images.sh` builds the platform's images with one Buildx
builder, each with provenance and an SBOM, pushes them to `ghcr.io/<repo>/<name>`, and signs each by
digest with cosign keyless. The pillar apps aren't built here ([ADR 0049](decisions/0049-pillar-apps-shipped-from-their-releases.md)):
for each release `release/shipped-apps.json` pins, it checks the app repository's `release.yml` signed
it, copies its service image under AUGUR's images by digest and signs it again, and puts the frontend
that image carries into the web image (`.shipped/frontends/<id>`). Reading the app repositories takes
the `APP_RELEASES_TOKEN` and `PACKAGES_READ_TOKEN` secrets. Two things keep it short:

- `infra/service.Dockerfile` and `infra/web.Dockerfile` start the same way, up to the build stage's
  `COPY . .` and before any build argument, so the workspace is installed once and every later image
  reuses that layer. Keep that part identical.
- The install (the `deps` stage) starts from the workspace's manifests alone (every `package.json`,
  the lockfile, `pnpm-workspace.yaml`, `.npmrc`), so it changes only when the dependencies do. The dev
  build keeps it in GitHub's cache between runs (`BUILDX_CACHE`, keyed by those files and the
  Dockerfiles), saved again only when they change, and CI's `deploy-images` job reads the same entry.
  Only that stage is kept, so a release's base image and Alpine fixes are always fresh.
- Artifacts' worker (Torch and Docling's models, about six minutes) isn't in its app release, so it's
  built from augur-folio at the pinned release's tag, and also tagged `src-<git tree of worker/>`. A
  dev build whose worker folder is unchanged reuses that image, tags it for the new build and signs it
  again; a beta or stable release always builds it afresh, with the current base image and Python packages.

**Deploy test (`deploy-test.yml`)**, once per AUGUR release, called by Release with the images it just
pushed: [deploy-test.md](deploy-test.md).

## Feeds

- **Release feed (`feed.yml`)**: the signed list of releases deployments read (`feed:latest`). After signing it checks the signature with the registry's own check and the signer identity deployments expect (`scripts/check-feed-signature.mjs`), so a mismatch fails here, not on every deployment.
  Called once at the end of each workflow that makes or removes releases, weekly to re-sign it
  before it expires, and by hand after changing a release in GitHub yourself.
- **Pipeline feed (`pipeline.yml`)**: where each unit is between `main`, beta and stable, for
  Backstage and the Upgrade Centre (`feed:pipeline`). Runs after Release, Promote and the dev builds,
  and by hand; only the newest run matters, so a newer one cancels an older one.

## Promotion and halting

Both run only by hand, and only for the repository's owner. **Promote to stable (`promote.yml`)**
marks a beta stable once it has baked on a preview deployment (asking the portal over Tailscale,
[ADR 0045](decisions/0045-promote-asks-portal-over-tailscale.md)); nothing is rebuilt. **Halt rollout
(`halt.yml`)** stops a release reaching more servers. See
[release-channels.md](release-channels.md#promote-to-stable).

## Runners, variables and secrets

Every job runs on GitHub's hosted Linux runners unless repository variables say otherwise:

| Name | Kind | What it does |
|---|---|---|
| `CI_RUNNER` | variable | JSON runner labels for every job, such as `["self-hosted","augur-ci"]` or a runner provider's label |
| `RELEASE_RUNNER` | variable | x86-64 labels for the jobs that build images, if `CI_RUNNER` names Arm runners |
| `PACKAGES_READ_TOKEN` | secret | a classic token with `read:packages`, for installing the kit's packages from GitHub Packages (`.npmrc`, ADR 0046), in every workflow and image build; without it each run uses its own `GITHUB_TOKEN`, which reads only packages that grant this repository access |
| `RELEASE_TOKEN` | secret | pushes the Version packages pull request and the Lockfile workflow's commit, so CI runs on them |
| `RENOVATE_CHANGESET_KEY` | secret | the deploy key Renovate changeset pushes with, so CI runs on its commit |
| `GITHUB_TOKEN` | built in | pushes images and releases; signing uses the workflow's OIDC token, no keys |

Who may sign what is checked on the server side by the updater and the registry: images and feeds
must be signed by this repository's workflows on `main` or a release branch
([release-channels.md](release-channels.md#signatures)).

Image builds get the package token as a BuildKit secret (`--secret id=node_auth_token,env=NODE_AUTH_TOKEN`),
so it never lands in a layer.

### Lockfile

`lockfile.yml` brings `pnpm-lock.yaml` up to date on a branch (Actions → Lockfile → Run workflow). Use it
for a change that adds or bumps a kit package, made where no package token is set, such as a cloud
session: pnpm can't resolve those packages there.

## Repository security

`pnpm check:repo-security` (`scripts/check-repo-security.mjs`, in `build-test`) holds the rules a
pull request could otherwise quietly undo:

- every action a workflow uses is pinned to a full commit SHA, with its version in a comment
  (Renovate keeps the pins current);
- every workflow has a top-level `permissions:` block;
- no `run:` script expands text someone else chose (a branch name, a title, a comment) with `${{ }}`;
  it goes through `env:` and is used as `"$NAME"`;
- CI tests on the Postgres major that `infra/deploy/compose.yml` runs. Local dev
  (`infra/docker-compose.yml`) stays on its own major so existing dev data still starts; moving
  servers to a new major needs an upgrade note in [upgrade.md](upgrade.md) first.

The rest lives in GitHub's settings, which a cloud session can't change. The owner keeps them:

- a ruleset on `main` in this repository, augur-kit, each app repository and the app template: no
  force pushes or deletion, changes through a pull request with CI green;
- a ruleset on `release/**` that lets only the owner create, push or delete those branches, since
  the updater and the registry trust signatures from any `release/<unit>-<x>.<y>` branch;
- `APP_RELEASES_TOKEN` as a fine-grained token with only what it is used for: Contents read on the app
  repositories (their releases and source) and Actions write on this one (an app's release starts the
  Release feed), set in this repository and each app repository, expiring after 90 days.

Each release image carries a signed SBOM and SLSA provenance
([release-channels.md](release-channels.md#signatures)), and the deploy test runs Trivy over every image a
release runs, third-party ones included ([deploy-test.md](deploy-test.md)).

## Adding or changing a job

1. Ask whether it needs to run on every pull request. If it can wait for the Version packages pull
   request or the release, put it there.
2. If it only matters when some paths change, add an output to `scripts/ci-changes.sh` and gate the
   job with `needs: changes` and `if:`. Don't gate it with a step inside the job: that still costs a
   minute.
3. If it is under a minute, add it as a step to an existing job instead of a new job.
4. Say in the pull request what it adds in minutes per run, and update the tables above.

## Measuring

The billed minutes of recent runs, by workflow and job, from the API (needs `gh` signed in):

```sh
gh api "repos/harry-burton-dev/im-platform/actions/runs?per_page=100&created=>=$(date -u -d '2 days ago' +%F)" \
  -q '.workflow_runs[].id' | while read -r id; do
  gh api "repos/harry-burton-dev/im-platform/actions/runs/$id/jobs" -q '.jobs[] |
    select(.conclusion != "skipped" and .started_at and .completed_at) |
    [.name, ((.completed_at | fromdate) - (.started_at | fromdate))] | @tsv'
done | awk -F'\t' '{m=int(($2+59)/60); t[$1]+=m; s+=m} END {for (j in t) print t[j], j; print s, "total"}' | sort -rn
```

GitHub's own figure is in the repository's (or account's) Settings → Billing → Usage.
