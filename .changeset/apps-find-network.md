---
'@augur/updater': patch
---

The app runner puts apps on the network the updater itself is on, rather than assuming `platform_default`, so installs work when the platform's Compose project has another name. `APPS_NETWORK` in `.env` still wins.
