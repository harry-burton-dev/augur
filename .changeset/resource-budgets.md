---
'@augur/updater': minor
---

Each app's part runs with at most 256 processes and is the first the kernel stops when the server runs out of memory (`oom_score_adj` 500), before AUGUR's own services and Postgres (PER-414). Every container AUGUR builds gets a memory limit (`SERVICE_MEM_LIMIT`, 1g) and a process limit (`SERVICE_PIDS_LIMIT`, 512).
