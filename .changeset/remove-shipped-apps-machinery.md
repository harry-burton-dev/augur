---
"@augur/registry": minor
"@augur/updater": patch
"@augur/clients": patch
---

The last of the machinery for apps that ship with AUGUR (ADR 0049) is gone, now that none does (ADR 0075). The release no longer takes apps' releases into AUGUR's images, the updater no longer restarts shipped apps or hands runner-installed apps over to AUGUR, and the registry no longer reads `PILLAR_APPS`: a platform or pillar app's kind is honoured when the app runner installed it from the signed feed. Registry API 1.36.1 marks `ships` and `pillar` deprecated; neither is ever set.
