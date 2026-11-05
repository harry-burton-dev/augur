---
'@augur/events': minor
---

Someone who leaves a team, or whose sign-in is turned off, gives back the team inbox items they had taken: they're open to the team again, written to the audit log, and published as `platform.inbox.released` with `left: true`.
