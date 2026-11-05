---
'@augur/service-kit': minor
---

`outboxBinding` and `readBinding`: an app tells others when one of its things is linked to an entity, or unlinked, in the shape Mandate and Artifacts publish (`<app>.<type>.entity-bound`, ADR 0066), and a follower reads any app's back.
