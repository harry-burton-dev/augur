---
'@augur/identity': minor
---

Shadow mode reaches identity (ADR 0085): its admin checks (managing people, deployment admins, apps' sign-ins, the organisation's settings and its security) are also asked of the permissions service, after identity has answered as it always has, and disagreements are counted and logged (docs/observability.md). Identity's own answer still decides.
