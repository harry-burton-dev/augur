# 0012. Every app lives in its own repository, and pillar apps are default-installed apps

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry

## Context

Apps (the pillars included) were built inside the platform repository. That hides whether the platform's public contracts really are enough to build an app, and ties every app's release to the platform's.

## Decision

The `augur` repository holds the platform: shell, SDK, UI kit, service kit, records, app tools, contract tests and packaging. Every app, the pillar apps included, lives in its own repository and is built only against published platform packages. Pillar apps (Artifacts, Mandate, Data Atlas, Auspex) are ordinary apps installed by default in every deployment. They move in this order: Mandate, Auspex, Data Atlas, Artifacts.

## Consequences

- An app repository starts from the app template and keeps its own `docs/decisions/` for app-only decisions.
- Backstage lists every repository in one catalog.

## Links

- Delivery design: https://claude.ai/artifact/5CRmFQHPyR9Fmu7213DRgn
