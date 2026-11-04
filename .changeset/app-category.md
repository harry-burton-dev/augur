---
"@augur/mfe-sdk": minor
"@augur/registry": minor
"@augur/admin": minor
---

Apps that ship with AUGUR now say what kind they are (ADR 0032). SDK 1.11 adds an optional `category` to the manifest (`platform` or `pillar`), with `AppCategory` and `APP_CATEGORIES`. The registry counts Home, Admin and the Upgrade Centre as platform apps, honours the kind only for apps that ship with AUGUR or come from the signed app feed, and reports the kind in force in `/v1/manifest`, `/v1/me/apps` and `/v1/apps`, which also gain `ships` (the old `pillar` stays, deprecated). Admin → Apps shows a Kind column, says the kind in each app's dialog and explains a claim it doesn't honour, and says AUGUR instead of "platform" in what it shows.
