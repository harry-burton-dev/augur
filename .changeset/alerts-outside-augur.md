---
"@augur/registry": minor
---

Alerts can leave the server without AUGUR: Grafana sends every alert to `ALERT_OUTSIDE_URL` too, and a watchdog to `ALERT_HEARTBEAT_URL` every minute, a dead-man switch for the whole server. Unset, each points at the registry's new `POST /v1/platform/alerts/unrouted`, which drops what it gets, and a production server's deployment admins are told weekly until both are set.
