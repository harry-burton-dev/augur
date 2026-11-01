# 0013. One AUGUR version for deployments, and GitHub releases only for AUGUR and apps

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry

## Context

Every package was released on its own, which made 344 tags in a week. Harry and deployment admins only care about one thing: which AUGUR, and which apps, are installed.

## Decision

- Packages are versioned with Changesets; every pull request carries a changeset (or an empty one).
- Deployments see one AUGUR version, `augur@x.y.z`, which is the bill of materials for the platform's images.
- GitHub releases are made only for AUGUR and for each app. Dev builds and previews are image tags, not releases.
- Each AUGUR minor (and major) carries a name from `release/names.json`, birds for now, beside its semver number.
- Frozen SDK minors are kept as contract tests so apps built against them keep working.

## Consequences

- Changesets' fixed group is not used, because it clashes with the rule that AUGUR's minor moves when any platform part's major moves during 0.x. Revisit at 1.0.

## Links

- docs/versioning.md
- Delivery design: https://claude.ai/artifact/5CRmFQHPyR9Fmu7213DRgn
