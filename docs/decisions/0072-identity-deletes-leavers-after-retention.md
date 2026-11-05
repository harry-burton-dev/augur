# 0072. Identity deletes a leaver's account after the retention period, in a fixed order; Keycloak's Workflows only handle idle accounts

- **Status:** Proposed
- **Date:** 2026-11-05
- **Decided by:** Harry
- **Replaces:** none. It settles how [0040](0040-account-lifecycle-and-personal-data.md)'s "deletion follows the deployment's retention period" is done.

## Context

[0040](0040-account-lifecycle-and-personal-data.md) decided that a leaver's account is deleted once the deployment's retention period has passed, keeping only a pseudonymous id in the audit log. Its Option 1 summary names Keycloak Workflows for both idle accounts and deletion. Idle accounts are now a Keycloak Workflow (`augur-idle-accounts-*`, PER-194). Deletion is different: before the Keycloak user goes, Activity has to lose the person's names, usernames, emails and addresses (`POST /v1/audit/redact` on the events service), and identity has to forget their preferences, requests and team memberships; afterwards apps must hear `platform.person.deleted`. A Workflow `delete-user` step runs inside Keycloak, can't wait for those, and tells nobody when it's done.

## Options

1. **Identity runs deletion itself.** A sweep in identity, beside the scheduled leaver flows, finds leavers whose retention has passed and deletes each in order: redact Activity, tidy identity's own data, delete the Keycloak user, mark the account deleted, then record `person.deleted` (`platform.person.deleted`). Each step is kept, so a failure resumes where it stopped and nothing is forgotten in the wrong order. A deployment admin can also delete a leaver at once.
2. **A Keycloak Workflow `delete-user` step.** Less code in AUGUR, but no ordering, no event and no retry: Activity could keep a deleted person's name, and apps would never hear.

## Decision

Option 1. Identity deletes a leaver's account once `left_at` plus the organisation's leaver retention days (Admin → Organisation, 90 by default, between 7 and 3650) has passed, or when a deployment admin chooses **Delete now** for someone who has left. The steps run in this order and each is kept in `identity.person_lifecycle.deleting_step`: Activity redacted, identity's data tidied, Keycloak user deleted. Only then is the account marked `deleted` and `person.deleted` recorded, whose event `platform.person.deleted { person }` is the last thing anyone hears about them. The person's id (Keycloak's user id) stays as the pseudonymous id in Activity; nothing that maps it back to them is kept. Keycloak Workflows handle idle accounts only.

## Consequences

- An account isn't deleted when the events service can't redact: the sweep tries again every five minutes and logs why, and the Keycloak user stays until redaction has worked.
- Apps that keep a person's details follow `platform.person.deleted` and forget them; the person's id may stay in their records, as it does in Activity.
- Shortening the retention days deletes leavers whose new date has passed at the next sweep. Admin → Organisation says so beside the setting.
- A deleted person can't be brought back. Someone who returns is added again, as a new account.
- Held by identity's tests (`deletion.test.ts`: order, resume, nothing deleted when redaction fails) and the events service's redaction tests.

## Links

- PER-194, PER-194 spec section 9 (project files, specs/account), [0040](0040-account-lifecycle-and-personal-data.md).
