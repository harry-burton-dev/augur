# Observability files

What the deployment's Grafana (otel-lgtm, ADR 0034) is given, as files (ADR 0059), mounted by compose:

- `grafana/alerting/rules.yaml`: AUGUR's alert rules. A part down for two health checks; server errors above 5% of at least 50 calls in 5 minutes, AUGUR's and apps' apart; errors in people's browsers; backups that can't be relied on.
- `grafana/alerting/contact-points.yaml`: where alerts go, the registry's webhook (deployment admins get a notice), one per incident.
- `grafana/dashboards/augur.json`: the AUGUR dashboard, loaded by `grafana/dashboards.yaml`.
- `lgtm/loki.yaml`, `lgtm/tempo.yaml`: otel-lgtm's own settings with 72 hours' retention. Compare them with the image's when Renovate moves it.

They read the stack's own data sources (`prometheus`, `loki`) and the metrics the gateway records (docs/observability.md). `scripts/observability.test.mjs` checks both. A deployment that wants other thresholds edits its copy of `rules.yaml`.
