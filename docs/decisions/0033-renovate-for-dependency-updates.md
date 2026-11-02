# 0033. Renovate proposes dependency updates, weekly and grouped, and never merges them

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry (took the recommended defaults for the foundation gaps)

## Context

Nothing keeps AUGUR's dependencies current. The workspace has hundreds of npm packages, six pinned container images in compose, two base images in the Dockerfiles, and the GitHub Actions in the workflows. Security fixes only arrive when someone happens to bump a package. Deployments run for months between upgrades, so a stale dependency stays in production for a long time.

## Options

1. **Renovate (the hosted GitHub app), configured in `renovate.json`.** It handles pnpm workspaces, compose files, Dockerfiles and Actions, can group updates, and keeps a dashboard issue. It's free for this repository, maintained, and widely used.
2. **Dependabot.** It's built into GitHub, but it groups less well across a pnpm workspace and doesn't read compose image tags as well.
3. **Bump by hand when a release goes out.** No tool, but the work gets skipped.

## Decision

Option 1, configured like this:

- It runs once a week, early on Monday. Security fixes go out at any time.
- Updates are grouped: one PR for npm minor and patch updates, one for container images, one for Actions. Each major update waits on the dashboard until someone ticks it.
- A new release must be at least 3 days old before Renovate proposes it.
- Renovate never merges. Its PRs follow the usual rule: whoever merges one makes sure CI is green on fresh `main`, and that it carries a changeset, because a dependency bump changes a released unit.
- A major update to Postgres, pgvector, Keycloak or Garage changes data on disk, so it is labelled `needs-upgrade-note` and gets an entry in docs/upgrade.md before it merges.
- The frozen contract builds are never updated.

## Consequences

- Dependency PRs land on a predictable rhythm, about three a week, instead of whenever someone remembers.
- `pnpm changeset status` fails on a Renovate PR until it has a changeset. The Renovate changeset workflow adds one (a patch for each package the PR changes), pushing with a deploy key so CI runs on that commit; see docs/versioning.md.
- Harry installs the Renovate GitHub app on the repository once. Until he does, `renovate.json` does nothing.
- Apps in their own repositories (ADR 0012) copy this file.

## Links

- PER-166.
- docs/versioning.md, "Dependency updates".
