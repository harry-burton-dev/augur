# Observability

Every AUGUR service can send traces, metrics and logs over OpenTelemetry (ADR 0034). It's off until you name a collector. Logs still go to `pc logs` either way.

## Turn it on

To keep everything on the server itself, use the stack that ships with AUGUR, which is Grafana's all-in-one OpenTelemetry image:

1. In `.env`, set `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-lgtm:4318`. Also set `GRAFANA_ADMIN_PASSWORD` (`openssl rand -hex 16`).
2. Add `observability` to `COMPOSE_PROFILES` in `.env`, beside `updater` if it's there (`COMPOSE_PROFILES=updater,observability`). Then run `pc up -d`. Upgrades from the Upgrade Centre keep it running.
3. Grafana answers on the server only, at `http://127.0.0.1:3001`. From your own machine, run `ssh -L 3001:127.0.0.1:3001 <server>` and open `http://localhost:3001`. Sign in as `admin`.

To use your organisation's own collector instead (Grafana Cloud, Honeycomb, an OpenTelemetry Collector), set `OTEL_EXPORTER_OTLP_ENDPOINT` to it in `.env`, and `OTEL_EXPORTER_OTLP_HEADERS` if it needs a key (such as `authorization=Basic …`, comma separated). Leave the profile off.

To turn it off again, empty `OTEL_EXPORTER_OTLP_ENDPOINT`, take `observability` out of `COMPOSE_PROFILES`, and run `pc up -d --remove-orphans`.

## What you see

- **Traces:** each request a service answers, the calls it makes to other services (followed across them), and its Postgres queries. Health checks are left out.
- **Logs:** each service's log lines, carrying the trace they belong to, beside the `requestId` they already had.
- **Metrics:** HTTP request counts and durations per service, and Node's own runtime figures.

Each service is named after its package (`registry`, `identity`, `folio`…), with its version. The server's ring (`SERVER_RING`) is set as `deployment.environment.name`, so one collector can take several deployments and still tell them apart.

## Browser errors and traces

The shell runs Grafana Faro (ADR 0059), which catches errors in the browser from the shell and every app, and traces the calls each page makes so they join the services' traces. It sends them through the gateway, signed in, to the same collector (`/api/gateway/v1/telemetry/v1/logs` and `/v1/traces`). The gateway names them `augur-browser`, adds the deployment's own attributes, and takes out anything that could name a person and the query from every URL. Each error says which app it came from (`faro.error.context` holds `app` and `app.version`) and the shell's version (`augur.shell.version`).

It's on whenever a collector is named. Without one, the shell sends nothing. In Grafana: Explore, Loki, `{service_name="augur-browser"}`.

## What the alert rules read

The gateway records, as metrics:

- `augur_component_up`: each part it checks every 30 seconds (`component`, `kind`), 1 when it answered, 0 when it's down. Nothing until its first check.
- `augur_gateway_requests_total`: the calls it answered, by `part` (`platform` or `apps`) and `status_class` (`2xx`, `4xx`, `5xx`).
- `augur_backup_ok`: 1 when the last backup and restore test can be relied on, 0 when not. Only when the gateway is told where backups are (`BACKUP_DIR`).

## For a service

Nothing to do. Compose loads `@augur/service-kit/telemetry` before every Node service starts (`NODE_OPTIONS`). An app service built on the service kit gets the same when its compose entry carries the `x-telemetry` settings. Of the standard `OTEL_*` settings, compose passes `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_TRACES_SAMPLER` and `OTEL_TRACES_SAMPLER_ARG` from `.env`, such as `OTEL_TRACES_SAMPLER=parentbased_traceidratio` with `OTEL_TRACES_SAMPLER_ARG=0.1` to keep one trace in ten. Another one needs adding to the `x-telemetry` settings in `compose.yml` and to `infra/deploy/settings.schema.json`.
