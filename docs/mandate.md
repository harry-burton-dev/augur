# Mandate: intent

Mandate holds **intent**: what a floor means to achieve and why, and the parts of it passed down to the teams and people who'll do it. It is not task tracking. It says what and why, and leaves how to whoever holds each part. It is one of three pillar apps that meet on the same entities: Artifacts holds the context, Mandate the intent, Data Atlas the graph of things they're about.

It is shaped, loosely, on allied doctrine for planning and operations ("mission command"). This is the alpha; expect it to change.

## An intent

Every intent says, in words:

| Part | What it says |
| --- | --- |
| Mission | What is to be done, in one line |
| Purpose (required) | Why: what it is for. The part that survives when plans don't |
| End state (required) | What done looks like |
| Key tasks | What must happen for it |
| Constraints | What the holder must do |
| Restraints | What the holder must not do |
| Freedoms | What's left to the holder's judgement |

Its **life** is where it is: draft, passed (waiting for its back-brief), active, achieved, superseded or withdrawn. Its **judgement** is how its holder says it's going: on track, at risk, blocked, achieved. They are kept apart.

## Passing down

An intent on a floor can be **passed down** in parts to a team below the floor, or a person on it. The part carries its parent's entities and documents if the giver chooses. The holder then gives a **back-brief**: they say it back in their own words and accept it, or raise a concern. Until then it is passed, not active. If the parent is revised later, every active part below it asks its holder to check theirs still fits.

Parts can be passed down again, up to eight deep. Among the parts of one intent, its holder can mark one the **main effort**.

The holder of an active intent says how it's going every so often (its rhythm, a week by default). Whoever passed it down closes it as achieved or withdraws it; withdrawing takes everything below with it, and achieving supersedes any part still open.

## Who sees what

- Anyone who can stand on an intent's floor sees it in full. A person's own floor is only theirs.
- **Line of sight:** whoever holds an intent, or any part below it, sees it and every intent above it, to the root.
- A lead on a floor sees everything passed down from it.
- Whoever sees an intent in full sees its parts as summaries (title, holder, life, judgement), so the parts beside yours show their shape but not their orders.

The rules live in `apps/mandate/service/src/rules.ts`, so a later rule (a protective marking, say) is one more check there. The schema already has a `marking` column for it.

## Binding

An intent binds **entities** (from Data Atlas, with a role: subject, resource, area, related) and **documents** (from Artifacts, or any app that answers `document.pick`). What's bound on a parent shows on its parts too, marked where it came from. Until Data Atlas ships, binding an entity says why it can't yet.

Mandate keeps the shared entity contract agreed with Data Atlas: it publishes `mandate.intent.entity-bound` and `mandate.intent.entity-unbound`, answers `POST /v1/refs/resolve` with the intents a person can see, and `GET /v1/entities/:entity/intents` for an entity's "Used by".

## For other apps

| Intent | What it does |
| --- | --- |
| `aim.open` `{ id }` | Opens an intent |
| `aim.pick` `{ purpose? }` | Asks the person to pick an intent; answers `{ kind: 'intent', app: 'mandate', id, title }` |
| `mandate.open` `{ path }` | Opens Mandate at a place in it (`/yours`) |

A tool that briefs on an intent asks `GET /v1/intents/:id/context?depth=0..3`: the intent, its line of sight, its parts and everything bound to them, as far down as it asks and the person may see.

## Events

`mandate.intent.issued`, `passed`, `accepted`, `assessed`, `achieved`, `withdrawn`, `superseded`, `entity-bound`, `entity-unbound`, through the outbox.
