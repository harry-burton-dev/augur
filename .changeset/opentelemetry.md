---
'@augur/service-kit': minor
---

OpenTelemetry for every service (ADR 0034): `@augur/service-kit/telemetry` sends traces, metrics and logs over OTLP once `OTEL_EXPORTER_OTLP_ENDPOINT` names a collector, and does nothing until then. Compose loads it before each Node service and has an optional `observability` profile with Grafana's all-in-one stack. See docs/observability.md.
