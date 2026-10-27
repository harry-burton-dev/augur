---
"@augur/service-kit": minor
"@augur/storage": minor
"@augur/identity": minor
---

Apps' secrets can be worked out instead of written into `.env`. With `APP_SECRETS_KEY` set, the storage container works out each app's database password and bucket secret from it and the app's id (`appSecretFor` in the service kit) when `.env` doesn't name them, and the app runner can set an app's sign-in to the secret it works out (`PUT /v1/admin/apps/{id}/credential`, the updater only). Secrets in `.env` still win.
