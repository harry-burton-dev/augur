---
"@augur/registry": patch
---

Close two address-check bypasses (PER-209). An app's entry is judged as the browser resolves it, so `/\evil.example/x.js` no longer passes as a path on AUGUR, and the manifest schema refuses backslashes and control characters in `entry`. Where an app's service is reached is now an allow-list: on AUGUR's own network only `app-<id>` containers, and never loopback, link-local or Docker's default range, however the address is written.
