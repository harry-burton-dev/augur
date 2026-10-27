---
'@augur/updater': minor
---

Checks signatures offline when the deploy folder has a copy of Sigstore's trust root (`releases/trusted_root.json`), which the mirror script now writes. The mirror script also mirrors apps' releases (`mirror-release.mjs apps`) into a feed for `APP_FEED_URL`.
