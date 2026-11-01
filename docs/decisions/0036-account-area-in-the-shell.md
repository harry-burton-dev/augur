# 0036. People manage their own account in the shell, through identity, with credentials on Keycloak's screens

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** none (extends [0006](0006-keycloak-and-identity-service.md))

## Context

The shell has an Account view (name, floors, away, sign out) and a separate Settings view (motion, area titles, density, version, keys). Nobody can change their password, set up two-step sign-in or see their sessions. Keycloak offers an account console and an account REST API, but the REST API is internal to Keycloak and changes between versions.

## Options

1. **Shell screens over identity's `/v1/me/*` API; anything that touches a credential opens Keycloak's own screen and returns** (application-initiated actions, `kc_action`).
2. **Link out to Keycloak's account console**, themed. Least work, but a second look and a second place to find things.
3. **Embed Keycloak's account UI library in the shell.** Ties the shell to Keycloak's React version and internal API.

## Decision

Option 1. The shell's Account area is the one place a person manages themselves, in eight sections: Profile; Sign-in and security; Notifications; Appearance and accessibility; Language and region; Home and apps; Privacy and data; About and help. Settings stops being a separate view. Identity owns `/v1/me/*` (profile, sessions, recent sign-ins, linked accounts, preferences, data export) and reaches Keycloak through the admin API with its own realm-only client. Password, code app, passkey, recovery-code and email changes go through `kc_action` and come back with `kc_action_status`. Apps add their own personal settings as a `settings` surface in their manifest, shown as a section; the shell never special-cases an app.

## Consequences

- `contracts/identity.openapi.yaml` gains the `/v1/me/*` endpoints; the shell never calls Keycloak's account REST API.
- Anything a person can't change stays visible and says who can (an Entra user's password says the organisation's sign-in manages it).
- Keycloak's own account console stays reachable for admins but isn't linked for people.

## Links

- Linear PER-180
