---
---

Compose: every container AUGUR builds now runs with no Linux capabilities, can't gain privileges, and has an init that passes on Docker's stop signal. Each service has a healthcheck on its `/healthz`, so `pc ps` shows which are healthy.
