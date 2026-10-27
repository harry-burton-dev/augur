---
"@augur/registry": minor
"@augur/gateway": minor
"@augur/updater": minor
"@augur/storage": minor
"@augur/admin": minor
---

Pull requests that change an app get previews: the App previews workflow builds, signs and releases each push as `<x.y.z>-pr.<n>.<run>`, and a server with the app installed runs the newest build beside it (at most three per app, for a week after the last build, gone when the pull request closes) with scratch storage of its own. An admin names an app’s developers in Admin → Apps; each developer can switch to a preview for themselves (`/v1/previews`), which gives them its frontend and sends their calls to it, while everyone else stays on the installed version.
