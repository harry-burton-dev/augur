---
'@augur/app-tools': minor
'@augur/registry': minor
---

Manifest 3 keeps the fields it hasn't frozen (`requiredRole`, `links`, `bindings`) under `provisional`, where a registry ignores a field it doesn't know. The top-level ones are still read for one release, with a warning.
