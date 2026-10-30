---
"@augur/shell": patch
---

The front door now sends text compressed (gzip): the shell, the kit and apps' bundles go out at about a third of their size (the kit 429 kB → 127 kB). The notification stream isn't compressed, so it's never held back.
