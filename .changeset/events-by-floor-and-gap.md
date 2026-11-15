---
"@augur/events": minor
"@augur/service-kit": minor
"@augur/permissions": patch
---

Domain events are read by floor: an app sees only those on floors where it holds events:subscribe, and the deployment's own. A cursor behind what was pruned answers 410 with the oldest kept, and followEvents takes onGap to rebuild (ADR 0104).
