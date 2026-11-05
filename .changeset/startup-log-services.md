---
'@augur/events': patch
'@augur/identity': patch
'@augur/models': patch
'@augur/registry': patch
'@augur/storage': patch
'@augur/updater': patch
---

What these services say as they start, and the storage and realm jobs as they run, goes through the service kit's `startupLog` instead of `console`: the same JSON lines as the rest of their logs, sent to the deployment's telemetry stack with them.
