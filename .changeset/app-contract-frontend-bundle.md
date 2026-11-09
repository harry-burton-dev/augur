---
'@augur/updater': minor
'@augur/registry': minor
---

Installing an app on the app contract brings its frontend: the app runner checks the bundle's signature, pulls it by the digest the release names and gives it to the registry, which keeps it at `/apps/<id>/<version>/`, where the shell loads the app from. Previews get theirs the same way. The registry is on contract 1.41.0.
