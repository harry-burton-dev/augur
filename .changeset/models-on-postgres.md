---
'@augur/models': patch
---

The model gateway keeps its settings and each app's use in Postgres, locally too: its in-memory store is gone, and it won't start without `DATABASE_URL`. Its tests run on real Postgres (PER-271).
