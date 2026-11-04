---
'@augur/service-kit': minor
'@augur/storage': patch
---

Background and scheduled jobs for services: `createJobs` in the service kit, on DBOS Transact (ADR 0014). Runs are durable, queued runs go to one instance, scheduled ones run once per tick, and each run that ends is recorded in the audit log. The storage service gives each app a `<id>_jobs` schema to keep them in.
