---
'@augur/shell-kit': minor
'@augur/shell': minor
'@augur/contract-tests': patch
---

The shell is drawn in React on Aerie: the band, the floor gauge, the sky and its views (`Shell` with a `ShellModel`), Title and Orbit (`CentreMenu`), the water, and the request and previews dialogs on Common. The shell's own UI no longer uses the Lit kit; `@augur/ui-kit` is still served to apps through the import map until SDK 2.
