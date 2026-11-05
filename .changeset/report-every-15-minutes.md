---
'@augur/registry': minor
'@augur/upgrades': patch
---

The registry sends its signed record to Backstage at least every 15 minutes, not once a day, so Backstage can raise the alarm when a deployment goes quiet (ADR 0059). The record's reason for a send with nothing new is `heartbeat` (contract 1.32.0), and the Upgrade Centre calls it the regular record.
