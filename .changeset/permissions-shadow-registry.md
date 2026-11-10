---
'@augur/registry': minor
---

Shadow mode reaches the registry (ADR 0085): its admin and deployment admin checks (the catalogue, installs and removals, versions, allowed sites, app settings, feature previews, upgrades, the overview and reporting) are also asked of the permissions service, after the registry has answered as it always has, and disagreements are counted and logged (docs/observability.md). The registry's own answer still decides.
