---
'@augur/knowledge': minor
---

The knowledge graph takes calls from apps acting for a person, held to what the app is granted: a read needs `knowledge:read`, an action its own scope (`retain` is `knowledge:extract`), and `hold` and `keep` are refused to every app, since they are the person's to take in AUGUR. `retain` is now granted to apps by default in the catalogue: its own scope is the grant.
