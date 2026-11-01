# 0042. Organisation settings live in identity and are edited in Admin

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** none

## Context

The organisation's name comes from the `ORG_NAME` environment setting, and there is nowhere for a sign-in notice, a logo or a default language and time zone.

## Options

1. **A settings table in identity, edited in Admin → Organisation; `ORG_NAME` becomes the first-start default.**
2. **Environment settings only.**

## Decision

Option 1. Identity stores the organisation's settings and applies the ones Keycloak needs (name, logo, sign-in notice as Terms and Conditions) to the realm. Every change is audited.

## Consequences

- An upgrade note keeps `ORG_NAME` working: it seeds the table once and is then ignored.

## Links

- Linear PER-180
