# 0035. AUGUR sends email through the organisation's own SMTP relay

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** none

## Context

AUGUR sends no email today. Keycloak has no SMTP server, so nobody can reset a forgotten password, invites are temporary passwords passed on by hand, and notifications reach only people looking at the shell. Deployments run on an organisation's own servers, may be air-gapped (ADR 0023) and sit behind Tailscale.

## Options

1. **The organisation's SMTP relay, set per deployment.** Standard, no vendor, works on a closed network.
2. **A mail vendor's API.** Better delivery reporting, but a vendor, an outbound dependency and a contract per organisation.
3. **No email.** Keeps every gap above.

## Decision

Option 1. Each deployment sets an SMTP host, port, user, password (`*_FILE` secret) and sender address through service-kit config. Identity writes them into the `platform` realm on start, so Keycloak sends verification, reset, invite and lifecycle emails. The events service sends notification emails and digests through the same relay. Without email settings AUGUR still works, and every screen that would send email says so and falls back (for example a temporary password).

## Consequences

- Admin → Status shows whether email works and when it last sent.
- Email templates follow the sign-in theme (ADR 0041) and use the organisation's name from state, never a literal.
- Harry adds the relay settings to each deployment's .env once the email PR lands.

## Links

- Linear PER-180
