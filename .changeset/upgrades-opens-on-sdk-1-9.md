---
'@augur/registry': patch
---

The Upgrade Centre opens again: its manifest entry asked for SDK ^1.10.0, which this AUGUR doesn't speak until the next release, so the shell wouldn't open it. It now asks for ^1.9.0, and a test checks every platform app asks for an SDK its own AUGUR speaks.
