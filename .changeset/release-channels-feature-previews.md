---
'@augur/mfe-sdk': minor
'@augur/registry': minor
'@augur/shell': minor
'@augur/admin': minor
---

Feature previews (SDK 1.7): an app lists features it's trying in its manifest's `previews` and asks `ctx.previewOn(id)`. Admins choose who gets each in Admin → Apps (off, for those who turn it on, or everyone; opt-in by default on a preview server, off on a production one), people turn opt-in ones on in the shell's Previews, and the shell marks an app with one on. A preview past its `until` day is off for everyone. Registry contract 1.27.0 (docs/release-channels.md, "Feature previews").
