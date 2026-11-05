---
'@augur/registry': minor
'@augur/gateway': patch
---

The deployment watches itself (ADR 0059). otel-lgtm now runs in every deployment, keeps 72 hours, and its Grafana loads AUGUR's alert rules (a part down, server errors, browser errors, backups) and dashboard from `infra/deploy/observability/`. Each alert, and its all-clear, reaches deployment admins as a notice through the registry's new webhook (`POST /v1/platform/alerts`, contract 1.32.0, with `ALERT_WEBHOOK_TOKEN`). Before upgrading, set `GRAFANA_ADMIN_PASSWORD` and `ALERT_WEBHOOK_TOKEN` in `.env`; a server with its own collector sets `OTEL_LGTM_REPLICAS=0`. `OTEL_SDK_DISABLED=true` now also stops the shell sending browser errors. See docs/upgrade.md, "The deployment watches itself".
