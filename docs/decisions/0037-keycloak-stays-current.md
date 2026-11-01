# 0037. Keycloak moves to the current 26.x and stays current

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** none

## Context

Deployments run Keycloak 26.0.8. Passkeys in the sign-in form arrived in 26.3, passkeys, recovery codes and the Update Email workflow are supported from 26.4, organisation invitation management from 26.5, and Workflows (automated lifecycle steps) are supported from 26.6. The current release is 26.8.

## Options

1. **Upgrade to the current 26.8 and follow minors** (Renovate proposes them, ADR 0033).
2. **Stay on 26.0** and build passkeys, recovery codes and lifecycle jobs ourselves.

## Decision

Option 1. Keycloak goes to 26.8 in one upgrade, keeping the `platform-identity` client and Keycloak's own database login. After that each 26.x minor is taken when Renovate proposes it and the contract and smoke tests pass. Majors need an upgrade note.

## Consequences

- docs/upgrade.md gets a note for the upgrade (database migration runs on Keycloak's first start; take a backup first).
- Features this spec relies on are used only once the upgrade is on main.

## Links

- Linear PER-180
- Keycloak release notes, 26.0 to 26.8
