---
"@augur/identity": minor
"@augur/registry": minor
"@augur/service-kit": minor
---

Identity and the registry keep each audit entry in their own database first and send it to the events service from there (ADR 0104, PER-414), so an admin's change is audited, and its domain event published, even while the events service is down. The service kit adds `auditOutbox`, `AUDIT_OUTBOX_COLUMNS` and `postAudit`, and `ServiceCallError` carries the `status` the service answered.

Not breaking: everything is added; `ServiceCallError` gains an optional `status` and an optional second constructor argument.
