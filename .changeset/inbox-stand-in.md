---
'@augur/shell': patch
'@augur/contract-tests': patch
---

`pnpm dev:app` keeps a stand-in inbox, filled from the browser console, and the contract tests check the Inbox through it: an item shows in the app's words, Open raises its intent, Home lists it, and what the app doesn’t allow stays in the menu saying why. Each Inbox row’s More now opens its menu from a button.
