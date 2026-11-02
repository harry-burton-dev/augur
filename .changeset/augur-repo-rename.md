---
'@augur/updater': patch
'@augur/registry': patch
---

AUGUR's repository is about to be renamed from `im-platform`. The updater and registry now take AUGUR's releases, dev builds and release feed signed under either name, and an app built in AUGUR's repository counts as the same publisher under both. Images and the feed stay at `ghcr.io/harry-burton-dev/im-platform`, so nothing on a server changes. A server needs this release before the rename (docs/upgrade.md).
