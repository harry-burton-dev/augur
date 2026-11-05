---
'@augur/identity': minor
'@augur/storage': minor
---

Identity answers `GET /v1/notice-settings` for the events service: each person's confirmed address,
language, time zone (theirs, else the organisation's) and choices in Account → Notifications, so
notices can be emailed. Storage gives each platform service a jobs schema of its own.
