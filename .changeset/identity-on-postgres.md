---
'@augur/identity': patch
---

Identity keeps everything in Postgres, locally too: the in-memory copies of its preference, floor and organisation stores are gone, and it won't start without `DATABASE_URL`. Its tests run on real Postgres (PER-271).
