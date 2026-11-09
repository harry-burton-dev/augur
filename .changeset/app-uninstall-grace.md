---
'@augur/registry': minor
'@augur/updater': minor
'@augur/identity': minor
'@augur/storage': minor
'@augur/admin': minor
---

Removing an app from the server takes its sign-in away at once and keeps its data, settings and floors for APP_DATA_GRACE_DAYS (30), then deletes them after a backup; installing it again before then keeps them. A deletion that fails waits longer each time, up to a day, and Admin shows why.
