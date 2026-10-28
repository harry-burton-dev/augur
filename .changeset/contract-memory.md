---
"@augur/contract-tests": patch
---

The contract tests run as many builds of the reference app at once as the machine's memory allows (about 2.5 GB each), so a smaller CI runner no longer has one killed part way through.
