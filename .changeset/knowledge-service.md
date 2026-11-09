---
'@augur/knowledge': minor
'@augur/updater': patch
---

The knowledge graph service runs. It answers at `/api/knowledge/v1`: where you stand (`/floors`), its
action catalogue, the actions retain, hold, keep and confirm-faithful (each needs an Idempotency-Key and
can be a dry run), and an entity and its beliefs as the floors in sight know them. It follows identity
on every call, so someone taken off a team loses that floor within 30 seconds, and it relays its events
as `platform.knowledge.*`. Compose runs it beside a `knowledge-migrate` job, and the updater knows both.
