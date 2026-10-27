# Versioning

Every package, service and app in the monorepo has its own [semver](https://semver.org) version and releases on its own. Changing the registry doesn't release the shell, and an app doesn't wait for the platform. There are three kinds of version, and each answers a different question.

| Version | Where it lives | Answers |
| --- | --- | --- |
| Release | each `package.json`, bumped by [Changesets](https://github.com/changesets/changesets) | Which build of this service, package or app is deployed? |
| API | each `contracts/<service>.openapi.yaml` `info.version`; its major is the path prefix (`/v1`) and the service's `API_VERSION` | Can a caller keep calling this service the way it does? |
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

You don't run anything locally. When changesets reach `main`, the Release workflow opens (and keeps up to date) a pull request called **Version packages**. It bumps every affected package, writes each one's `CHANGELOG.md`, and syncs the manifests and `SDK_VERSION`.

Merging that pull request is the release. The workflow then tags each released package as `<name>@<version>`, for example `@augur/registry@0.2.0`, and makes a GitHub release for each tag. It also makes the AUGUR release (below).

### The AUGUR release

A deployment runs many parts at once, so it is on one **AUGUR version**, such as `augur@0.2.0`, that names them all. `release/augur-release.json` holds it, and nobody edits it by hand: the Version packages PR writes it with the parts' new versions (`node scripts/augur-release.mjs version`, part of `pnpm version-packages`), and CI fails when it is out of step (`pnpm check:release`). Parts are the packages under `platform/`; apps under `apps/` release on their own.

| Field | Meaning |
| --- | --- |
| `version` | The AUGUR version. |
| `channel` | `beta` while AUGUR is 0.x, then `stable`. |
| `upgradeFrom` | The AUGUR versions a deployment can upgrade from in one step. After a breaking release, only the release before it. |
| `changed` | The parts this release moves. |
| `breaking` | Why it's breaking: a part's major bump, or a part removed. |
| `settings` | Every setting in `infra/deploy/.env.example`, the ones a deployment must set, and which were added or removed since the last release. |
| `parts` | Every part and its version. |

How the AUGUR version moves: a breaking change in any part bumps the major (the minor while in beta), a feature or a new part bumps the minor, and anything else the patch. A release that moves no part and no setting doesn't change it.

When the Version packages PR merges, the workflow makes the GitHub release `augur@<version>`, marked as a pre-release while in beta. Its notes gather each changed part's changelog, the breaking changes and the new settings, and `augur-release.json` is attached for anything that checks for updates. This is what a deployment upgrades to ([upgrade.md](upgrade.md)).

Admin → Updates reads these releases. The registry knows which release it ships in from `platform/services/registry/src/augur-version.ts`, which the same script writes beside the release file. A pre-release is on the **beta** channel; to promote a release to **stable**, edit it on GitHub and untick **Set as a pre-release**. Deployments following stable see it at their next check.

Two GitHub settings the workflow needs: Settings → Actions → General → Workflow permissions must allow **Read and write**, and **Allow GitHub Actions to create and approve pull requests** must be on. GitHub doesn't start other workflows from anything done with the workflow's built-in token, so the Release workflow uses a `RELEASE_TOKEN` secret instead; with it, CI runs on the Version packages PR by itself. To set it up, create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) for this repository only, with **Contents: Read and write** and **Pull requests: Read and write**, and save it under Settings → Secrets and variables → Actions as `RELEASE_TOKEN`. Renew it before it expires. Without the secret the workflow falls back to the built-in token, and CI on the Version packages PR only starts once you push a commit to its branch.

When the release bumps the SDK's minor, keep the reference app built against it for the contract tests: `pnpm build && pnpm --filter @augur/contract-tests freeze`, then commit the new `platform/contract/frozen/` folder. Every later shell is tested against it (see [platform/contract](../platform/contract/README.md)).

To do the same by hand: `pnpm version-packages`, review, commit, merge, then `pnpm release && git push --follow-tags`.

### Database migrations

A server can always go back to the release before the one it's on, so its tables must still work for that release. Two rules, checked in CI by `pnpm check:migrations` (after `pnpm build`):

- **A migration that shipped in a release never changes and is never removed.** Servers have run it. Fix forward with a new migration.
- **Within a major version, migrations only add**: new tables, new columns with a default, new indexes. A migration that drops, renames, truncates, deletes rows, changes a column's type or makes a column required needs a **major** changeset for its service. That makes the AUGUR release breaking, so nobody skips the release before it. The usual way is to expand, then contract: add the new column and use it in one release, then remove the old one in a later major.

Each service's migrations are the `migrations` export of its `src/store.ts`. After adding one, run `pnpm build && pnpm sync:migrations` and commit `release/migrations.lock.json`, which records each migration's fingerprint; the released one is compared against it.

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

## The shared kit

Apps don't bundle the UI kit or Lit: the shell serves one copy of each through an import map, and every app on the page uses it (see [platform/frontends](../platform/frontends/README.md#one-kit-for-everyone)). So the kit is part of the contract an app's `sdk` range covers, and it keeps the same promise as the SDK:

- Within SDK 1.x the shell serves `@augur/ui-kit` 1.x and Lit 3.x. A kit minor adds components, attributes or icons; it never removes or renames one, or changes what an existing attribute means.
- A breaking kit change is a kit major, and it ships with an SDK major, so the shell refuses apps that haven't been updated for it instead of breaking them.
- Moving the shared Lit to a new major is a kit major too.
- The contract tests in `platform/contract` hold the shell to this: they mount a reference app built against each earlier SDK minor, and fail CI when the shell breaks one.

## Going back to an earlier app version

The registry keeps the last 5 versions each app registered (and any version an admin is holding it at). In **Admin → Apps**, open an app and choose what to give the shell:

- **A kept version, and hold it.** The shell is given that version's manifest straight away, and the app stays there: when its service registers a newer version, the registry keeps it in the history but doesn't use it. The audit log records `app.pinned`, and each held registration as `app.updated` with `heldAt`.
- **The newest, as it registers.** Lets go of the hold and gives the shell the newest kept version (`app.unpinned`).

Going back changes the manifest the shell loads: the app's menu, route, SDK range and entry address. Where the deployment keeps apps' frontends by version (`FRONTENDS_BUCKET_SECRET`, see [upgrade.md](upgrade.md#apps-frontends-by-version)), each version an app gave its frontend for is served from its own address, `/apps/library/0.1.0/entry.js`, and going back brings back that code too. The app's service gives it with the service kit's `publishFrontend` before it registers ([Build an app](build-an-app.md#7-putting-it-on-the-platform)). A version with no kept frontend is served from its manifest's own `entry`; when two versions share that address, Admin says so, and the older code needs the older service redeployed. The app's service isn't rolled back either way: its API has to keep working for the older frontend, as [HTTP APIs](#http-apis) asks.
