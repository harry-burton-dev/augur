---
---

Artifacts' rendition worker sends its traces and logs to the deployment's telemetry stack like the services do. Compose now passes it the shared `OTEL_*` settings, so `OTEL_SDK_DISABLED=true` turns it off too.
