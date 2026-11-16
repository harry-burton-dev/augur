---
'@augur/mfe-sdk': minor
---

`@augur/mfe-sdk/sdk3` now exports `Ref`, `Marking`, `isRef`, `isMarkingOrNone`, `IntentCancelled`, `IntentError` and `isIntentCancelled`, so an app on contract 3 needs nothing from the package root to pass a reference or tell a closed request from a failed one.
