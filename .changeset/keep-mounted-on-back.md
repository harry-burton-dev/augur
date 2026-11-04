---
"@augur/mfe-sdk": minor
"@augur/shell": minor
"@augur/registry": minor
---

Back and Forward inside an app no longer throw away what it holds (PER-308). SDK 1.11 adds `followsAddress` to the manifest, for an app that follows the address itself, and an optional `navigated(el, path)` on the app. While such an app stays open on the same floor and nothing is waiting for it, the shell keeps it mounted on a move inside its route and calls `navigated` with the new path; an intent, a request, another floor or a changed preview still mounts it again. The registry accepts the flag (contract 1.33.0), and Admin and the Upgrade Centre set it.
