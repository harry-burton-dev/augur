---
'@augur/mfe-sdk': minor
---

Adds `@augur/mfe-sdk/testing`, so an app can be tested without a running AUGUR: `fakeContext` gives a whole mount context that records what the app raised, requested and notified, and `contractHandlers` turns an OpenAPI contract into MSW handlers that answer with its examples.
