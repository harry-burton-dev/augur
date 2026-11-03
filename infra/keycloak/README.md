# Local sign-in (Keycloak)

`platform-realm.json` is imported when the local stack starts. It holds the `shell` client the shell signs in with, and two people to sign in as:

| Username | Password | Roles | Department |
| --- | --- | --- | --- |
| `alex` | `platform-local-only` | admin, editor | Finance |
| `sam` | `platform-local-only` | editor | Legal |

Departments are Keycloak groups. Tokens for the shell carry `roles`, `departments` and the `platform-api` audience, which is what the gateway checks.

Keycloak only imports a realm that does not exist yet. After changing this file, reset it with `docker compose -f infra/docker-compose.yml rm -sf keycloak` and start the stack again.

Everything else about the realm (password policy, two-step sign-in for admin roles, passkeys, sessions, events, profile fields, the services' sign-ins and identity's rights) is kept as code in `platform/services/identity/src/realm.ts` and applied by the `keycloak-config` container, as on a server (ADR 0057). Run it again after changing that file: `docker compose -f infra/docker-compose.yml up --build keycloak-config`, or `pnpm --filter @augur/identity realm` against Keycloak on localhost. `alex` is an admin, so is asked to set up a code app at first sign-in.

People, departments and roles are managed in the platform's Admin app, which reaches Keycloak through the identity service as its own client, `platform-identity`. The admin console is at http://localhost:8180 (admin / admin) for anything else. None of this is for anywhere but your machine.
