---
"@augur/contract-tests": patch
---

The contract tests wait for states, not clocks (PER-322): the dev server is warmed before the first test, checks on CI wait up to 10 seconds, and Find's budget test no longer races a 4-second stand-in answer.
