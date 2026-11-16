---
"@augur/gateway": minor
---

An app's part now gets only the signed caller (`x-augur-caller`), never the plain `x-user-*`, `x-workspace-*` and acting-app headers beside it. A part made from the app template already checks the signed caller (the service kit's `appServer`); one that read the plain headers without the `signedCallers` hook sees nobody signed in until it adds the hook. No app on the app contract is affected. AUGUR's own services still get both.
