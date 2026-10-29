---
'@augur/contract-tests': patch
---

The contract tests run as many builds of the reference app at once as the machine's cores allow as well as its memory (two cores each), so a small CI runner no longer starves them into timeouts. `CONTRACT_AT_ONCE` sets the number outright.
