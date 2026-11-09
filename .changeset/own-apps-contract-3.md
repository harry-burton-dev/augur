---
'@augur/registry': minor
'@augur/shell': patch
---

AUGUR's own apps can be on the app contract (ADR 0083): the registry sends such an app's contract 3 manifest, with its role, its kind and whether the floor gauge rests, and the front door serves its frontend from the image at /apps/<id>/<version>/ before the frontends bucket. No own app uses it yet.
