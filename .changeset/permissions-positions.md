---
'@augur/permissions': minor
---

Floors are joined by positions, not people (ADR 0089). A persona is now a position: what it is given stays with it when its holder changes, and whoever holds it has it at once. A person is on their own floor directly; team and department floors list positions. Deployment and org admin still go only to the persona itself, behind a persona session.
