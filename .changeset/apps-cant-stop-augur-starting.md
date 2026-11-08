---
"@augur/storage": minor
"@augur/gateway": minor
---

An app can't stop AUGUR starting or turn back its upgrade (ADR 0073). The storage job sets up the platform's own logins first and skips an app it can't set up, saying why, instead of failing; Compose no longer refuses the whole file over one app's missing secret. Each app's database login holds at most `APP_DATABASE_CONNECTIONS` (30) connections. The restore test passes or fails on AUGUR's own data; an app's schema that doesn't come back is listed under `appsNotRestored`, which Status shows (gateway API 1.9.0). The deploy test takes a backup and runs the restore test on every release.
