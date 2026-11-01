---
'@augur/events': minor
---

Every audit entry now keeps `recordedBy`: the service that wrote it, taken from its signed token. An app can still name any actor, but the entry shows which app made the claim. Entries written before this have no `recordedBy`.
