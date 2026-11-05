---
'@augur/events': minor
'@augur/service-kit': minor
'@augur/registry': minor
'@augur/admin': minor
---

The Inbox's items (ADR 0026, PER-146): apps' services put work that waits on a person or a team in their inbox with the new `inbox:write` scope (`inboxItem`, `updateInboxItem`, `getInboxItem` in the service kit), keyed by the app's own id, and close it when it's done or withdraw it. People list theirs (`/v1/inbox`, `/v1/inbox/counts`) and take, release, decline, hand on or mark done; each step is in the item's history and the audit log, and published as `platform.inbox.*`. The notification stream also carries `inbox` events, so the shell's count stays live. Closed items are kept `INBOX_KEEP_DAYS` (90) days. Admin names the scope "Put work in people's inboxes". Events API 1.9.0.
