---
'@augur/mfe-sdk': minor
---

`@augur/mfe-sdk/sdk3` now exports `Ref`, `Marking`, `isRef`, `isMarkingOrNone`, `isIntentCancelled` and the new `isIntentError`, so an app on contract 3 needs nothing from the package root to pass a reference or tell a closed request from a failed one. The checks match by name, as errors cross from the shell. The package root gains `isIntentError` too.
