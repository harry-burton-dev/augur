---
'@augur/shell': patch
'@augur/events': patch
'@augur/service-kit': minor
---

The task bar shows an app as soon as it is installed. The registry's app.registered and app.updated now reach everyone as platform.app.added and platform.app.updated, and the shell loads its app list again when any platform.app event arrives, keeping the open app open.
