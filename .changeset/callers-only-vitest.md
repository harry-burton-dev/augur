---
'@augur/service-kit': patch
---

Callers go unchecked under a test runner only inside Vitest (`NODE_ENV=test` and `VITEST`); `NODE_ENV=test` alone no longer turns the check off. A new script test holds every image stage, compose service and app container to `NODE_ENV=production`.
