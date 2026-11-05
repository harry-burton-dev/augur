---
'@augur/events': patch
---

The events service keeps everything in Postgres, locally too: the in-memory copies of its event and inbox stores are gone, and it won't start without `DATABASE_URL`. Its tests run on real Postgres (PER-271).
