---
---

AUGUR's release feed lists Artifacts' releases from its own repository (release/app-repos.json, ADR 0047). The list of apps in their own repositories can now be the repository's APP_REPOS Actions variable instead, changed in GitHub's settings with no pull request; the Release feed and Promote to stable workflows read it before the file.
