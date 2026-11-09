---
"@augur/app-tools": patch
---

`augur-app describe` with no bundle names the placeholder image of a part built from the repository where the build would push it (`IMAGE_REPO`, or ghcr.io under `GITHUB_REPOSITORY`), so the release passes the part schema's image rule; before, the placeholder was refused, so `describe` failed on any contract 3 app with such a part.
