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

## Amended 2026-11-03

How an app leaves this repository is now set by later records, and this one points at them:

- [0032](0032-platform-apps-and-pillar-apps.md): Explorer (Auspex) is a platform app, so the pillar apps are Artifacts, Mandate and Data Atlas.
- [0046](0046-ui-kit-in-its-own-repository.md) and [0048](0048-kit-served-from-a-kit-url.md): the UI kit lives in `augur-kit` and deployments serve it at a kit URL.
- [0047](0047-app-repositories-in-augurs-feed.md): apps that release from their own repositories are listed in AUGUR's feed and installed by the app runner (Mandate first).
- [0049](0049-pillar-apps-shipped-from-their-releases.md): the apps every deployment ships (Artifacts, Explorer, Data Atlas) are pinned releases that AUGUR's release copies and re-signs.

Going back across the move: a shipped app goes back with AUGUR, because its pre-move images are AUGUR's own. An app installed from its own repository can't go back to a release made in this repository (0047 trusts only its new repository), so a backup is taken before its first release from there is installed, and going back means restoring it.

## Links

- Delivery design (a private design note)
- Linear PER-245, PER-278 (alpha milestone spec and its Step 0 records)
