---
'@augur/service-kit': minor
---

The app-service starter: `startAppService({ manifest, buildApp, jobs })` starts an app's service the one way every app does (listen, jobs, frontend, registration, clean stop), and `appServer` gives its Fastify instance signed callers, problem details and /healthz. `floorCaller` and `signedInCaller` name the app from its manifest; `auditFor`, `notifyFor` and `peopleFor` replace each app's own copies. The create-app template uses them.

Jobs gain `elsewhere(name, { concurrency, workerConcurrency })`: a service can queue runs that another process, such as a Python worker on DBOS, takes off the queue `<app>.<name>`.
