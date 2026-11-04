---
'@augur/service-kit': minor
'@augur/events': patch
'@augur/identity': patch
'@augur/models': patch
'@augur/registry': patch
---

The service kit has one migration runner, `runMigrations(pool, { schema, migrations })`, and the events, identity, models and registry services use it in place of their own copies; what they do at start is unchanged. New migrations are linted with Squawk (ADR 0053), which catches drops, renames and type changes the old check missed.
