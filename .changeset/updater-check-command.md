---
"@augur/updater": patch
---

`node dist/index.js check` runs one look of the watch after an upgrade on demand: sign-in, AUGUR's calls at the gateway and every part's readiness. It prints what it found as one JSON line and exits 1 when anything is wrong. The deploy test's new `broken` mode uses it to show the watch sees a real failure on real containers.
