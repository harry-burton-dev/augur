---
'@augur/events': patch
'@augur/service-kit': patch
---

Jobs start with a login that can't create schemas, as every service and app has on a server. DBOS's first step, `create schema if not exists`, is refused by Postgres from such a login even when the storage service has already made the schema, so the events service didn't start on 0.23.0. The kit now records that step as done when the schema is there.
