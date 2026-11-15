---
"@augur/events": minor
"@augur/service-kit": minor
"@augur/permissions": patch
---

Domain events are read by floor: an app sees only those on floors where it holds events:subscribe, and the deployment's own. A cursor behind what was pruned answers 410 with the oldest kept, and followEvents takes onGap to rebuild. A pushed app whose place was pruned meanwhile gets what is left and the gap is audited (delivery.gap) (ADR 0104).
