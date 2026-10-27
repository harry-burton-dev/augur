---
---

Apps outside AUGUR are now released on their own: when an app's version moves, the Release workflow builds and signs its service image and frontend, and makes the GitHub release `app/<id>@<version>` with an `app-release.json` a deployment can install from. New apps from `pnpm create-app` copy their manifest into their build and give the registry their frontend when they start.
