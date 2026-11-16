---
"@augur/gateway": minor
---

An app's part now gets only the signed caller (`x-augur-caller`), never the plain `x-user-*` headers beside it. A part made from the app template already checks the signed caller (the service kit's `appServer`); one that read the plain headers without the `signedCallers` hook sees nobody signed in: breaking for such a part, which must add the hook. AUGUR's own services still get both.
