---
---

`compose.yml` hands the gateway's `CALLER_SIGNING_KEY`, five services' sign-in secrets, `ALERT_WEBHOOK_TOKEN` and `OPENFGA_TOKEN` to the services that read them as files under `/run/secrets/` (Compose's `secrets:` with `environment:`), so they are no longer in those services' environment. They are still set in `.env`. Docker Compose 2.24 or newer is needed. The deploy test checks each one is in its file and in neither its service's environment nor its log. Part of PER-471.
