---
"@platform/events": minor
"@platform/admin": minor
"@platform/registry": minor
---

Activity in Admin: the audit log, readable. Events' `GET /v1/audit` gains `since` and `until` (a time range) and `before` (the id of the oldest entry shown, for the next page); API 1.1.0. Admin's new Activity screen, under Platform, lists every change newest first as a sentence ("Alex Rivera added Sam Okafor to Finance"), filters by who, where and when (today, 7 days, 30 days, any time, or between two dates), shows 50 at a time with Show older, and opens any change to see everything recorded about it.
