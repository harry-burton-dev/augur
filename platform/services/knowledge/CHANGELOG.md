# @augur/knowledge

## 0.3.0

### Minor Changes

- 3f93b58: AUGUR's services stop cleanly and say when they are ready. The service kit's `serve()` runs each one: `GET /readyz` answers only once its database (and, for permissions, OpenFGA) answers, and on SIGTERM a service stops taking new calls, ends its open event streams, lets the calls in flight finish for up to `SHUTDOWN_GRACE_SECONDS` (20), closes its pools, then sends its telemetry. Compose's healthchecks ask `/readyz`, and Docker waits 30 seconds for a service to stop.

### Patch Changes

- 22ab7d3: The knowledge service, its migration job and identity's preference store log a lost database connection instead of ending the process when Postgres restarts. The knowledge service's queries now also have the platform's statement timeout (DATABASE_STATEMENT_TIMEOUT_SECONDS, a minute by default), as every other service's do.
- Updated dependencies [3f93b58]
  - @augur/service-kit@0.21.0

## 0.2.1

### Patch Changes

- Updated dependencies [5243f84]
- Updated dependencies [e5a1e2b]
- Updated dependencies [eb53688]
- Updated dependencies [4442766]
  - @augur/service-kit@0.20.0

## 0.2.0

### Minor Changes

- cc3d5c5: The knowledge graph takes calls from apps acting for a person, held to what the app is granted: a read needs `knowledge:read`, an action its own scope (`retain` is `knowledge:extract`), and `hold` and `keep` are refused to every app, since they are the person's to take in AUGUR. `retain` is now granted to apps by default in the catalogue: its own scope is the grant.
- 7044a09: The knowledge graph's client: `connectKnowledge` reads the action catalogue when it connects and binds each action the deployment offers, with a fresh Idempotency-Key per call, and an action it doesn't offer answers a problem naming those it does. `KnowledgeBaseClass` types the base profile's classes. The knowledge API's meta read now lists those classes (`ontology.baseClasses`), its contract names them (`BaseClass`), and an action's body is documented as an object with any fields, as its input schema in GET /actions says.
- 2a581f5: The knowledge graph's contract is now checked against the running service: Schemathesis sends it the requests the contract allows, on main, and CI stops a pull request that would break a contract's callers within a major (oasdiff). What the first run found is fixed: a clock with an offset wider than Postgres takes, or before year 1, no longer fails a read; a floor id or IRI as long as the contract allows no longer answers 414; a NUL character in a text answers 422, not 500; and errors are documented as `application/problem+json`, as they were always sent. A source text goes in a body to the new POST /floors/{floor}/known-entities, since a long one doesn't fit a URL; the GET stays, deprecated, until /v2.

  Not breaking: knowledge.openapi.yaml no longer lists Turtle and TriG for the export's and the shapes' errors, which the service never sent: they were always `application/problem+json`.

- 951c907: The knowledge graph exports a floor: the beliefs held in sight from it as Turtle or TriG, with PROV-O provenance back to the observations and sources they rest on (GET /floors/{floor}/export). A belief's evidence now lists the observations behind it that you can see (`evidence.seen`). With this every read draft 4 of the spec asks for is served, and the 24 competency questions pass over HTTP through the generated client.
- d663855: The knowledge graph takes seven more actions: `publish` (your own source, to a shared floor you are on, derived and not yet held), `dispute` and `settle`, `retract` (it falls from every floor the belief reached), `raise` (the floor above sees the belief; nothing is copied), `end` (a belief stopped being so, kept as history) and `forget` (your own floor only; the words are cleared and ledgered). Settle, retract, raise, end and forget are never granted to apps. Contract 1.8.0.
- c3d8983: Who settles and who raises on a floor now comes from the permissions service (`PERMISSIONS_URL`), asked as the knowledge service on each request, in batches, for every team floor the person stands on. A role taken away there is gone on the next request. While the permissions service can't answer, nobody settles or raises, and a refusal says an admin sets the roles. Migration 012.
- efd7286: What people forget in the knowledge graph stays forgotten after a restore. Each forget is written, before it commits, to a ledger on a volume of its own (`knowledge-ledger`, `KNOWLEDGE_LEDGER_DIR`), outside Postgres; on every start the migrate job forgets again what the ledger names and the restored database doesn't, and writes back into the ledger what only the database has. The backup container copies the ledger off the server with each night's dump. Migration 008.
- f59617f: An app names what it needs of the knowledge graph in its `augur-floor-graphs` resource: `classes` (class IRIs) and `actions` (action names). The registry asks the deployment's knowledge graph what it offers when an app is installed, and refuses an install that needs a class or action it lacks, saying which and who can adopt a class. When the knowledge graph can't be asked, it only warns. The knowledge graph's `GET /meta` now lists every class it has (`ontology.classes`), and Admin's review of an install names the classes and actions.
- 2d5343e: The knowledge graph's object reads: a page of the entities in sight from a floor (by class, kind or text, in
  pages of at most `KNOWLEDGE_PAGE_LIMIT`), the occurrences an entity took part in, one belief whatever became of
  it, one observation, one source and what was read from it, your own action records, one action's declaration,
  and the ontology with its classes, SHACL shapes and the candidates asked for from sources you can see. What
  can't be opened from where you stand says the kind of floor it is on and never what it says.
- 9dcb787: An ontology admin (one of AUGUR's admins) adopts a term extraction asked for, as a class or predicate of its own or as another name for one the ontology has, and dismisses one it won't take, saying why: the `adopt` and `dismiss` actions. A claim that falls to `kg:note` asking for an adopted term is kept under it from then on; what was kept before stays as it was. The first adopt pass ships with it: status, reason, defect, expected impact, availability, risk and description, with the names the corpus asked for them by. On draft 4's corpus the share of claims that fall to `kg:note` goes from 32.7% to 23.5%. `GET /v1/ontology/owl` serves the ontology as OWL in Turtle, and a new term sends `platform.knowledge.ontology.changed`. Migrations 010 and 011.
- 4371009: The knowledge graph answers the seam's query reads: lookup by identity key, what an extractor may be told is known, the subgraph around an entity, conflicts and possible duplicates, what waits on a floor for you, summaries, a structured query and recall. An entity's beliefs can be read on two clocks (`at`, `known`). A subgraph goes at most `KNOWLEDGE_SUBGRAPH_DEPTH` hops (default 3).
- c47abc6: The knowledge graph writes each floor's summary of an entity from that floor's own beliefs, through the models service, once they have been quiet for `KNOWLEDGE_REFLECT_DEBOUNCE_SECONDS` (600). It writes at most `KNOWLEDGE_REFLECT_DAILY_BUDGET` (400) a day, and `KNOWLEDGE_REFLECT_FLOOR_BUDGET` (100) on any one floor, counted from the audit so a restart doesn't spend a day twice. Whatever waits shows as older than its beliefs. A floor where models are refused is left alone for the day, and the models service's daily limit stops it until midnight UTC. Migration 009.
- ee77d16: Retain takes a source's text instead of what was extracted from it. The knowledge graph asks the model what the text claims, through the models service (`MODELS_URL`), for the floor it is retained on, with the text fenced off from its instructions. What fits is kept as observations, never as belief; a class or predicate the ontology lacks falls back to its generic one and is recorded as a candidate; text that speaks to the system is kept only flagged, so no floor believes it until its owner keeps it. The answer's `extraction` says what was dropped and why. Resolution also matches a unique entity of the same class whose name is nearly the same.
- 4e3f47a: The knowledge graph service runs. It answers at `/api/knowledge/v1`: where you stand (`/floors`), its
  action catalogue, the actions retain, hold, keep and confirm-faithful (each needs an Idempotency-Key and
  can be a dry run), and an entity and its beliefs as the floors in sight know them. It follows identity
  on every call, so someone taken off a team loses that floor within 30 seconds, and it relays its events
  as `platform.knowledge.*`. Compose runs it beside a `knowledge-migrate` job, and the updater knows both.
- 76c93ac: The knowledge graph takes `merge`, `split` and `retire` on a floor settler's word, and `undo` for your own retain, hold or keep: undoing retain retracts what it kept, undoing hold withdraws the belief from every floor it reached and lets what it replaced stand again (or takes back only the evidence it added), and undoing keep flags the observation again. An action's record says whether it was undone. Migration 007; contract 1.9.0.

### Patch Changes

- 1332458: Compose leaves the knowledge service unconnected to the models service in this phase of design (`MODELS_URL` empty), so it reads no raw text and writes no summaries. The code for both stays, marked in `src/index.ts`.
- Updated dependencies [d2ce7c9]
- Updated dependencies [7e6b12b]
- Updated dependencies [12064f5]
- Updated dependencies [cc7aa74]
  - @augur/service-kit@0.19.0

## 0.1.0

### Minor Changes

- 6c0abe4: The knowledge graph's store, in its own `kg` schema: floors and their sight, entities, sources, observations and beliefs on two clocks, written only through actions and read through a floor fence. Nothing runs it yet; the service comes next.

### Patch Changes

- Updated dependencies [3e2ff05]
- Updated dependencies [e2089a3]
- Updated dependencies [656f2d1]
- Updated dependencies [0e4e55f]
- Updated dependencies [6c0abe4]
- Updated dependencies [699af61]
- Updated dependencies [dfc36c1]
- Updated dependencies [f01d0c4]
- Updated dependencies [832458f]
- Updated dependencies [1ce4194]
  - @augur/service-kit@0.18.0
