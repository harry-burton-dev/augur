---
"@augur/events": minor
"@augur/service-kit": minor
---

Floor rules for apps are domain events too: `platform.app.blocked` when an admin blocks an app on a floor and those below it, and `platform.app.rule-cleared` when a floor goes back to following the one above. `PLATFORM_TOPICS` names them.
