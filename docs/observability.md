# Observability

Every AUGUR service sends traces, metrics and logs over OpenTelemetry (ADR 0034), and the shell sends errors from people's browsers (ADR 0059). They go to the deployment's own Grafana stack, otel-lgtm, which keeps them for 72 hours and runs AUGUR's alert rules. Logs still go to `pc logs` either way.

## Turn it on

It's on in every deployment: compose runs otel-lgtm (Grafana's all-in-one OpenTelemetry image) and every service sends to it at `http://otel-lgtm:4318`.

1. In `.env`, set `GRAFANA_ADMIN_PASSWORD` (`openssl rand -hex 16`). `ALERT_WEBHOOK_TOKEN` is required (`openssl rand -hex 32`); an upgrade from the Upgrade Centre makes it up. Then run `pc up -d`. A deployment that had the `observability` profile can take it out of `COMPOSE_PROFILES`; it does nothing now.
2. Grafana answers on the server only, at `http://127.0.0.1:3001`. From your own machine, run `ssh -L 3001:127.0.0.1:3001 <server>` and open `http://localhost:3001`. Sign in as `admin`. AUGUR's dashboard and alert rules are in the AUGUR folder.

It keeps 72 hours of traces, metrics and logs and is held to `OTEL_LGTM_MEM_LIMIT` (2 GB unless set).

To use your organisation's own collector instead (Grafana Cloud, Honeycomb, an OpenTelemetry Collector), set `OTEL_EXPORTER_OTLP_ENDPOINT` to it in `.env`, and `OTEL_EXPORTER_OTLP_HEADERS` if it needs a key (such as `authorization=Basic …`, comma separated). Then turn the deployment's own stack off, as below. Its alerting replaces AUGUR's rule files, which you can copy from `infra/deploy/observability/`.

## Turn it off

- `OTEL_LGTM_REPLICAS=0` in `.env` stops otel-lgtm, for a deployment whose collector is elsewhere.
- `OTEL_SDK_DISABLED=true` stops every service sending, and the shell with it.

Then run `pc up -d`. Without otel-lgtm, nothing on the server raises an alert: Backstage still notices a deployment that stops reporting (below).

## Alerts

Grafana evaluates AUGUR's rules every 30 seconds (`infra/deploy/observability/grafana/alerting/rules.yaml`):

- **A part down:** a service, app or store the gateway checks failed two checks in a row.
- **Server errors:** more than 5% of at least 50 calls in 5 minutes answered with a 5xx, AUGUR's own and apps' counted apart.
- **Browser errors:** more than 20 errors in people's browsers in 15 minutes.
- **Backups:** the last backup or restore test can't be relied on, for 10 minutes.

Each alert, and its all-clear, reaches deployment admins as a notice through the registry (`POST /v1/platform/alerts`, with `ALERT_WEBHOOK_TOKEN`). Grafana sends one notice per incident and repeats a firing one only daily. Email through the deployment's relay joins this once AUGUR has SMTP settings. Grafana sits outside the gateway and the notices, so it still sees them fail; the registry is the one part it needs to tell anyone.

**Prove it works** once on a new server (docs/deploy.md, First start, step 6): in Grafana, under **Alerting → Contact points**, open **AUGUR notices** and press **Test**. Within a minute every deployment admin has a notice in AUGUR. That proves Grafana reaches the registry with the right token and the registry reaches people. From the command line, this sends the registry the same kind of alert Grafana would and prints `202` when it took it:

```sh
pc exec registry node -e "fetch('http://localhost:8082/v1/platform/alerts', { method: 'POST', headers: { authorization: 'Bearer ' + process.env.ALERT_WEBHOOK_TOKEN, 'content-type': 'application/json' }, body: JSON.stringify({ alerts: [{ status: 'firing', labels: { alertname: 'Install test' }, annotations: { summary: 'A test alert: the alert path works' }, startsAt: new Date().toISOString() }] }) }).then((r) => console.log(r.status))"
```

To change a threshold, edit your copy of `rules.yaml` and run `pc restart otel-lgtm`. An upgrade replaces the file, so note what you changed.

**When the whole server is down,** nothing on it can say so. The registry sends its signed report to Backstage every 15 minutes (docs/upgrade.md, Reporting to Backstage), and Backstage raises the alarm when one is more than 30 minutes late.

## What you see

- **Traces:** each request a service answers, the calls it makes to other services (followed across them), and its Postgres queries. Health checks are left out.
- **Logs:** each service's log lines, carrying the trace they belong to, beside the `requestId` they already had.
- **Metrics:** HTTP request counts and durations per service, and Node's own runtime figures.

Each service is named after its package (`registry`, `identity`, `folio`…), with its version. The server's ring (`SERVER_RING`) is set as `deployment.environment.name` and its name (`DEPLOYMENT_ID`) as `deployment.name`, so one collector can take several deployments and still tell them apart.

## Browser errors and traces

The shell runs Grafana Faro (ADR 0059), which catches errors in the browser from the shell and every app, and traces the calls each page makes so they join the services' traces. It sends them through the gateway, signed in, to the same collector (`/api/gateway/v1/telemetry/v1/logs` and `/v1/traces`). The gateway names them `augur-browser`, adds the deployment's own attributes, and takes out anything that could name a person and the query from every URL. Each error says which app it came from (`faro.error.context` holds `app` and `app.version`) and the shell's version (`augur.shell.version`).

It's on whenever the services send. With `OTEL_SDK_DISABLED=true`, the shell sends nothing. In Grafana: Explore, Loki, `{service_name="augur-browser"}`.

## What the alert rules read

The gateway records, as metrics:

- `augur_component_up`: each part it checks every 30 seconds (`component`, `kind`), 1 when it answered, 0 when it's down. Nothing until its first check.
- `augur_gateway_requests_total`: the calls it answered, by `part` (`platform` or `apps`) and `status_class` (`2xx`, `4xx`, `5xx`).
- `augur_backup_ok`: 1 when the last backup and restore test can be relied on, 0 when not. Only when the gateway is told where backups are (`BACKUP_DIR`).

## For a service

Nothing to do. Compose loads `@augur/service-kit/telemetry` before every Node service starts (`NODE_OPTIONS`). An app service built on the service kit gets the same when its compose entry carries the `x-telemetry` settings. Of the standard `OTEL_*` settings, compose passes `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_TRACES_SAMPLER` and `OTEL_TRACES_SAMPLER_ARG` from `.env`, such as `OTEL_TRACES_SAMPLER=parentbased_traceidratio` with `OTEL_TRACES_SAMPLER_ARG=0.1` to keep one trace in ten. Another one needs adding to the `x-telemetry` settings in `compose.yml` and to `infra/deploy/settings.schema.json`.
