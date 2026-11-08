---
'@augur/mfe-sdk': major
'@augur/shell': minor
'@augur/registry': patch
'@augur/contract-tests': minor
---

SDK 3: installed apps run only on the app contract (ADR 0075 point 10). An installed app that names an SDK 2 range no longer opens: opening it, and its card on Home, say it was made for an older version of AUGUR, and intents and Find pass it by. The shell's own frontends (Home, Admin, the Upgrade Centre) keep the in-page mount from the same SDK and name `^2.0.0 || ^3.0.0`. An app on the contract that declares `contributes.card` gets its card on Home, drawn by the app into `ctx.frame.card` from a worker of its own (`ctx.surface` is `'card'` there, and a card moves the person or opens another app only just after a press in it); Find asks an app on the contract as itself (`x-augur-app`). The contract tests run against a reference app on the contract.
