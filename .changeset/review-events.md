---
'@augur/events': patch
---

Domain-event streams end after a few minutes so the gateway checks the person again. Inbox actions are refused when the item changed since it was checked, overlapping email runs no longer send twice, and each published event is checked against the floor it names.
