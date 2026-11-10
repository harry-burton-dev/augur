---
'@augur/clients': minor
'@augur/knowledge': minor
---

The knowledge graph's client: `connectKnowledge` reads the action catalogue when it connects and binds each action the deployment offers, with a fresh Idempotency-Key per call, and an action it doesn't offer answers a problem naming those it does. `KnowledgeBaseClass` types the base profile's classes. The knowledge API's meta read now lists those classes (`ontology.baseClasses`), its contract names them (`BaseClass`), and an action's body is documented as an object with any fields, as its input schema in GET /actions says.
