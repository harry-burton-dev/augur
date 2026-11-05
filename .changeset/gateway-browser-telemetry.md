---
'@augur/gateway': minor
---

The gateway takes browser errors and traces from the shell and passes them on to the deployment's collector, stamped as `augur-browser` and with anything personal taken out (ADR 0059, contract 1.6.0). It also records what the alert rules read: each part's health, calls by part and status class, and whether backups can be relied on.
