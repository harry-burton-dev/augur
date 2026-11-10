---
'@augur/knowledge': minor
---

What people forget in the knowledge graph stays forgotten after a restore. Each forget is written, before it commits, to a ledger on a volume of its own (`knowledge-ledger`, `KNOWLEDGE_LEDGER_DIR`), outside Postgres; on every start the migrate job forgets again what the ledger names and the restored database doesn't, and writes back into the ledger what only the database has. The backup container copies the ledger off the server with each night's dump. Migration 008.
