---
'@augur/knowledge': minor
---

Retain takes a source's text instead of what was extracted from it. The knowledge graph asks the model what the text claims, through the models service (`MODELS_URL`), for the floor it is retained on, with the text fenced off from its instructions. What fits is kept as observations, never as belief; a class or predicate the ontology lacks falls back to its generic one and is recorded as a candidate; text that speaks to the system is kept only flagged, so no floor believes it until its owner keeps it. The answer's `extraction` says what was dropped and why. Resolution also matches a unique entity of the same class whose name is nearly the same.
