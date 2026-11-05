---
'@augur/app-tools': minor
---

The app manifest's JSON Schema ships inside the package, as `@augur/app-tools/manifest.schema.json`. An app's manifest can point `"$schema"` at `./node_modules/@augur/app-tools/manifest.schema.json` and its editor completes and checks the fields, with the schema of the tools it releases with.
