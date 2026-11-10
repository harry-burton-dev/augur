# @augur/clients

## 0.2.0

### Minor Changes

- 7044a09: The knowledge graph's client: `connectKnowledge` reads the action catalogue when it connects and binds each action the deployment offers, with a fresh Idempotency-Key per call, and an action it doesn't offer answers a problem naming those it does. `KnowledgeBaseClass` types the base profile's classes. The knowledge API's meta read now lists those classes (`ontology.baseClasses`), its contract names them (`BaseClass`), and an action's body is documented as an object with any fields, as its input schema in GET /actions says.
- 2a581f5: The knowledge graph's contract is now checked against the running service: Schemathesis sends it the requests the contract allows, on main, and CI stops a pull request that would break a contract's callers within a major (oasdiff). What the first run found is fixed: a clock with an offset wider than Postgres takes, or before year 1, no longer fails a read; a floor id or IRI as long as the contract allows no longer answers 414; a NUL character in a text answers 422, not 500; and errors are documented as `application/problem+json`, as they were always sent. A source text goes in a body to the new POST /floors/{floor}/known-entities, since a long one doesn't fit a URL; the GET stays, deprecated, until /v2.

  Not breaking: knowledge.openapi.yaml no longer lists Turtle and TriG for the export's and the shapes' errors, which the service never sent: they were always `application/problem+json`.

- d2ce7c9: Apps can ask for the knowledge graph in their manifest's `scopes`: `knowledge:read` to read it as the person they act for, `knowledge:act` for its actions apps are granted, and `knowledge:extract` to add what a source says (retain). The gateway lets an app's calls to the knowledge graph through on those scopes, Admin names them when an admin allows an app, and an app's catalog entry names the knowledge API. The knowledge graph itself still refuses apps until its next release, which checks each action's own scope.

  Not breaking: registry.openapi.yaml lists three more scopes an app's entry may carry. The list grows as AUGUR adds what apps can be granted, and its readers (Admin, the shell and the registry client) show a scope they don't know by its name.

## 0.1.1

### Patch Changes

- 699af61: Followers can't miss an event, and leavers can't be lost. Publishers take turns on a lock only the events login can touch, so seq order is commit order and a long transaction elsewhere no longer stalls followers. An audit entry, its domain event, and each inbox step are one transaction, and `recordAudit` sends an `Idempotency-Key`, so a retry keeps one entry (contract 1.15.0, migrations `013_one_write_each`, `014_forget_notes`). The events channels carry ids only and ignore anything else. A night identity can't give Activity's retention removes nothing. A leaver's team items that couldn't go back are retried. Leaving now and Delete now answer 503 when Activity can't be reached and carry on within five minutes, and a heir who can't sign in any more is passed over and admins told. Deletion also takes a leaver's note (`note` is in `PERSONAL_DETAIL_KEYS`), the notice that they asked to leave, their inbox notes and open items, and, in the registry, their name on upgrades (`GET /v1/people/{id}/data`, contract 1.36.0, migrations `022_followed_events`, `lifecycle_006_carry_on`). Entra's first sign-in no longer links an account holding a two-step role, and a flow that isn't whole is rebuilt. A removed app can't publish a frontend. Gateway refusals use an app's name, not its id. The service kit adds `followLeavers`, `readPersonLeft`, `readPersonDeleted`, `eventCursor`, `EVENT_CURSOR_TABLE_SQL` and `leaveNoticeKey`; the outbox keeps `refused_at` and `refused_why`. Followers keep their place past events they don't follow (`next`). No app has to change.
- bd8ff7e: The last of the machinery for apps that ship with AUGUR (ADR 0049) is gone, now that none does (ADR 0075). The release no longer takes apps' releases into AUGUR's images, the updater no longer restarts shipped apps or hands runner-installed apps over to AUGUR, and the registry no longer reads `PILLAR_APPS`: a platform or pillar app's kind is honoured when the app runner installed it from the signed feed. Registry API 1.36.1 marks `ships` and `pillar` deprecated; neither is ever set.

## 0.1.0

### Minor Changes

- 2d03cbe: A new package, @augur/clients: a typed client for each platform API, generated from contracts/*.openapi.yaml with openapi-typescript and called with openapi-fetch, through the gateway at /api/<service>/v1 unless told otherwise.
