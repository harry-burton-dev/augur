---
"@augur/updater": patch
---

The backup container runs the database's own image, with pgvector, so the restore test brings back apps' vector columns (Data Atlas's `atlas.entity_vectors`) instead of failing on them and stopping every upgrade. When an upgrade doesn't go ahead, the updater's log now says why.
