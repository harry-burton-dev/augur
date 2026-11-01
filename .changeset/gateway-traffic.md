---
"@augur/gateway": minor
---

The gateway counts the calls it answers and its server errors over the last 15 minutes, at GET /traffic, for the updater's watch after an upgrade (ADR 0020). Only the deployment's own network reaches it: the front door forwards only /api/.
