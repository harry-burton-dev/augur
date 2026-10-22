# Versioning

Every package, service and app in the monorepo has its own [semver](https://semver.org) version and releases on its own. Changing the registry doesn't release the shell, and an app doesn't wait for the platform. There are three kinds of version, and each answers a different question.

| Version | Where it lives | Answers |
| --- | --- | --- |
| Release | each `package.json`, bumped by [Changesets](https://github.com/changesets/changesets) | Which build of this service, package or app is deployed? |
| API | each `contracts/<service>.openapi.yaml` `info.version`; its major is the path prefix (`/v1`) and the service's `API_VERSION` | Can a caller keep calling this service the way it does? |
| SDK range | each app's `manifest.json` `sdk`, a range over `@platform/mfe-sdk` releases | Can this shell open this app? |

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

Merging that pull request is the release. The workflow then tags each released package as `<name>@<version>`, for example `@platform/registry@0.2.0`, and makes a GitHub release for each tag. Deploy pipelines build from those tags.

Two GitHub settings the workflow needs: Settings → Actions → General → Workflow permissions must allow **Read and write**, and **Allow GitHub Actions to create and approve pull requests** must be on. GitHub doesn't run CI on a pull request the workflow opens itself, so CI runs on the Version packages PR once you push to it or close and reopen it; a token with more reach (a GitHub App or a personal access token in `GITHUB_TOKEN`) removes that step.

To do the same by hand: `pnpm version-packages`, review, commit, merge, then `pnpm release && git push --follow-tags`.

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

`@platform/mfe-sdk` is the contract between the shell and apps: the manifest entry, the mount context, intents and the event bus. Each app's `manifest.json` says which SDK releases it works with:

```json
{ "id": "library", "version": "0.1.1", "sdk": "^1.0.0", "...": "..." }
```

The registry refuses a manifest without a semver `version` and a valid `sdk` range. The shell compares the range with the SDK it was built with (`SDK_VERSION`) and won't open an app outside it: it says the app was made for an older platform, or needs a newer one, instead of mounting it with a context it doesn't expect.

When the SDK makes a breaking change it goes to `2.0.0`. Apps keep `^1.0.0` and the new shell refuses them until each app's team updates the app and widens its range (`^1.0.0 || ^2.0.0` while it works with both). `pnpm check:versions` fails if any app in this repo has a range the current SDK doesn't satisfy, so a breaking SDK change and the apps' updates land together here.

## The shared kit

Apps don't bundle the UI kit or Lit: the shell serves one copy of each through an import map, and every app on the page uses it (see [platform/frontends](../platform/frontends/README.md#one-kit-for-everyone)). So the kit is part of the contract an app's `sdk` range covers, and it keeps the same promise as the SDK:

- Within SDK 1.x the shell serves `@platform/ui-kit` 1.x and Lit 3.x. A kit minor adds components, attributes or icons; it never removes or renames one, or changes what an existing attribute means.
- A breaking kit change is a kit major, and it ships with an SDK major, so the shell refuses apps that haven't been updated for it instead of breaking them.
- Moving the shared Lit to a new major is a kit major too.
