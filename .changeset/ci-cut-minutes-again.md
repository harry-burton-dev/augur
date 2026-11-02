---
"@augur/contract-tests": patch
---

CI spends about half the minutes: the push that merges a pull request no longer runs its checks again, jobs a change doesn't need are skipped before they take a runner, an ordinary pull request runs only the oldest and newest frozen SDK builds in the contract tests, the images install the workspace once, and a dev build reuses Folio's worker image when the worker hasn't changed. docs/ci-cd.md describes the whole pipeline.
