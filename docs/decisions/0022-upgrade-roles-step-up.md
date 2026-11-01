# 0022. Upgrades need a deployment or app admin role and a step-up sign-in

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** none (extends [0006](0006-keycloak-and-identity-service.md))

## Context

Today one `admin` role can do everything in the Upgrade Centre, after entering their password again (`signedInAt`). Organisation deployments will have people who run the deployment, people who own one app, and people who only need to see what's running.

## Options

1. **Deployment admin, app admin (per app) and viewer roles, with Keycloak step-up authentication (OTP) for any change.**
2. **Keep one admin role.**
3. **Option 1 plus a second approver for every production upgrade.**

## Decision

Option 1. Roles are Keycloak realm roles, with the app admin scoped per app. Changing a version, a policy, a pin, a hold or a window asks for a fresh sign-in at a higher level through standard OIDC (`acr_values` and `max_age`), replacing the home-made password check. The step-up window defaults to 5 minutes. Promote to stable and Halt rollout stay with the repository owner in GitHub. A second approver is left optional, off by default.

## Consequences

- Identity creates the roles and the step-up flow in the `platform` realm on start. Existing admins become deployment admins in an upgrade note in docs/upgrade.md.
- Every greyed-out control names the role it needs and who holds it.

## Links

- Linear PER-177
