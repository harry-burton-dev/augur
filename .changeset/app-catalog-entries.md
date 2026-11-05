---
'@augur/app-tools': minor
---

`augur-app catalog` writes an app's Backstage catalog entry, `catalog-info.yaml`, from its manifest and parts, with its kind (`augur.dev/category`); `--check` fails when it's out of date. AUGUR's `catalog/all.yaml` now points Backstage at each shipped app's entry, so apps are back in the catalog since they moved to their own repositories.
