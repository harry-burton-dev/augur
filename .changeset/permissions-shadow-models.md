---
'@augur/models': minor
---

Shadow mode reaches the model gateway (ADR 0085): its admin check (models' settings and usage) is also asked of the permissions service, after it has answered as it always has, and disagreements are counted and logged (docs/observability.md). Its own answer still decides.
