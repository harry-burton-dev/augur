---
'@augur/knowledge': minor
---

The knowledge graph writes each floor's summary of an entity from that floor's own beliefs, through the models service, once they have been quiet for `KNOWLEDGE_REFLECT_DEBOUNCE_SECONDS` (600). It writes at most `KNOWLEDGE_REFLECT_DAILY_BUDGET` (400) a day, and `KNOWLEDGE_REFLECT_FLOOR_BUDGET` (100) on any one floor, counted from the audit so a restart doesn't spend a day twice. Whatever waits shows as older than its beliefs. A floor where models are refused is left alone for the day, and the models service's daily limit stops it until midnight UTC. Migration 009.
