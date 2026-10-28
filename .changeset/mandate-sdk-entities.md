---
"@apps/mandate": patch
"@apps/mandate-frontend": patch
---

Mandate binds entities through the SDK's shared entity contract (`pickEntities`, `openEntity`, `EntityRef`) instead of its own copies, and takes an entity sent without a label.
