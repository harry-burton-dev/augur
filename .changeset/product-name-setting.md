---
"@augur/shell": minor
"@augur/identity": minor
---

The product's name is a deployment setting, `ORG_PRODUCT_NAME` (default AUGUR). The web container writes it into the shell's page, so the browser tab says it, and the realm job makes it the realm's display name, so the sign-in pages, Keycloak's emails (their subjects and AUGUR's layout) and passkey prompts show it.
