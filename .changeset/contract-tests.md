---
"@platform/contract-tests": minor
"@platform/shell": patch
---

Contract tests: a reference app that uses every part of the mount context, opened in the real shell in a browser and checked, both as built today and as built against each earlier SDK minor (kept in `platform/contract/frozen/`, starting with 1.0). A CI job runs them, so a shell or SDK change that breaks an app fails CI. The shell's dev-app mode takes `DEV_APP_ENTRY` to mount a built entry instead of the source.
