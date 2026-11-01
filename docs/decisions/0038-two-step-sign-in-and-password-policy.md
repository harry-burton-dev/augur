# 0038. Two-step sign-in is required for admin roles and offered to everyone; passwords follow NIST SP 800-63B

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** none (extends [0022](0022-upgrade-roles-step-up.md))

## Context

Only deployment admins must use a one-time code today. Plain admins change every person and app with a password alone, and the realm has no password policy.

## Options

1. **Required for admin roles, optional for everyone, each deployment can require it for all; passkeys and recovery codes offered.**
2. **Optional for everyone.**
3. **Required for everyone from day one.** Hard for a pilot with no email yet.

## Decision

Option 1. Admin, deployment admin and app admin roles need a code app or a passkey. Everyone else may add either. Recovery codes are offered as soon as a code app is set up. Passwords are at least 15 characters, are not the username or email, are checked against a breached-password list, and are never forced to change on a schedule or to mix character kinds. Entra users sign in through Entra and have no Keycloak password. All of it is set per deployment within these floors.

## Consequences

- Identity applies the policy and the conditional flow to the realm on start, beside the existing deployment-admin flow.
- Existing admins are asked to set up two-step sign-in at their next sign-in.

## Links

- Linear PER-180
- NIST SP 800-63B revision 4
