---
'@augur/updater': minor
'@augur/registry': patch
'@augur/admin': patch
---

An app upgrade is watched for 5 minutes after the switch, while the old version still runs. If the new version stops answering, the runner goes back to the old one by itself.
