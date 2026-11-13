---
'@augur/identity': patch
'@augur/knowledge': patch
---

The knowledge service, its migration job and identity's preference store log a lost database connection instead of ending the process when Postgres restarts. The knowledge service's queries now also have the platform's statement timeout (DATABASE_STATEMENT_TIMEOUT_SECONDS, a minute by default), as every other service's do.
