# 0018. Releases reach production through rings, a bake time and a halt switch

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** none (extends [0011](0011-trunk-based-main-and-tags.md))

## Context

Every release is built once and moves from the workbench to preview servers to production by relabelling ([0011](0011-trunk-based-main-and-tags.md)). Nothing stops a beta being promoted to stable minutes after it was released, and nothing can stop a bad release that is already stable from spreading.

## Options

1. **Rings plus a bake time and a halt switch.** Simple, and enough for a handful of deployments.
2. **Percentage phases per release** (Sparkle and Omaha style: each deployment hashes into a bucket). Adds nothing until there are many deployments.

## Decision

Option 1.

- **Promote to stable** refuses a release that hasn't run on at least one preview server for the bake time (72 hours by default, set in the workflow) with no rollback reported. The repository owner can override it, and the override is recorded in `promotion.json`.
- **Halt rollout** is an owner-only workflow that marks a release halted in the feed ([0017](0017-signed-release-feed.md)). Resuming clears the mark.
- Revisit percentage phases past about 20 deployments.

## Consequences

- Bake time depends on deployments reporting what they run ([0019](0019-deployment-reporting.md)), which must be built first.

## Links

- Linear PER-177
- docs/release-channels.md
