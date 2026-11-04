# Observability files

What the `observability` profile's Grafana (otel-lgtm, ADR 0034) is given, as files (ADR 0059):

- `grafana/alerting/rules.yaml`: AUGUR's alert rules. A part down for two health checks; server errors above 5% of at least 50 calls in 5 minutes, AUGUR's and apps' apart; errors in people's browsers; backups that can't be relied on.
- `grafana/dashboards/augur.json`: the AUGUR dashboard, loaded by `grafana/dashboards.yaml`.

They read the stack's own data sources (`prometheus`, `loki`) and the metrics the gateway records (docs/observability.md). `scripts/observability.test.mjs` checks both. A deployment that wants other thresholds edits its copy of `rules.yaml`.
