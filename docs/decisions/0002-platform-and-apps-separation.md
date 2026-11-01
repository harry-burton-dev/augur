# 0002. One platform, apps on top; the platform never imports an app

- **Status:** Accepted
- **Date:** 2026-10-18
- **Decided by:** Harry

## Context

AUGUR is a platform that hosts apps: the shell, SDK, UI kit, gateway, identity, registry, events and storage, with apps such as Artifacts, Mandate, Data Atlas and Auspex built on top. Separation of concerns is Harry's first priority: the platform has to keep working for apps that don't exist yet.

## Decision

Code is split into `platform/` (shell and admin frontends, packages, services) and `apps/`. Nothing in `platform/` imports from an app, apps don't import each other, and nothing in the platform names a particular app: what the shell shows comes from app manifests and the registry. Apps reach the platform only through the SDK, the UI kit, the gateway and published contracts.

The repository is a pnpm workspace built with Turborepo.

## Consequences

- `pnpm check:boundaries` fails CI when `platform/` imports an app or one app imports another.
- An app can be removed, renamed or added without touching platform code.
- Apps are moving to their own repositories ([0012](0012-apps-in-own-repositories.md)); this rule is what makes that possible.

## Links

- docs/shell-principles.md
- Codebase structure review: https://claude.ai/artifact/HA6bWxhxe2ahvSaupediom
