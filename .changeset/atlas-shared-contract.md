---
'@apps/atlas': minor
'@apps/atlas-frontend': minor
---

Data Atlas keeps the shared entity contract: it handles `entity.pick` (a picker over the asking app), `entity.open` and `entity.explain`; answers `POST /v1/entities/resolve` and `POST /v1/subgraph` as seen from the caller's floor; finds several kinds at once; and tells other apps `atlas.entity.created`, `.changed` and `.retired` through its outbox.
