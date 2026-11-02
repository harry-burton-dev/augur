---
'@augur/registry': minor
---

A new build of an app version's frontend now takes the old build's place instead of being refused. Each build is kept in a folder of its own (`/apps/<id>/<version>_<digest>/`), so browsers, which keep a folder for good, load the new one straight away. Before this, the workbench and any server that got a rebuilt pillar app (Artifacts, Data Atlas, Explorer) without a version change kept serving the first build it was given: the registry answered 409 and the app's service only logged it. Frontends kept before this stay where they are until their app gives a new build, which happens on its next start. Migration 019 adds the folder.
