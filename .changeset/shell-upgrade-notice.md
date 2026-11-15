---
'@augur/shell': minor
---

An open tab learns that AUGUR was upgraded or rolled back under it, and offers a reload. The build writes `shell-build.json` beside the page; the shell compares it with its own build when the tab comes back into view and when its notification stream reconnects, and says once, as a notification that needs you, whether the deployment was upgraded, went back, or changed, with a Reload button.
