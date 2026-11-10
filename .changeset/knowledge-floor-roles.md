---
'@augur/knowledge': minor
---

Who settles and who raises on a floor now comes from the permissions service (`PERMISSIONS_URL`), asked as the knowledge service on each request, in batches, for every team floor the person stands on. A role taken away there is gone on the next request. While the permissions service can't answer, nobody settles or raises, and a refusal says an admin sets the roles. Migration 012.
