# 0034. Services send OpenTelemetry through the service kit, off until a collector is named

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry (took the recommended defaults for the foundation gaps)

## Context

Following one request across the gateway, identity, the registry and an app takes `pc logs` across several services, matched by `requestId`. Nothing measures latency or errors per service. The organisation's private cloud will have its own monitoring and will expect a standard feed. A demo server or a single workbench has none.

## Options

1. **OpenTelemetry in the service kit, exported over OTLP, plus an optional all-in-one Grafana stack (`grafana/otel-lgtm`) as a compose profile.** It's the vendor-neutral standard, and any backend takes it.
2. **Prometheus metrics endpoints and Loki for logs.** Traces would come later, and it ties us to one stack.
3. **Keep logs only.**

## Decision

Option 1.

- `@augur/service-kit/telemetry` starts the OpenTelemetry Node SDK. It instruments incoming and outgoing HTTP (except `/healthz`), `fetch`, Postgres and the services' pino logs. Compose loads it before every Node service with `NODE_OPTIONS=--import`, so services need no code of their own.
- It does nothing unless `OTEL_EXPORTER_OTLP_ENDPOINT` (or the traces endpoint) is set. All the other standard `OTEL_*` settings apply.
- Each service is named after its package and carries its version. A deployment's ring is set as `deployment.environment.name`.
- The `observability` compose profile runs `grafana/otel-lgtm` on the server, with Grafana bound to localhost only. A deployment that has its own collector skips the profile and points the endpoint at that collector instead.
- Dependencies: `@opentelemetry/sdk-node`, `@opentelemetry/api`, `@opentelemetry/instrumentation` and the http, undici, pg and pino instrumentations. These are chosen one by one, not the auto-instrumentations bundle, to keep images small.

## Consequences

- Trace context moves between services through the standard `traceparent` header, alongside `x-request-id`.
- Every service image grows by the SDK, a few MB. With telemetry off, the SDK isn't even loaded.
- A stopping service sends what it still holds for up to 3 seconds before it exits.
- The otel-lgtm image is for one server and keeps its data in one volume. It isn't a production monitoring stack: the organisation's own collector is.
- Apps in their own repositories get the same through the service kit and `x-telemetry` in their compose entry.

## Links

- Foundation gap analysis, 27 October 2026: decision D7.
- docs/observability.md.
