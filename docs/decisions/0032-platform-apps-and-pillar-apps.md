# 0032. Apps that ship with AUGUR are platform apps or pillar apps

- **Status:** Accepted
- **Date:** 2026-11-01 (proposed), 2026-11-03 (accepted)
- **Decided by:** Harry
- **Replaces:** none (amends the pillar list in [0012](0012-apps-in-own-repositories.md), and narrows "platform apps" in the handbook's PDR-008)

## Context

Every app that ships with AUGUR is called a pillar app today, whatever it is for: Artifacts, Mandate and Data Atlas, which hold the organisation's work, and Auspex, which shows people where they are on AUGUR and why they can or can't use things. Home, Admin and the Upgrade Centre ([0030](0030-upgrade-centre-platform-frontend.md)) are platform frontends with no category at all. The handbook's PDR-008 used "platform apps" loosely, for every supporting app that produces no business output, Data Atlas included. Harry asked for Auspex to be renamed Explorer and called a platform app: pillar apps are the foundation of what AUGUR produces, platform apps are for using and managing AUGUR itself.

## Options

1. **Keep one word, pillar, for everything that ships.** Nothing changes, but Explorer and Artifacts read as the same kind of thing, and Home, Admin and the Upgrade Centre stay uncategorised.
2. **Two categories by purpose: platform apps and pillar apps.** Says what each app is for; packaging (platform frontend or separately built app) stays a separate question.
3. **Categories by packaging: platform frontends and apps.** Matches the code, but not how people think about the apps, and puts Explorer with Artifacts.

## Decision

Option 2. An app that ships with AUGUR is one of two kinds:

- **Platform apps** are for using and managing AUGUR: Home, Admin, the Upgrade Centre and Explorer.
- **Pillar apps** are the foundation of AUGUR's output, what the organisation's work is made of: Artifacts, Mandate and Data Atlas.

Every other app is just an app, installed by an admin. The category is about purpose, not about how an app is built or released: Home, Admin and the Upgrade Centre stay platform frontends in the augur repository ([0030](0030-upgrade-centre-platform-frontend.md)); Explorer stays an ordinary app built only on the public contract, with its own sign-in and service, and still moves to its own repository as [0012](0012-apps-in-own-repositories.md) sets out. Both kinds ship in every deployment and can be turned off but not removed.

Auspex is shown to people as **Explorer**. Like Folio shown as Artifacts, its code name stays wherever a server or another app depends on it: app id and route `auspex` (`/auspex`), the intent `auspex.open`, the packages `@apps/auspex*`, the container and image `auspex`, the Keycloak client `app-auspex` and `AUSPEX_CLIENT_SECRET`. The `PILLAR_APPS` setting keeps its name and means "the apps that ship with AUGUR", both kinds.

## Consequences

- People read the name from the manifest (`"name": "Explorer"`); Explorer's screens take it from there, so a later rename is one line.
- The category becomes data in a follow-up: an optional manifest field `category` (`platform` or `pillar`, SDK minor), the registry's own platform apps counted as `platform`, and Admin, Apps showing it. Until then it lives in the docs.
- PDR-008's "platform apps" now means this narrower set; Data Atlas is a pillar app.
- A new shipped app has to say which kind it is, in its ADR or plan.
- Renaming the persisted `auspex` ids, or `PILLAR_APPS`, would need an alias and an upgrade note in docs/upgrade.md; this record chooses not to.

## Links

- Linear PER-179
- docs/auspex.md (Explorer's guide)
- Linear PER-245, PER-278 (alpha milestone spec and its Step 0 records)
