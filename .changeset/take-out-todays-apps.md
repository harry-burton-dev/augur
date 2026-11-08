---
"@augur/storage": minor
"@augur/registry": minor
---

No app ships with AUGUR any more (ADR 0075): Artifacts, Explorer, Data Atlas and Mandate are taken out of the compose files, the release and the contract tests, to be redesigned under the app contract and installed from the app feed. Their data goes with them, after the upgrade's backup: the storage job takes away the schemas, logins and buckets of the apps in `RETIRED_APPS`, once on each server, keeping any that `APP_STORAGE` still names, and the registry's migration `023_retire_shipped_apps` forgets them. Their guides and settings are gone; docs/upgrade.md says what an admin can tidy up.
