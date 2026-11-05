---
'@augur/identity': minor
---

Organisation settings (ADR 0042): `GET /v1/organisation` gives the organisation's name, time zone and email sender to anyone signed in and to any service, and `PATCH /v1/admin/organisation` lets an admin change them, audited as `organisation.changed`. The name is the organisation's floor's name, seeded once from `ORG_NAME`. Migration: adds `identity.organisation`.
