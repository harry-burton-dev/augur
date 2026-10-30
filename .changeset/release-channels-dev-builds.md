---
'@augur/registry': minor
'@augur/admin': minor
'@augur/updater': minor
---

Dev builds: every merge into `dev` that changes a runner app builds it as `<next patch>-dev.<run>`, signed on `dev`. A preview server's admin can set an app to **Dev builds too** in Admin → Apps, and the updater takes a backup before each one; production servers refuse them. A migration is frozen once it's on `dev`. Registry contract 1.26.0 (docs/release-channels.md, "Dev builds").
