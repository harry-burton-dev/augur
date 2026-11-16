---
"@augur/registry": minor
"@augur/shell": minor
---

Only AUGUR's own apps load into the shell's page. The registry refuses every contract 2 manifest, with error contract_2, and marks AUGUR's own frontends as the apps that may. The shell opens no other app in its page, and says why. A contract 2 app registered before stays listed and says why it doesn't open.
