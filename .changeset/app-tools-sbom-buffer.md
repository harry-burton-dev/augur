---
'@augur/app-tools': patch
---

`augur-app bundle` reads an image's SBOM and provenance with room for megabytes, so an app whose service image lists many packages (Artifacts) can release and preview again instead of failing with `spawnSync docker ENOBUFS`.
