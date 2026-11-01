# 0016. The kits' Storybook is hosted on Chromatic

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry

## Context

Both kits (ADR 0015) are documented in one Storybook. Harry wants it hosted, so it can be opened from his phone and shown to others without running it locally. Today CI uploads a Storybook build as a workflow artifact on every PR.

## Options

1. **A static image beside Backstage, on the tailnet.** Private and free, but it gives no visual review.
2. **Chromatic.** Made by the Storybook maintainers. It hosts every build, shows visual changes and accessibility results on each PR, and has a free tier. It is an outside vendor and holds the kits' code.
3. **GitHub Pages.** The site is public, and a private repository needs a paid plan.

## Decision

Option 2. CI publishes the Storybook to Chromatic from `main`, and from PRs that touch the kit folders. Chromatic's link to the `main` build is what we share and what Backstage's catalog links to.

## Consequences

- Harry creates the Chromatic project and adds its token as the `CHROMATIC_PROJECT_TOKEN` repository secret.
- Snapshots count against the free tier. The CI job runs only when kit folders change and uses TurboSnap, so only stories whose code changed are snapshotted. If usage approaches the limit, that is a spending decision for Harry.
- Visual changes on a PR need accepting in Chromatic before the check turns green.

## Links

- Linear PER-176
- [0015](0015-react-kits-tailwind.md)
