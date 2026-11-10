---
'@augur/app-tools': minor
'@augur/registry': minor
'@augur/updater': minor
'@augur/knowledge': minor
'@augur/admin': minor
---

An app names what it needs of the knowledge graph in its `augur-floor-graphs` resource: `classes` (class IRIs) and `actions` (action names). The registry asks the deployment's knowledge graph what it offers when an app is installed, and refuses an install that needs a class or action it lacks, saying which and who can adopt a class. When the knowledge graph can't be asked, it only warns. The knowledge graph's `GET /meta` now lists every class it has (`ontology.classes`), and Admin's review of an install names the classes and actions.
