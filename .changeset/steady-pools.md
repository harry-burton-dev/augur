---
"@augur/service-kit": minor
"@augur/events": patch
"@augur/identity": patch
"@augur/models": patch
"@augur/registry": patch
---

Services stay up through a Postgres restart: a dropped idle connection is logged (`steadyPool` in the service kit) rather than ending the process, and the events service listens again on a new connection, so open notification streams don't go quiet for good.
