---
"@augur/gateway": patch
"@augur/registry": minor
---

A person's plain call to an app on the app contract (no `x-augur-app`: a direct API call, the run suite) is signed for the app's client, `app-<id>`, which its part checks for, instead of the app's bare id, which the part refused. The registry's `GET /v1/apps/:id/grants` says the app's `contract` (contract 1.43.0); the gateway answers 503 for such a call while the registry can't be asked.
