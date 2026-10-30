---
"@augur/registry": patch
---

The release feed keeps AUGUR's dev builds under `devBuilds`, apart from its releases, and the registry reads both. A registry from before dev builds reads only `releases`, so it took the newest dev build for the newest beta, offered it on Admin → Updates, and its updater then refused the images (signed by the dev builds workflow, not the Release workflow). Those servers no longer see dev builds at all.
