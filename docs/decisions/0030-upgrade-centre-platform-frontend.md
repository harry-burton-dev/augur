# 0030. The Upgrade Centre is its own platform frontend, released with AUGUR

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** none (clarifies [0012](0012-apps-in-own-repositories.md))

## Context

The Upgrade Centre is one page inside Admin today (`platform/frontends/admin/src/updates.ts` and the app installs screens). The Upgrade Centre UI spec gives it an overview, a page per unit (AUGUR and each app), one history and a five-step change flow, which is too much for one Admin page and is used by different people (deployment admins, app admins, viewers; [0022](0022-upgrade-roles-step-up.md)). Harry asked for it to become a standalone app for admins.

[0012](0012-apps-in-own-repositories.md) puts every app in its own repository. The Upgrade Centre is the tool that upgrades AUGUR itself and goes back when an upgrade fails, and it calls the updater's privileged endpoints, which aren't part of the app contract.

## Options

1. **A platform frontend in the augur repository** (`platform/frontends/upgrades`), listed in the registry's platform apps and released with AUGUR, like Admin and Home.
2. **An app in its own repository**, installed by default and released on its own (0012 read literally). It could be broken or removed by the very app runner it controls, and its version could drift from the updater's API.
3. **Keep it inside Admin** under a new area.

## Decision

Option 1. The Upgrade Centre is a platform frontend with the id `upgrades` at `/upgrades`, shown as "Upgrade Centre", the same on every floor, built on React and the app kit ([0015](0015-react-kits-tailwind.md)). It ships in every AUGUR release and is never installed, removed or upgraded on its own. Platform frontends (Admin, Home, Upgrade Centre) stay in the augur repository; they are not apps in the sense of 0012.

## Consequences

- The registry lists `upgrades` in its platform apps, so its id and route are reserved and it can't be disabled in Admin.
- Admin's Upgrade Centre screens move to the new frontend; Admin's menu links there for one release, then they are removed.
- The page shows to everyone with an Upgrade Centre role; acting needs `deployment-admin` (and later the per-app admin role) as 0022 sets out.
- `pnpm check:boundaries` already keeps platform frontends from importing apps.

## Links

- Linear PER-178
- Upgrade Centre UI spec (a private design note)
