---
"@augur/registry": minor
"@augur/shell": patch
---

The registry refuses every contract 2 manifest, with error `contract_2`, and `IN_PAGE_APPS` is gone: only AUGUR's own frontends load into the shell's page. A contract 2 app registered before stays listed and says why it doesn't open. The shell's refusal no longer offers `IN_PAGE_APPS`.
