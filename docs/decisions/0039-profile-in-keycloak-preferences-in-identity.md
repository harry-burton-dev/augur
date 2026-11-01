# 0039. Who you are lives in Keycloak's user profile; how AUGUR behaves for you lives in identity

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** none

## Context

The account area needs profile facts (name, email, job title, phone, pronouns, photo, language) and AUGUR preferences (motion, density, notifications, time zone, home). Entra fills some profile facts for federated users.

## Options

1. **Keycloak's declarative user profile for identity facts; identity's preference store for AUGUR behaviour.**
2. **Everything in identity**, copied to Keycloak where sign-in needs it.

## Decision

Option 1. Declared user-profile attributes hold first and last name, email, job title, phone, pronouns, picture (a link to the image in AUGUR storage) and locale, each with who may view and edit it; fields mapped from Entra are read-only. Identity keeps everything about how AUGUR behaves for a person. The `locale` attribute is the one language setting, so sign-in pages and AUGUR agree.

## Consequences

- Identity applies the user-profile configuration on start; a deployment can add attributes.
- The kits read language and time zone from the person, then the deployment, then the browser.

## Links

- Linear PER-180
