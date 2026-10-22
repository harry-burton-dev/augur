---
"@platform/registry": minor
"@platform/admin": minor
"@platform/shell": patch
---

Apps can only load from allowed places. The registry refuses an app whose entry is a full address on a site an admin hasn't allowed (`/v1/origins`, audited as `origin.allowed` and `origin.removed`), and stops offering apps from a site once it's removed, marking them `blocked` in the catalogue. Admin's Apps screen gains "Where apps load from" to add and remove sites, and shows blocked apps. The shell's page is served with a Content Security Policy: scripts only from the platform, its import map and the sites in `APP_ORIGINS`.
