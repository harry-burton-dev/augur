---
'@augur/registry': patch
'@augur/app-tools': patch
---

AUGUR's repository is now `harry-burton-dev/augur`. The registry reads the release list from the new address by default, and app-tools names it when a release has no `GITHUB_REPOSITORY`. Images and the feed stay at `ghcr.io/harry-burton-dev/im-platform`, and releases signed under the old name are still trusted.
