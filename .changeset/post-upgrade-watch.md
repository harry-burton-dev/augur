---
"@augur/updater": minor
"@augur/registry": minor
"@augur/admin": patch
"@augur/upgrades": patch
---

After an upgrade to a newer release, the updater watches it for 10 minutes before calling it done: sign-in must keep answering and no more than 5% of the gateway's calls may fail (ADR 0020). If either fails it goes back by itself, unless a breaking release lies between, when it leaves the release running and says so. The registry asks for the watch with each forward upgrade, and the new watch step is listed.
