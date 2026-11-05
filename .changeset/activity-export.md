---
"@augur/events": minor
"@augur/admin": minor
---

Activity gets an export and a retention setting (ADR 0040, part of PER-194). Admin → Activity's **Download CSV** gives every entry the filters show, newest first, up to 50,000, from the events service's new `GET /v1/audit/export` (admins, or a lead for their own floor; events contract 1.12.0). Cells a spreadsheet would run as a formula start with an apostrophe, and each export is recorded as `audit.exported`. `AUDIT_KEEP_DAYS` in `.env` sets how long Activity is kept; unset keeps it all, as before. docs/people.md#activity.
