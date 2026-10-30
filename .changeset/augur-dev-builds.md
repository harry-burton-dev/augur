---
"@augur/registry": minor
"@augur/updater": minor
"@augur/admin": patch
---

AUGUR dev builds: every merge into `dev` that changes AUGUR is built, signed and released as the pre-release `augur@<next patch>-dev.<run>`, and the workbench (`SERVER_RING=dev`) takes each one by itself, after a backup, when nothing needs a person. The registry's new `dev` channel (`RELEASE_CHANNEL=dev`, the workbench's default) follows dev builds and every release; the updater checks a dev build's signature against the AUGUR dev builds workflow on `dev` and refuses one on any other server (docs/release-channels.md, "AUGUR dev builds").
