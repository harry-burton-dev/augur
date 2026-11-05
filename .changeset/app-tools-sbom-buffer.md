---
'@augur/app-tools': patch
---

`augur-app bundle` no longer fails with `spawnSync docker ENOBUFS` when it attests a service image's SBOM. Reading the SBOM back from `docker buildx imagetools inspect` overflowed Node's 1 MB output limit, which broke app previews and releases on app-tools 0.4.0. It now allows up to 512 MB.
