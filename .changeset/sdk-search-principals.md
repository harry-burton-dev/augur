---
'@augur/mfe-sdk': minor
'@augur/identity': minor
---

People and teams for the people picker. Identity answers a signed-in person at `GET /v1/me/directory` (API 1.15): people by name or email and teams by name, or named by id. The SDK's new `searchPrincipals` and `namePrincipals` ask it through `ctx.fetch` and answer in the shape Quill's `PeoplePicker` takes, so an app hands one straight to the other. They reject with `DirectoryUnavailable`, whose message can be shown as it is.
