---
'@augur/gateway': minor
---

The gateway passes `/api/knowledge/*` to the knowledge graph service (`KNOWLEDGE_URL`), as one of AUGUR's own services. Apps can't call it yet: no app scope reaches it until the knowledge client ships.
