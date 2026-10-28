# Data Atlas

The things the organisation keeps track of (ships, ports, organisations, people, places, events) and what is known about them. Artifacts holds what was published, the intent app holds what people mean to do, and Data Atlas holds what those are about. Spec: [Data Atlas](https://claude.ai/artifact/G9XhuREFpYFjLWFqKK8sEF).

| Path | What it is |
| --- | --- |
| `manifest.json` | How the registry lists the app: its route, entry, the SDK range it works with |
| `frontend/` | The micro frontend the shell mounts at `/atlas` (`@apps/atlas-frontend`) |
| `service/` | The app's own API, reached through the gateway at `/api/atlas` (`@apps/atlas`) |

## What it keeps

- **Entities**, each with an `ent_` + ULID id for life, a kind from the ontology, a name, other names, a description and details. Details marked as identity keys (an IMO number, a UN/LOCODE) belong to one entity only, whatever its floor.
- **The ontology**: a starter profile of the [Common Core Ontologies](https://github.com/CommonCoreOntology/CommonCoreOntologies) (BSD-3). Each kind names the CCO class it stands for, so the full pack can be loaded later without renaming anything. Admins change the ontology, for now.

## Fenced by floor

Every entity sits on the floor it was made on. A floor shows what is kept on it and on every floor above it, never below: the org floor shows only the org's, a team's floor its own, its parents' and the org's, and your own floor everything you can reach. Only the floor an entity is kept on can change it.

Nothing is hidden without saying so. Asking for an entity that doesn't show from where you stand answers 403 with `reason` (`elsewhere`: go to that floor; `kept`: not yours to see) and a sentence naming the floor and what to do. Adding an identity key someone else holds names the holder if you may see it, and otherwise says where it is kept.

## Running it

The graph lives in Postgres, in the `atlas` schema, and there is no in-memory stand-in: point `DATABASE_URL` at any Postgres 16 or later, then `pnpm dev:app atlas`. Tests need `DATABASE_URL` too (CI gives them one).

## API

Under `/api/atlas/v1`, on the floor in `X-Workspace-Id`:

| Route | |
| --- | --- |
| `GET /ontology` | The kinds of thing, their details and the ontology's version |
| `GET /entities?q=&type=&limit=&offset=` | What shows from this floor, by name, other name or identity key; `type` takes its subtypes too. `seeing` names the floors it comes from |
| `POST /entities` | Adds one on this floor: `{ type, label, aliases?, description?, details? }` |
| `GET /entities/:id` | One entity, with `floorName` and `can` (`edit`, `retire`, and `why` when not) |
| `PATCH /entities/:id` | Changes it, from the floor it's kept on |
| `POST /entities/:id/retire` | Takes it out of use (that floor's leads, or whoever added it); its id stays and its keys are freed |
| `POST /entities/resolve` | For apps keeping entity links: `{ refs: [{ id }] }` (up to 200) → each as the caller sees it now: `{ id, ref, state, floorName }`, `{ id, hidden, reason, message }` or `{ id, missing }` |
| `POST /subgraph` | `{ seeds, depth ≤ 3, types?, relations?, asOf?, limitPerNode? }` → `{ nodes, edges, more, unseen, missing }` from this floor: links true at `asOf`, walked out to `depth` steps, at most `limitPerNode` from each entity, strongest first (the rest, and the links past the last ring, counted in `more` by relation and `direction`). Seeds always show; `types` narrows what the walk reaches. Each edge carries `disputed`, its open disputes. An entity at the far end that doesn't show from here is in `unseen`, with why and the shown entities it is `near` |
| `GET /entities/:id/knowledge?at=&known=` | What's known from this floor: `facts` (with `direction`, the `other` end of a link, `disputes`, and `can`), `observations` (with `can`: accept, raise and where to), and `here` (whether the caller may accept). `at` moves the valid clock, `known` the recorded one; both default to now |
| `POST /entities/:id/observations` | `{ property, value \| target, observedAt?, source, grade?, note?, accept? }`, recorded on this floor and never changed. `source` is `{ kind: 'person' }`, `{ kind: 'document', document: DocumentRef }` or `{ kind: 'other', note }`; `grade` is NATO style, such as `B2`; `accept` (leads) records it as a fact here in the same step |
| `POST /entities/:id/facts` | A lead accepts observations that agree as so on this floor: `{ backedBy, validFrom?, validTo?, note? }`. A detail has one value per floor at a time, so this replaces the floor's current record of it; links may be many |
| `POST /facts/:id/end` | A lead says when it stopped being so (`validTo`, default now): a new record, the old one superseded |
| `POST /facts/:id/withdraw` | A lead takes back a fact recorded in error; it stays on record as of before |
| `POST /facts/:id/disputes` | Anyone who sees a fact says why it may be wrong. Shown to those who see the disputer's floor, and to the fact's own floor |
| `POST /disputes/:id/clear` | Whoever raised it, or the fact's floor's leads |
| `POST /observations/:id/raise` | A lead copies an observation to a floor above that they're on: `{ to }`. The copy points back to it; the floor above decides whether to accept it |

Every change goes to the audit log as `entity.created`, `entity.changed` or `entity.retired`, and to other apps, through the outbox, as the domain events `atlas.entity.created`, `.changed` and `.retired` with `{ entity, type }`: ids only, so any follower may read them.

## What's known

Knowledge is fenced by floor like entities are (Harry, 27 October 2026). An **observation** is what someone saw or read, as they said it, with where it came from and an optional grade; it is never changed. A **fact** is what a floor's leads accept as so, resting on observations, on two clocks: when it is true in the world (`validFrom` to `validTo`) and when the floor recorded it (`recordedAt` until a later record supersedes it). A **link** is a fact whose value is another entity, of a kind the ontology allows (`operated-by`, `located-at`, …). Lower floors never leak up: a team's facts don't show on the org floor. A lead **raises** an observation to a floor above, where it is worth more, and that floor's leads decide whether to accept it. Ontology version 2 adds the starter links and details known only through facts (a vessel's flag), which can't be typed on the entity.

## Explore

`/explore/:id` draws the graph around one entity as seen from this floor, a ring at a time (one to three rings out). Each ring shows each entity's strongest links (those to the most linked entities) and folds the rest, and whatever lies past the last ring, into counts such as "+4 location of" that open in place; nothing loads the whole graph. An entity linked but not visible from here shows as "1 hidden" beside what it's linked to, with why. Kinds, links, "True on" and "Hide disputed" narrow it. Nodes are coloured by the floor they're kept on, as on the floor gauge. It is drawn with Sigma.js on graphology (WebGL), laid out by ForceAtlas2 in a Web Worker, and loaded only when the explorer opens; the same graph is always available as a list, which is also what browsers without WebGL get.

## Intents

Data Atlas handles the SDK's entity intents (SDK 1.5): `entity.pick` opens a picker over the asking app, narrowed to the `types` asked for, answering with one `EntityRef` (or a list, with `multiple`); `entity.open` opens the entity's page; `entity.explain` opens it with why it shows from this floor marked. Everything is as seen from the floor the person stands on.
