# 0057. The realm is kept as code and applied by identity's realm job, which alone holds Keycloak's admin

- **Status:** Proposed
- **Date:** 2026-11-03
- **Decided by:** Harry
- **Replaces:** none. Carries out [0037](0037-keycloak-stays-current.md), [0038](0038-two-step-sign-in-and-password-policy.md) and [0039](0039-profile-in-keycloak-preferences-in-identity.md), and narrows identity's rights under [0006](0006-keycloak-and-identity-service.md).

## Context

Keycloak reads its realm file only on its first start, so every later setting was applied by identity when it started: roles, the brute-force policy and the deployment admins' one-time code flow. To do that identity's own client held `manage-realm`, `manage-users` and `manage-clients`, which in practice made it realm admin (PER-204): one flaw in identity could rewrite sign-in flows, read every client secret and hand out any role.

The alpha plan chose keycloak-config-cli to apply the realm as code, if a build supported Keycloak 26.8 (spec R13). On 3 November 2026 none did: its newest release, 6.5.1, is built for Keycloak 26.5.5, and only an unlabelled `edge` image is newer. The plan's fallback is for identity to reconcile the realm itself.

## Options

1. **keycloak-config-cli 6.5.1 against Keycloak 26.8.** Unsupported pairing; its import is built against 26.5's admin client.
2. **Wait for a keycloak-config-cli build for 26.8.** Holds the alpha's Goal 10 on another project's release.
3. **Identity's realm job.** The realm's settings are declared in identity's `realm.ts` and applied by a one-shot container from identity's image, run on every `up` with Keycloak's master admin. Identity's running service keeps only the rights it uses. No new dependency.

## Decision

Option 3.

- The realm's settings live in `platform/services/identity/src/realm.ts`. The `keycloak-config` service in `infra/deploy/compose.yml` runs them (`dist/realm-job.js`) on every `up`, before identity starts. Each step reads first and changes only what differs, so it can run any number of times. A change made by hand in the console to something it sets is put back.
- The job is the only part of AUGUR that signs in as Keycloak's master admin. Identity's own client holds `IDENTITY_RIGHTS`: `view-realm`, `view-users`, `query-users`, `manage-users`, `query-groups`, `view-clients`, `query-clients` and `manage-clients`. The job sets exactly that list, so `manage-realm` is taken away from older servers. `manage-clients` stays because Admin issues apps' sign-ins at run time.
- Each setting has a floor from ADRs 0037 to 0039. A deployment may be stricter through `REALM_*` settings, never looser; a looser value is ignored with a warning.
- Two-step sign-in for admin roles is one realm role, `two-step-sign-in`, held through `admin` and `deployment-admin` as a composite. The sign-in flow asks its holders for a one-time code in a step of their own unless they signed in with a passkey, so someone with both roles is asked once.
- Passwords are checked against the NCSC's list of the 100,000 passwords most often found in breaches, cut to the entries of 15 characters or more, shipped in `infra/deploy/keycloak/password-blacklists`.
- When a keycloak-config-cli build supports the Keycloak in use, moving to it needs a new record. The declarations in `realm.ts` are the spec to carry over.

## Consequences

- Identity can't change how anyone signs in. Keycloak still doesn't enforce "only a deployment admin can give deployment-admin": identity's code does. Keycloak's fine-grained admin permissions (v2) could hold that line in Keycloak too; that is a follow-up.
- A wrong `KEYCLOAK_ADMIN_PASSWORD` in `.env` stops the job, and so identity. docs/deploy.md ("The realm job") and docs/upgrade.md say so.
- The move to Keycloak 26.8 migrates Keycloak's database and can't be undone; going back is a restore (docs/upgrade.md). The deploy test restores Keycloak's database when the release it goes back to runs a different Keycloak.
- Tests: `realm.test.ts` (floors, rights set exactly, the sign-in flow left alone or rebuilt); the job was run against a live Keycloak 26.8.1, twice (the second run changed nothing), and an admin was asked to set up a code at sign-in while an editor wasn't.
- Recovery codes are turned on as a required action, but the admin roles' step accepts only a code or a passkey for now.

## Links

- Linear PER-188, PER-204, PER-180
- docs/deploy.md, "The realm job"; docs/upgrade.md, "Keycloak 26.8 and the realm job"
