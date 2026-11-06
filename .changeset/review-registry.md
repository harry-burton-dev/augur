---
'@augur/registry': minor
---

An upgrade only takes settings it adds, never what the server trusts. App feeds refuse replays, automatic upgrades and updates hold while a feed has a problem or has expired, a production server refuses unpromoted app releases, an app an admin removed can't register itself back, and a failed report no longer stops the registry.
