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
| `POST /subgraph` | `{ seeds, depth ≤ 3, types?, relations?, asOf?, limitPerNode? }` → `{ nodes, edges, more, unseen, missing }` from this floor. Entities are linked by facts, which come with observations (AT3): until then the answer is the seeds, with no edges |

Every change goes to the audit log as `entity.created`, `entity.changed` or `entity.retired`, and to other apps, through the outbox, as the domain events `atlas.entity.created`, `.changed` and `.retired` with `{ entity, type }`: ids only, so any follower may read them.

## Intents

Data Atlas handles the SDK's entity intents (SDK 1.5): `entity.pick` opens a picker over the asking app, narrowed to the `types` asked for, answering with one `EntityRef` (or a list, with `multiple`); `entity.open` opens the entity's page; `entity.explain` opens it with why it shows from this floor marked. Everything is as seen from the floor the person stands on.
