---
"@augur/mfe-sdk": minor
---

`SDK_VERSION` is typed as a string, so the SDK's API report no longer holds its value. Version packages PRs no longer fail the API check whenever the SDK's version moves.

Not breaking: the value is unchanged, and code that compared it to a string or passed it on as one compiles as before.
