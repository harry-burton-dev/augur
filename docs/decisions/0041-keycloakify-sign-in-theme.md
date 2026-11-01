# 0041. Sign-in and email pages use a Keycloakify theme in AUGUR's look

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** none

## Context

Sign-in, set-up and email pages show Keycloak's default theme, so people leave AUGUR's look at the most sensitive moment. Keycloak themes are FreeMarker templates; Keycloakify is a maintained open-source tool that builds them from React components.

## Options

1. **Keycloakify**, using the kits' tokens and components. One toolchain with the React kits (ADR 0015).
2. **Hand-written FreeMarker theme.** No new dependency, but a second way of building UI.

## Decision

Option 1. A login and email theme built with Keycloakify from the common kit, shipped as a jar in AUGUR's Keycloak image. The organisation's name and logo come from state, and the theme is localised.

## Consequences

- New dependency `keycloakify` in a new package; Renovate keeps it current.
- Keycloak upgrades check the theme against the new version's templates.

## Links

- Linear PER-180
