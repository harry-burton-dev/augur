---
"@platform/ui-kit": major
"@platform/mfe-sdk": minor
"@platform/shell": minor
"@platform/home": patch
"@platform/admin": patch
---

The shell serves the UI kit and Lit once, through an import map, and the shell and every app share that copy. Apps' builds leave `lit`, `lit/*` and `@platform/ui-kit` external using `isSharedModule` from the new `@platform/mfe-sdk/build`, which lists exactly what the shell provides. Home's bundle drops from 208 KB to 1 KB and Admin's from 266 KB to 59 KB. The kit goes to 1.0.0 and keeps the SDK's versioning promise: within SDK 1.x the shell serves kit 1.x and Lit 3.x, and a breaking kit change ships with an SDK major.
