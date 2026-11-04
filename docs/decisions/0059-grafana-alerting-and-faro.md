# 0059. A deployment watches itself with Grafana alerting as files and Faro in the shell, and Backstage watches for silence

- **Status:** Proposed
- **Date:** 2026-11-04
- **Decided by:** Harry
- **Replaces:** none. Builds on [0034](0034-opentelemetry-in-the-service-kit.md) (OpenTelemetry, otel-lgtm), [0019](0019-deployment-reporting.md) (the signed report) and [0044](0044-notifications-contract.md) (notices). Takes the library report's pick of Faro for browser errors over the earlier draft's plain OpenTelemetry browser SDK, as the alpha milestone spec records.

## Context

Alpha goal 23: a deployment watches itself. Nothing tells anyone today when a service stops, when calls start failing, or when an app throws in someone's browser. The services already send OpenTelemetry to otel-lgtm when it runs (ADR 0034), but no alert rule or dashboard ships, and the browser sends nothing. If the whole host goes down, nothing on it can say so.

## Options

For browser errors:

1. **Grafana Faro's web SDK in the shell, sending OTLP through the gateway** with Faro's OTLP HTTP transport. One hook in the shell covers every app. otel-lgtm's collector takes OTLP as it is, so no Alloy is needed.
2. **Faro with its own protocol to Grafana Alloy's `faro.receiver`.** Faro's default path, but another service to run, and an organisation's own collector may not read Faro's protocol.
3. **The plain OpenTelemetry browser SDK.** Standard, but we would write the error capture, the session and the app attribution Faro already has.
4. **Sentry or GlitchTip.** Better grouping, but a stack of its own to run (GlitchTip) or far too heavy for one Compose server (Sentry).

For alerts:

1. **Grafana alerting provisioned as files** on the otel-lgtm stack the deployment already runs. Contact points: email through the relay, and a webhook into AUGUR's notices.
2. **Rules evaluated by the gateway** and sent by the registry. No new parts, but the alert path then fails with the thing it watches.
3. **Prometheus Alertmanager.** Another container.

For the whole host being down: Backstage, off the host, raises the alarm when a deployment's signed report is late.

## Decision

Browser option 1 and alert option 1.

- **Faro in the shell.** `@grafana/faro-web-sdk`, `@grafana/faro-web-tracing` and `@grafana/faro-transport-otlp-http`, loaded only after sign-in and only when the gateway says browser telemetry is on. The shell names the app an error came from (by the `/apps/<id>/<version>/` script path in its stack, or else the app on screen) and its version, and web tracing joins the browser's calls to the services' traces with `traceparent`. No person's id, name or email is sent; page URLs lose their query and fragment.
- **Through the gateway.** The browser sends to `/api/gateway/v1/telemetry/v1/{logs,traces}`, signed in, same origin, capped in size and rate per person. The gateway stamps the resource (`service.name=augur-browser`, the deployment's ring and id), so a browser can't pretend to be a service, and forwards to the collector named by `OTEL_EXPORTER_OTLP_ENDPOINT`. With no collector the shell isn't asked to send.
- **Metrics the alerts read.** The gateway records `augur.component.up` (each part it already polls every 30 seconds) and `augur.gateway.requests` (by `part`, platform or apps, and status class), through the OpenTelemetry API the service kit already loads.
- **Grafana alerting as files** in `infra/deploy/observability/`: the rules with goal 23's thresholds (a part down for two polls; 5xx over 5% of at least 50 calls in 5 minutes, for platform and apps apart; browser errors per app), one alert per incident with a recovery notice, nothing for the first 2 minutes after a start, and one dashboard. otel-lgtm is on for every alpha deployment, with a memory limit and 72-hour retention.
- **Where alerts go.** Email through the deployment's relay (once SMTP lands, PER-189), and a webhook into the registry, which raises a notice to deployment admins. Grafana sits outside the gateway, the notices and the mail path, so it still reports when they are down.
- **Silence.** The registry sends its signed report (ADR 0019) every 15 minutes, not only on a change and once a day. Backstage checks every 5 minutes and, when a deployment's last report is more than 30 minutes old, sends a notification that its email module delivers (`@backstage/plugin-notifications-backend-module-email`), and another when reports resume. Nothing alert-related runs in the updater.

## Consequences

- The shell's bundle grows by Faro, loaded after sign-in so it never delays the first screen. Faro's OTLP transport is marked experimental upstream; if it stalls, option 2 (Alloy) is the way out, with no change to the shell beyond its transport.
- otel-lgtm becomes a part every alpha deployment runs. It's sized for one server; an organisation's own collector still replaces it (ADR 0034), and then its own alerting replaces these files.
- Backstage needs SMTP settings of its own to email. Without them it still shows the notification in the portal.
- Alert thresholds live in the rule files, not in code. A deployment that wants others edits its copy.
- The check: `pnpm test` in the gateway (stamping, limits, metrics), the shell (attribution, scrubbing), the registry (report cadence, webhook) and backstage-hb (late check); `promtool`-style checks aren't run in CI, so the rules are linted by a small YAML test.

## Links

- Linear PER-181 (alpha unit W4.2), PER-189 (SMTP), PER-220 (telemetry from app services).
- Alpha milestone spec, goal 23; library report, 3 November 2026 (M3); SaaS boilerplate comparison, gap 4.
