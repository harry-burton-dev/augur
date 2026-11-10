---
'@augur/storage': patch
---

Taking an app's bucket away (a retired app, a removed app's data, a preview) leaves its keys, because Garage never takes a deleted key's id back and the id comes from the app's secret: going back to the release before, or installing the app again, sets its storage up with the same secret. When a secret's key was deleted before, the storage job says so and which setting to change.
