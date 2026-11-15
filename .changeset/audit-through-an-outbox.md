---
"@augur/identity": minor
"@augur/registry": minor
"@augur/service-kit": minor
---

Identity and the registry keep each audit entry in their own database first and send it to the events service from there (ADR 0104, PER-414), so an admin's change is audited, and its domain event published, even while the events service is down. The service kit adds `auditOutbox` and `AUDIT_OUTBOX_COLUMNS`.

Not breaking: `auditOutbox` and `AUDIT_OUTBOX_COLUMNS` are new; nothing is removed or changed.
