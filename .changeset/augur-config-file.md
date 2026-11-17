---
"@augur/storage": patch
---

AUGUR's own services read `infra/deploy/config.env`, AUGUR's committed defaults, and then the deployment's `.env` over it (ADR 0107), as a platform host such as Coolify already did, instead of `compose.yml` passing about a hundred settings to each by name. On Coolify they no longer show up as empty variables. An empty `DESKTOP_APP` now means Home; `DESKTOP_APP=none` keeps the desktop bare. The make-secrets job and the preflight say which of the secrets AUGUR makes are still set in `.env`, where every service can see them, so they can come out. Part of PER-507.
