---
"@augur/gateway": patch
"@augur/registry": minor
---

A person's plain call to an app on the app contract (no `x-augur-app`: a direct API call, the run suite) is signed for the app's client, `app-<id>`, which its part checks for, instead of the app's bare id, which the part refused. The registry's `GET /v1/apps/:id/grants` says the app's `contract` (contract 1.43.0); the gateway refuses a plain call to any app with 503 in words while the registry can't be asked (it already did, a step later, when it checked the person's catalogue), and refuses one to an app turned off on the floor naming the app, as it does a call the shell's host makes for the app.
