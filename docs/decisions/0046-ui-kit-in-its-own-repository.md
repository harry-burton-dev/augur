# 0046. The UI kit lives in its own repository, and the shell serves the version it pins

- **Status:** Accepted
- **Date:** 2026-11-02
- **Decided by:** Harry
- **Replaces:** none. Changes [0012](0012-apps-in-own-repositories.md), which kept the kit in the platform repository.

## Context

[0012](0012-apps-in-own-repositories.md) moves every app into its own repository and keeps the platform, the SDK and the UI kit together. Harry wants the kit (Common, Quill and Aerie, [0015](0015-react-kits-tailwind.md)) in its own repository too, with its own pipeline, tests and releases, so kit work runs and ships apart from the shell and services.

The shell serves React and the kits to every app through the import map ([0003](0003-import-maps-not-module-federation.md)), so only one kit version runs in a deployment, and apps never bundle their own. That runtime rule is why the 1 Nov delivery design advised against a kit repository: it adds a step between a kit change and the shell that serves it.

## Options

1. **Kit stays in the platform repository.** One pull request can change a token, the kit and the shell together. Kit work keeps running platform CI, and Storybook and Chromatic stay tied to platform releases.
2. **Kit in its own repository, published as packages the shell pins.** The kit has its own CI, Storybook, Chromatic and releases. The shell takes it like any other dependency and serves the pinned version. A change across the kit and the shell takes two pull requests.
3. **Kit in its own repository, served from its own image.** Deployments load the kit straight from the kit's release. Breaks the rule that a deployment runs one tested set of versions, and adds an image to every server.

## Decision

Option 2.

- A repository, `augur-kit`, holds `@augur/kit-common` (Common), `@augur/app-kit` (Quill) and `@augur/shell-kit` (Aerie), the three token files, Storybook and the Chromatic publish.
- It publishes the three packages to GitHub Packages, the same way the platform's libraries are published (docs/versioning.md), on its own Changesets releases. Aerie is published too, because the shell now takes it as a package; app repositories are not given read access to it.
- The platform repository pins one kit version. The shell serves that version in the import map, and the contract tests run against it. Renovate proposes kit updates; a kit update reaches deployments only in an AUGUR release.
- Apps still never bundle React or the kit. A kit major is an SDK major, as [0015](0015-react-kits-tailwind.md) says.
- Each merge to the kit's `main` may publish a prerelease (`next`) so an app or the shell can try a change before the kit releases. Publishing only, no builds beyond the package build.
- The SDK (`@augur/mfe-sdk`) stays in the platform repository: it is the shell's contract.

## Consequences

- Kit pull requests stop running platform CI, and platform pull requests stop running Storybook and Chromatic. `CHROMATIC_PROJECT_TOKEN` moves to the kit repository.
- A change across the kit and the shell (a new token the shell uses) takes a kit release, then a platform pull request bumping it.
- `pnpm check:boundaries` keeps its rule that apps never import Aerie; the kit repository gets its own token and palette checks.
- `docs/versioning.md`, `docs/ci-cd.md`, `platform/frontends/README.md` and AGENTS.md (the shared hot spots and token paths) change when the kit moves.
- Backstage lists the kit repository as its own component.
- The move waits until the React migration (PER-243) stops changing the kit every pull request.

## Links

- Linear PER-244, PER-243, PER-176
- Delivery design and repository split plan (private design notes)
