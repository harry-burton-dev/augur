# 0011. One trunk branch and release tags, instead of environment branches

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** the dev, preview and production branches (docs/release-channels.md)

## Context

From 29 October AUGUR used three long-lived branches (dev, preview, production) with promotion pull requests between them. It caused merge conflicts, duplicate releases and a lot of CI time.

## Decision

Work merges into one trunk branch. Releases are tags on it. Dev, preview and production are labels on a signed build that a deployment's ring follows, not branches. Promoting a release relabels it rather than rebuilding it. `release/*` branches exist only for hotfixes.

## Consequences

- Every release is built and signed once on the trunk as a beta; **Promote to stable** (owner only) relabels it. docs/release-channels.md describes the whole flow.
- Hotfixes go through `release/<unit>-<major>.<minor>`, cut from the release's tag.
- `dev` is renamed `main` once the workflows that release from `main` are merged; until then pull requests still go to `dev`.

## Links

- Delivery design (a private design note)
