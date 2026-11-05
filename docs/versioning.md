# Versioning

Every package, service and app in the monorepo has its own [semver](https://semver.org) version and releases on its own. Changing the registry doesn't release the shell, and an app doesn't wait for the platform. There are three kinds of version, and each answers a different question.

| Version | Where it lives | Answers |
| --- | --- | --- |
| Release | each `package.json`, bumped by [Changesets](https://github.com/changesets/changesets) | Which build of this service, package or app is deployed? |
| API | each `contracts/<service>.openapi.yaml` `info.version`, set in the service's `src/contract.ts` ([api-contracts.md](api-contracts.md)); its major is the path prefix (`/v1`) and the service's `API_VERSION` | Can a caller keep calling this service the way it does? |
| SDK range | each app's `manifest.json` `sdk`, a range over `@augur/mfe-sdk` releases | Can this shell open this app? |

## Releases

package.json is the only place a release version is written by hand, and Changesets writes it, not people. Copies elsewhere are kept in step by `scripts/versions.mjs`: the SDK's `SDK_VERSION`, and each app's manifest `version` (from its frontend package, or its service when it has no frontend). CI runs `pnpm check:versions` and fails when any of them drift.

What counts as which:

- **major**: someone has to change their code or configuration to keep working. A removed or renamed API field, a manifest field that becomes required, a changed environment variable.
- **minor**: something new that nobody has to adopt. A new endpoint, a new optional field, a new component.
- **patch**: a fix with no change to how anything is used.

Packages still at `0.x` treat a minor bump as possibly breaking, as semver allows before 1.0. The SDK is at 1.0 already, because every app depends on it through its `sdk` range.

### Making a change

Every pull request carries a changeset, and CI checks for one:

```sh
pnpm changeset          # pick the packages you changed and how, then write a line for the changelog
pnpm changeset --empty  # for a change that releases nothing: docs, CI, tests only
```

Commit the file it writes under `.changeset/` with the change.

### Cutting a release

Releases are cut, built and signed on `main`, each as a beta first: see [release-channels.md](release-channels.md). Making one stable changes only its label.

You don't run anything locally. When changesets reach `main`, the Release workflow opens (and keeps up to date) a pull request called **Version packages**. It bumps every affected package, writes each one's `CHANGELOG.md`, and syncs the manifests and `SDK_VERSION`.

Merging that pull request is the release. Packages get no tag or GitHub release of their own: their version and `CHANGELOG.md` are the record, and the AUGUR release gathers the changelogs of the parts it moves. The only GitHub releases are the units a deployment installs: the AUGUR release (below) and each app's release ([App releases](#app-releases)).

### The AUGUR release

A deployment runs many parts at once, so it is on one **AUGUR version**, such as `augur@0.2.0`, that names them all. `release/augur-release.json` holds it, and nobody edits it by hand: the Version packages PR writes it with the parts' new versions (`node scripts/augur-release.mjs version`, part of `pnpm version-packages`), and writes the version into each upgrade note still marked `**From** unreleased` in docs/upgrade.md, and CI fails when it is out of step (`pnpm check:release`). Parts are the packages under `platform/`, and the packages of the apps that ship with AUGUR at the releases `release/shipped-apps.json` pins; other apps release on their own.

The apps that ship with AUGUR (Artifacts, Explorer, Data Atlas) release in their own repositories, and AUGUR ships the release each one's pin names (ADR 0049). To ship a newer one, run `node scripts/shipped-apps.mjs pin <id> <version>` (it checks the release `app/<id>@<version>` is there and signed in that app's repository, writes its packages' versions, and adds a changeset), and open a pull request with the result. The next Version packages PR then moves AUGUR's version.

`release/shipped-apps.json` is the one list of the apps that ship with AUGUR: nothing else in this repository names them. Beside each app's pin it says where its service answers in the Compose network (`port`, which `/healthz` is asked on) and which of its images are `workers` (they answer nothing: the rendition worker). The release (`infra/release-images.sh`, `scripts/augur-release.mjs`) and the updater read it; the updater's image carries it, and restarts the apps in its order after the platform's services and before the gateway, waiting for each to answer on the version its release gives it. Compose files can't read it, so `infra/deploy/compose.yml`, `infra/docker-compose.yml` and `infra/deploy/compose.build.yml` name each app as a service themselves, and `pnpm check:release` (also `node scripts/shipped-apps.mjs check`) fails when one disagrees with it: an app or worker missing, another port, the registry's `PILLAR_APPS`, the gateway's `APP_UPSTREAMS`, identity's `SERVICE_CLIENT_SECRETS`, storage's `APP_STORAGE`, or one of AUGUR's images that is neither a platform service nor a shipped app. To ship a new app with AUGUR, add its pin there with its `repo`, `port` and `workers`, run the pin command above, and add its services to the compose files until the check passes.

| Field | Meaning |
| --- | --- |
| `version` | The AUGUR version. |
| `name` | Its release name, from `release/names.json` (birds, A to Z): each new minor or major takes the next one and a patch keeps its release's, so AUGUR 0.14.0 and 0.14.1 are both *Avocet*. It's shown beside the version and never used in place of it. Add names at the end of the list, and never reorder one already used. |
| `channel` | `beta` while AUGUR is 0.x, then `stable`. |
| `upgradeFrom` | The AUGUR versions a deployment can upgrade from in one step. After a breaking release, only the release before it. |
| `changed` | The parts this release moves. |
| `breaking` | Why it's breaking: a part's major bump, or a part removed. |
| `settings` | Every setting in `infra/deploy/.env.example`, the ones a deployment must set, and which were added or removed since the last release. |
| `parts` | Every part and its version. |

How the AUGUR version moves: a breaking change in any part bumps the major (the minor while in beta), a feature or a new part bumps the minor, and anything else the patch. A release that moves no part and no setting doesn't change it.

Before a new minor or major is released, write its **What's new** for people in `platform/frontends/shell/src/account/whats-new.ts`: a few things they can now do, and where, in plain words, not the changelog. The shell shows it in Account → About and help, with the deployment's name for AUGUR in place of `{product}`. Patches keep their release's.

When the Version packages PR merges, the workflow makes the GitHub release `augur@<version>`, marked as a pre-release while in beta. Its notes gather each changed part's changelog, the breaking changes and the new settings, and `augur-release.json` is attached for anything that checks for updates. This is what a deployment upgrades to ([upgrade.md](upgrade.md)).

The Upgrade Centre reads these releases. The registry knows which release it ships in from `platform/services/registry/src/augur-version.ts`, which the same script writes beside the release file. A pre-release is on the **beta** channel; a release is made **stable** by the Promote to stable workflow ([release-channels.md](release-channels.md#promote-to-stable)), which takes off its pre-release mark. Deployments following stable see it at their next check.

Two GitHub settings the workflow needs: Settings → Actions → General → Workflow permissions must allow **Read and write**, and **Allow GitHub Actions to create and approve pull requests** must be on. GitHub doesn't start other workflows from anything done with the workflow's built-in token, so the Release workflow uses a `RELEASE_TOKEN` secret instead; with it, CI runs on the Version packages PR by itself. To set it up, create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) for this repository only, with **Contents: Read and write** and **Pull requests: Read and write**, and save it under Settings → Secrets and variables → Actions as `RELEASE_TOKEN`. Renew it before it expires. Without the secret the workflow falls back to the built-in token, and CI on the Version packages PR only starts once you push a commit to its branch.

When the release bumps the SDK's minor, keep the reference app built against it for the contract tests: `pnpm build && pnpm --filter @augur/contract-tests freeze`, then commit the new `platform/contract/frozen/` folder. Where no package token can build it, such as a cloud session, run Actions → Lockfile on the branch with **freeze** ticked and it pushes the folder. Every later shell is tested against it (see [platform/contract](../platform/contract/README.md)). A build byte-for-byte the newest kept one isn't kept: `freeze` says so, and that folder stands for both minors. At SDK 2.0, a major that 1.x apps don't run on, the 1.x builds retire from the contract tests, and each 2.x minor is frozen from then on.

An empty changeset (`pnpm changeset --empty`) bumps nothing, so it never holds back a release. When only empty changesets wait on the branch, as when a tooling PR merges right after the Version packages PR, the Release workflow sets them aside for that run (`scripts/empty-changesets.mjs`) and releases anyway; the next Version packages PR consumes them.

To do the same by hand: `pnpm version-packages`, review, commit, merge, then let the Release workflow make the AUGUR and app releases.

### App releases

An app in `apps/` that doesn't ship with AUGUR (Mandate, until it moves to its own repository) is released on its own, whenever its version moves. Its version is its manifest's, which the Version packages PR keeps in step with its packages. A version with a prerelease part, such as `1.3.0-beta.1`, is on the **beta** channel; any other is **stable**.

Once the Version packages PR merges, the Release workflow asks `node scripts/app-release.mjs pending` which apps have a version with no release yet, and for each one:

1. `infra/release-app.sh <id> <version> <channel>` builds the service's image with the frontend in it and pushes it to `ghcr.io/<repo>/apps/<id>`, packs the built frontend and pushes it beside it as an OCI artifact, `ghcr.io/<repo>/apps/<id>-frontend` (with [ORAS](https://oras.land)). Both are tagged with the version and the channel, and signed with cosign keyless.
2. `node scripts/app-release.mjs publish` makes the GitHub release `app/<id>@<version>`, a pre-release when it's beta, with `app-release.json` attached.

`app-release.json` is what a deployment's app runner installs from:

| Field | Meaning |
| --- | --- |
| `schema` | `augur.app-release/v1`, so a runner can refuse a file it doesn't understand. |
| `id`, `version`, `channel`, `releasedAt`, `sdk` | Which app and version this is, and the SDK range it needs. |
| `manifest` | The app's manifest as released. |
| `service.image` | The service image, by digest; `null` for an app with no service. |
| `frontend` | The frontend artifact by digest, the sha256 of its tarball (what the registry records when it keeps it) and its media type; `null` for an app with no frontend. |
| `signer` | The repository and workflow that signed both parts, which the runner checks each signature against. |
| `asks` | What the version asks an admin for: scopes, storage, floors, upload size and settings. A runner compares it with the version before to decide whether an update needs an admin. |
| `notes` | The app's changelog for this version. |

To see the file an app's next release would carry, without releasing it: `node scripts/app-release.mjs describe <id>`.

A pull request's build is on a third channel, **preview**, with a version of its own, `<x.y.z>-pr.<number>.<run>`, signed by `.github/workflows/app-preview.yml` rather than the Release workflow, and a `preview` field naming the pull request. No deployment follows that channel or installs one as the app: the app runner runs it beside the app, for the app's developers ([app-previews.md](app-previews.md)). Closing the pull request deletes its preview releases.

### Database migrations

A server can always go back to the release before the one it's on, so its tables must still work for that release. Two rules, checked in CI by `pnpm check:migrations` (after `pnpm build`):

- **A migration that shipped in a release never changes and is never removed.** Servers have run it. Fix forward with a new migration.
- **Within a major version, migrations only add**: new tables, new columns with a default, new indexes. A migration that drops, renames, truncates, deletes rows, changes a column's type or makes a column required needs a **major** changeset for its service. That makes the AUGUR release breaking, so nobody skips the release before it. The usual way is to expand, then contract: add the new column and use it in one release, then remove the old one in a later major.

Each service's migrations are the `migrations` export of its `src/store.ts`, applied at start by the service kit's `runMigrations(pool, { schema, migrations })`: in one transaction, under an advisory lock so several instances can start at once, making the schema if it's missing. After adding one, run `pnpm build && pnpm sync:migrations` and commit `release/migrations.lock.json`, which records each migration's fingerprint; the released one is compared against it.

Every migration that hasn't shipped is linted with [Squawk](https://squawkhq.com/docs/rules) (ADR 0053), with the rules in `.squawk.toml` at the root; `pnpm install` brings it. The check also looks for three things Squawk has no rule for: `truncate` (`augur-truncate`), `delete from` (`augur-delete-rows`) and an `update` with no `where` (`augur-bulk-update`). Each problem names its rule and line. When a reviewer agrees the release before is fine with a statement, such as an `update` that fills a column added in the same migration, or a `drop index` whose replacement follows, say why on a comment line and name the rule on the line just above the statement:

```sql
-- Fills the column added above; the release before doesn't read it.
-- squawk-ignore augur-bulk-update
update registry.apps set granted_scopes = '{}';
```

`-- squawk-ignore a, b` names several rules; `-- squawk-ignore-file <rule>` covers the whole migration. Use them for what is safe, not to skip a major changeset.

## HTTP APIs

Each service serves its API under its major version: the registry's manifest is `GET /v1/manifest`, or `GET /api/registry/v1/manifest` through the gateway. The contract in `contracts/` says the same in `servers: [{ url: /v1 }]` and `info.version: 1.x.y`, and the service's `API_VERSION` constant is `'v1'`. `pnpm check:versions` fails if the three disagree.

- A new optional field or endpoint bumps the contract's minor; the path stays `/v1`.
- A breaking change bumps the contract's major and is served under `/v2` **beside** `/v1`. `/v1` keeps working until nothing calls it, then is removed in its own release.
- The API version is independent of the service's release: registry `0.4.0` can serve API `1.2.0`.

`GET /healthz` stays outside the versioned API, because it is for operators and load balancers. Every service answers it with what is deployed:

```json
{ "status": "ok", "service": "registry", "version": "0.2.0", "api": "v1" }
```

## Apps and the SDK

`@augur/mfe-sdk` is the contract between the shell and apps: the manifest entry, the mount context, intents and the event bus. Each app's `manifest.json` says which SDK releases it works with:

```json
{ "id": "library", "version": "0.1.1", "sdk": "^1.0.0", "...": "..." }
```

The registry refuses a manifest without a semver `version` and a valid `sdk` range. The shell compares the range with the SDK it was built with (`SDK_VERSION`) and won't open an app outside it: it says the app was made for an older platform, or needs a newer one, instead of mounting it with a context it doesn't expect.

When the SDK makes a breaking change it goes to `2.0.0`. Apps keep `^1.0.0` and the new shell refuses them until each app's team updates the app and widens its range (`^1.0.0 || ^2.0.0` while it works with both). `pnpm check:versions` fails if any app in this repo has a range the current SDK doesn't satisfy, so a breaking SDK change and the apps' updates land together here.

### The API report (ADR 0052)

What the SDK exports is written down, by API Extractor, in `platform/packages/mfe-sdk/etc/*.api.md`: one report per entry point (`@augur/mfe-sdk` and `@augur/mfe-sdk/build`). The records package and the service kit (`@augur/service-kit`, `/telemetry` and `/mail`) have theirs in their own `etc/`. The reports are committed, so a reviewer sees every change to the contract as a diff. `pnpm check:api`, in CI's `build-test` (on a pull request, when `platform/packages` or the check changed), fails when:

- a report doesn't match the built types: run `pnpm build && pnpm api:update` and commit the report with the change;
- a report names a type from another package: the SDK wraps third-party libraries in its own types, so their next major never forces an SDK major. The one exception is the service kit, which may name Fastify's and jose's types (`ALLOWED_FOREIGN` in `scripts/check-api.mjs`), since a service is built on Fastify (ADR 0005); every other library it uses, such as Nodemailer, stays behind its own types;
- a pull request changes a report without a changeset of the right size for the package: a minor for additions, a major for anything removed or changed. When a change only looks breaking (a widened type, say), a minor changeset with a line starting `Not breaking:` that says why will do.

A library joins by adding an `api-extractor*.json` beside its `package.json`. Before any library is published, and on every pull request that touches `platform/packages`, `scripts/publish-packages.mjs --check` packs each one and runs publint and Are the Types Wrong on it.

## The shared kit

Apps don't bundle React or the kit: the shell serves one copy of each through an import map, and every app on the page uses it (see [platform/frontends](../platform/frontends/README.md#one-kit-for-everyone)). So the kit is part of the contract an app's `sdk` range covers, and it keeps the same promise as the SDK:

- A kit minor adds parts, props or icons; it never removes or renames one, or changes what an existing prop means.
- A breaking kit change is a kit major, and it ships with an SDK major, so the shell refuses apps that haven't been updated for it instead of breaking them.
- SDK 2 dropped Lit and the Lit kit (`@augur/ui-kit`), which SDK 1.x served frozen: the shell no longer serves them, and an app that imports them doesn't load. `pnpm check:boundaries` fails on any import of them under `platform/` or in the app template.
- The contract tests in `platform/contract` hold the shell to this: they mount a reference app built against each earlier SDK minor, and fail CI when the shell breaks one.

### The React kits (ADR 0015)

Every frontend is React. Since SDK 1.10 the shell serves React 19 (`react`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-dom`, `react-dom/client`), Common (`@augur/kit-common`) and Quill, the app kit (`@augur/app-kit`), through the same import map, so a React app's bundle carries none of them. Since ADR 0048 they come as one kit bundle, a signed release of the `augur-kit` repository: an AUGUR release pins its version in `release/kit.json` (written by `pnpm kit:pin`, checked by `pnpm check:kit`), the Release workflow checks its signature before it builds the images (`node scripts/kit.mjs verify`), and the web image serves it at `KIT_URL` ([deploy.md](deploy.md#the-ui-kit)). They keep the same promise:

- Within an SDK major the shell serves React on one major (19.x), and Common and Quill on their same major. Moving React to a new major is an SDK major.
- Common and Quill are still `0.x`, where a minor may break (as semver allows before 1.0), so for them "the same major" means the same minor until they reach 1.0.0. Moving `release/kit.json` to a new kit minor is listed as breaking in its changeset, and apps built on the minor before are checked on it before the release. A kit patch never breaks.
- Aerie, the shell kit (`@augur/shell-kit`), is the shell's own: it is never in the import map and not part of the promise. It is published only for the shell to build with. `pnpm check:boundaries` fails if anything but the shell imports it.
- The tokens live in `packages/kit-common/tokens/` in the `augur-kit` repository, and Common's build writes the Tailwind v4 theme from them. An app styles its own layout with `@import 'tailwindcss/utilities' layer(utilities); @import '@augur/app-kit/theme.css';`, and only AUGUR's tokens exist as classes. It leaves out Tailwind's preflight: the shell already sets the page's base.

## Building an app in its own repository

Apps are moving to their own repositories (ADR 0012), so the libraries in `platform/packages` (the SDK, service-kit, records, app-tools and any added there later) are published to GitHub Packages. The React kits (`@augur/kit-common`, `@augur/app-kit`, `@augur/shell-kit`) and the kit bundle (`@augur/kit-bundle`) are published the same way from the `augur-kit` repository (ADR 0046), and AUGUR takes them as packages too, aliased like any app does: a kit change reaches AUGUR as a pull request that bumps them, which Renovate proposes. They are AUGUR release parts like the packages here, at the versions installed. The Release workflow does it once the Version packages PR has merged, with `scripts/publish-packages.mjs`: each package whose version isn't there yet is published, and nothing else. Nobody publishes by hand.

GitHub's npm registry only takes packages scoped to the repository's owner, so `@augur/<name>` is published as `@<owner>/augur-<name>` (the owner comes from the repository, or `PACKAGE_SCOPE`). An app repository aliases each one back, so its imports stay `@augur/...`:

```json
"dependencies": {
  "@augur/mfe-sdk": "npm:@<owner>/augur-mfe-sdk@^1.9.0",
  "@augur/app-kit": "npm:@<owner>/augur-app-kit@^0.3.0"
}
```

and reads them with a `.npmrc` beside its package.json:

```ini
@<owner>:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

In the app repository's workflows `NODE_AUTH_TOKEN` is its own `GITHUB_TOKEN`, once the package's settings give that repository read access (Package settings → Manage Actions access). On a laptop it's a personal access token with `read:packages`.

The UI kit is still served by the shell at runtime (see [The shared kit](#the-shared-kit)); an app installs it only to build and type-check against, and keeps it out of its bundle. A hotfix published from a `release/<unit>-<major>.<minor>` branch gets the dist-tag `release-<unit>-<major>.<minor>`, so `latest` stays the newest version from `main`.

## Dependency updates

Renovate proposes dependency updates (ADR 0033, `renovate.json`). It runs once a week, early on Monday, and opens one PR for npm minor and patch updates, one for container images and one for GitHub Actions. Security fixes come at any time. A major update stays on the **Dependency Dashboard** issue until someone ticks it there. Renovate never merges anything itself. To merge one of its PRs:

1. Merge fresh `main` into it and let CI run.
2. Check its changeset. The **Renovate changeset** workflow adds one to each Renovate PR: a patch for every package whose files it changes, or an empty one when it only changes tooling outside the packages (workflows, the root lockfile). Change it by hand if a unit should be released that it missed. The workflow pushes with a deploy key, because a push with the workflow's own token starts no CI: a repository admin adds a deploy key with write access (Settings, Deploy keys) and puts its private key in the `RENOVATE_CHANGESET_KEY` secret. Until then the workflow says so on the PR, and the changeset is added by hand (`pnpm changeset`).
3. If it's the kit's PR (`renovate/augur-kit`, labelled `kit`), check that `release/kit.json` moved with it. Renovate opens it as soon as augur-kit releases a kit, not on Monday, with every kit package together. The same workflow installs the new kit, re-pins it (`node scripts/kit.mjs pin`) and rewrites the open-source notices; without the deploy key, run **Actions → Lockfile** on its branch instead. CI's `pnpm check:kit` fails while the pin names another kit, so the pin can't fall behind the packages. Renovate reads the kit from GitHub Packages through a host rule: in Renovate's settings (developer.mend.io, the organisation's **Credentials**), a host rule for `npm.pkg.github.com` with a classic token that has `read:packages`. Without it Renovate can't see new kits and opens no kit PR.
4. If it's labelled `needs-upgrade-note` (a major update to Postgres, pgvector, Keycloak or Garage), write the note in docs/upgrade.md first, including how to go back.

**Shared versions (pnpm catalogs).** A dependency that two or more of AUGUR's packages name has its range once, in the `catalog:` of `pnpm-workspace.yaml`, and each package.json asks for `"catalog:"`. Moving that one line moves every package, and Renovate updates the catalog the same way. `pnpm check:versions` fails when two packages name a dependency without the catalog, or a package names a catalogued one with its own range. The kit's packages (`npm:` aliases, bumped by the kit PR above), `workspace:` packages and peer ranges stay in each package.json. With `catalogMode: prefer`, `pnpm add` uses the catalog's range when there is one. The Renovate changeset counts a catalog change as a change to every package that takes it.

## Going back to an earlier app version

The registry keeps the last 5 versions each app registered (and any version an admin is holding it at). In **Admin → Apps**, open an app and choose what to give the shell:

- **A kept version, and hold it.** The shell is given that version's manifest straight away, and the app stays there: when its service registers a newer version, the registry keeps it in the history but doesn't use it. The audit log records `app.pinned`, and each held registration as `app.updated` with `heldAt`.
- **The newest, as it registers.** Lets go of the hold and gives the shell the newest kept version (`app.unpinned`).

Going back changes the manifest the shell loads: the app's menu, route, SDK range and entry address. Where the deployment keeps apps' frontends by version (`FRONTENDS_BUCKET_SECRET`, see [upgrade.md](upgrade.md#apps-frontends-by-version)), each version an app gave its frontend for is served from its own address, `/apps/library/0.1.0/entry.js`, and going back brings back that code too. The app's service gives it with the service kit's `publishFrontend` before it registers ([Build an app](build-an-app.md#7-putting-it-on-the-platform)). A version with no kept frontend is served from its manifest's own `entry`; when two versions share that address, Admin says so, and the older code needs the older service redeployed. The app's service isn't rolled back either way: its API has to keep working for the older frontend, as [HTTP APIs](#http-apis) asks.
