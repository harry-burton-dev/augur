---
'@augur/updater': minor
---

Apps that live in their own repositories (release/app-repos.json, ADR 0047) are trusted from there: the updater takes each such app only as signed by its own repository, and the release feed lists that repository's releases of it. No app is listed yet, so nothing changes on a server until one moves.
