---
'@augur/service-kit': minor
'@augur/identity': patch
---

The rest of PER-213:

- **Bounded caches.** The service kit's floor, people and grant lookups now remember at most 5,000 answers each (`BoundedMap`), dropping the least recently used one when full.
- **Paged Keycloak lists.** Identity reads Keycloak's lists of people, groups, group members and role holders 500 at a time, so a realm with more than 10,000 people no longer loses the rest without a word.
- **Query time limit.** `steadyPool` gives each new database connection a statement timeout: a minute by default, set with `DATABASE_STATEMENT_TIMEOUT_SECONDS`, 0 for no limit. A query stuck on a lock or a bad plan now fails its request instead of holding a connection. Migrations lift the limit for themselves.
