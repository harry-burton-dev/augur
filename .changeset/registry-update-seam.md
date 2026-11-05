---
'@augur/registry': patch
---

AUGUR's upgrade routes move out of the registry's app.ts into their own module, behind a checked seam between the app catalogue and update control (ADR 0067). No route or table changes.
