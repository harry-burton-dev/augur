---
'@augur/registry': patch
---

The registry keeps its catalogue only in Postgres: its in-memory store is gone, and its tests run on real Postgres. Run locally, it needs `DATABASE_URL`.
