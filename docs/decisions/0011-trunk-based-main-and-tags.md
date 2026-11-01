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

- Until the move is finished, pull requests still go to `dev`, as CLAUDE.md says.
- docs/release-channels.md will be rewritten when the move lands.

## Links

- Delivery design: https://claude.ai/artifact/5CRmFQHPyR9Fmu7213DRgn
