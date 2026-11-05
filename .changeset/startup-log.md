---
'@augur/service-kit': minor
---

`startupLog(service)`: a service's log for what it says before its Fastify app is up, or in a job with none. The lines are pino's JSON, like Fastify's own, so OpenTelemetry sends them with the service's other logs.
