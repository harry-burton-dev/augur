---
'@augur/mfe-sdk': major
---

SDK 2.0 (PER-264). The shell no longer serves `lit` or `@augur/ui-kit`: `sharedModules` lists React, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-dom`, `react-dom/client`, `@augur/kit-common` and `@augur/app-kit`, and nothing else. Everything else in the SDK is as it was in 1.11. An app built against 1.x that never imported Lit keeps working: widen its manifest's `sdk` range to `^1.x || ^2.0.0` and it opens on a 2.0 shell. An app that imports Lit must move to React and Quill first (docs/build-an-app.md).
