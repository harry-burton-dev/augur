---
"@platform/service-kit": minor
"@platform/registry": minor
"@platform/events": minor
"@platform/identity": minor
"@apps/library": patch
---

Apps sign in to the platform as themselves. An admin issues an app's own sign-in with `POST /v1/admin/apps/{id}/credential` on identity, which makes (or gives a new secret to) the Keycloak client `app-<id>`: client credentials only, 5-minute tokens for the `platform-services` audience, audited without the secret. The app's service gets it as `SERVICE_CLIENT_SECRET`; the service kit's `appCredentialsFromEnv`, `clientCredentials` and `serviceVerifier` sign in and check those tokens, and `notify`, `recordAudit` and `callService` can name the floor a call is for. Manifests gain `scopes` (`notifications:send`, `audit:write`). The registry lets an app register only itself, and tells platform services what an app is granted (`GET /v1/apps/{id}/grants?workspace=`): for now, what its manifest asks for on every floor, and nothing while it is off. Events lets an app notify and write the audit log only for itself and only with the scope on the call's floor (403 otherwise, 503 while it can't be checked), keeping each answer for 30 seconds. The shared `SERVICE_TOKEN` still works for now. The Library and new apps from `pnpm create-app` sign in as themselves when they have a secret.
