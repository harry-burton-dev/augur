---
'@augur/events': minor
'@augur/shell': patch
---

The Inbox's Done tab looks back `INBOX_DONE_DAYS` days (30 by default) instead of a fixed 30. `GET /v1/inbox/counts` now says the window as `doneDays` (events API 1.12.0), and the shell's empty Done tab reads its number from there instead of repeating it.
