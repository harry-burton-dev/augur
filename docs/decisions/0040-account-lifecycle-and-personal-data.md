# 0040. Accounts start with an email invite, end through the leaver flow, and idle accounts turn off on their own

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** none

## Context

Today an admin adds a person and reads them a temporary password, turning someone off leaves their sessions running, nobody is told when an account sits unused, and a person can't get a copy of their own data.

## Options

1. **Keycloak runs the lifecycle:** email invites with required actions, Entra first sign-in linked by verified email, temporary lockout, admin turn-off that ends sessions, a leaver flow, Workflows for idle accounts and deletion after retention; no self-delete.
2. **AUGUR builds its own lifecycle jobs.**

## Decision

Option 1. The states are invited, setting up, active, locked, turned off, idle warning, leaver and deleted, plus first sign-in through Entra. Invites are email links that expire in 72 hours; a temporary password is used only where a deployment has no email. Turning someone off ends all their sessions and offline tokens at once. A Keycloak Workflow emails after 60 days without a sign-in and turns the account off at 90, set per deployment. People can't delete their own account; they ask to leave, and an admin's leaver flow turns the account off, ends sessions and sends `person.left` so apps hand on or archive what the person owns. Deletion follows the deployment's retention period and keeps only a pseudonymous id in the audit log. Anyone can download their own data: each service returns that person's data and identity builds one archive, recorded in Activity.

## Consequences

- Identity publishes person events (joined, disabled, left, deleted), closing foundation gap G4.
- Every lifecycle change is recorded in Activity.

## Links

- Linear PER-180
