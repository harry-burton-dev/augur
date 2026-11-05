# 0025. Apps keep their own links to entities and publish them as events

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry

## Context

Artifacts, Intent and later tools all need to say "this is about HMS X". Data Atlas holds the entities, but the boundary rule (ADR 0002) stops apps from importing each other's shapes. The SDK only knows `DocumentRef` and `LibraryRef` today.

## Options

1. **Each app stores its own bindings and publishes `<app>.bound` / `<app>.unbound` domain events.** Atlas follows them to answer "what points at this entity".
2. **A central links service** that every app writes to. One more platform service, which every app depends on at write time.

## Decision

Option 1.

- The SDK defines a generic `Ref` (app, type, id, label) and an `EntityRef` (Atlas id, ontology type, label). Both are owned by the platform, not by Atlas.
- An app stores its bindings in its own schema and publishes `<app>.bound` and `<app>.unbound` through the outbox (docs/domain-events.md).
- Opening or picking an entity goes through the `entity.open` and `entity.pick` intents, like documents do.

## Consequences

- Apps stay independent; Atlas can be off and binding still works.
- "What points at X" is eventually consistent, as fast as the outbox.
- Lands as an SDK minor (PER-145), additive only.

## Links

- Foundation gap analysis, 27 October 2026: gap G1, decision D2.
- PER-144, PER-145.
- ADR 0066 (Proposed) sets the topic and payload binding events actually use.
