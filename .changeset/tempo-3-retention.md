---
---

Grafana's bundled Tempo (Tempo 3, in otel-lgtm 0.37.0) keeps traces for 72 hours under `backend_worker` instead of the `compactor` key it no longer has, which stopped it starting and kept otel-lgtm restarting.
