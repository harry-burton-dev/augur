---
'@augur/service-kit': minor
'@augur/app-tools': minor
'@augur/registry': minor
'@augur/gateway': minor
'@augur/admin': patch
'@augur/clients': minor
---

Apps can ask for the knowledge graph in their manifest's `scopes`: `knowledge:read` to read it as the person they act for, `knowledge:act` for its actions apps are granted, and `knowledge:extract` to add what a source says (retain). The gateway lets an app's calls to the knowledge graph through on those scopes, Admin names them when an admin allows an app, and an app's catalog entry names the knowledge API. The knowledge graph itself still refuses apps until its next release, which checks each action's own scope.

Not breaking: registry.openapi.yaml lists three more scopes an app's entry may carry. The list grows as AUGUR adds what apps can be granted, and its readers (Admin, the shell and the registry client) show a scope they don't know by its name.
