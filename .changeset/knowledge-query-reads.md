---
'@augur/knowledge': minor
---

The knowledge graph answers the seam's query reads: lookup by identity key, what an extractor may be told is known, the subgraph around an entity, conflicts and possible duplicates, what waits on a floor for you, summaries, a structured query and recall. An entity's beliefs can be read on two clocks (`at`, `known`). A subgraph goes at most `KNOWLEDGE_SUBGRAPH_DEPTH` hops (default 3).
