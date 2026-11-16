---
'@augur/mfe-sdk': minor
'@augur/shell': minor
'@augur/identity': minor
---

When more than one app handles an intent, the person chooses which opens it, the first time, and the shell keeps the choice with their preferences (`intentApps`, identity's contract 1.35.0). Account lists each choice under Home and apps, to forget. Before, the app first by id won. The SDK adds `intentHandlers` and deprecates `resolveIntent`, which settles a clash by manifest order.
