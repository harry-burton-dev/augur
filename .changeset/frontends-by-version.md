---
"@augur/registry": minor
"@augur/storage": minor
"@augur/service-kit": minor
"@apps/folio": patch
---

Apps' frontends are kept by version. An app's service gives the registry each version's built frontend before registering it (`publishFrontend` in the service kit, `PUT /v1/apps/{id}/versions/{version}/frontend`), the registry writes it to the new `augur-frontends` bucket that the storage container makes, and the front door serves it from Garage at `/apps/<id>/<version>/`. The manifest the shell is given then points at that version's own copy, so holding an app at an older version in Admin, Apps holds its code too. A version's frontend never changes once given. Folio gives its own on every start. Needs `FRONTENDS_BUCKET_SECRET` in `.env` (docs/upgrade.md); without it apps are served from their manifests' entry as before.
