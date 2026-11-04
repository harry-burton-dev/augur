---
'@augur/gateway': patch
---

The gateway's own routes carry TypeBox schemas, and contracts/gateway.openapi.yaml is generated from them (ADR 0055); what it forwards stays out of it.
Its contract now also lists Status's `seeding` (contract 1.5.0).
