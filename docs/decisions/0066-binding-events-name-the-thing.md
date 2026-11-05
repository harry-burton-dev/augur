# 0066. Binding events name the thing: `<app>.<type>.entity-bound`

- **Status:** Proposed
- **Date:** 2026-11-05
- **Decided by:** Harry (overnight approval of the alpha's records, 5 Nov)

## Context

ADR 0025 says an app publishes `<app>.bound` and `<app>.unbound` when its things are linked to entities, with an `EntityBinding` (a `Ref` and an `EntityRef`) as the payload. What shipped is different: Mandate publishes `mandate.intent.entity-bound { intent, entity, role }`, and Artifacts (PER-221) followed it with `folio.record.entity-bound { record, library, level, link, entity, role }`. Data Atlas follows both. PER-145 asks the service kit for one way to publish bindings.

## Options

1. **Keep what shipped and make it the rule:** `<app>.<type>.entity-bound` / `-unbound`, payload `{ <type>: id, entity, role?, ...more ids }`. The service kit writes and reads it.
2. **Move to ADR 0025's shape.** Mandate, Artifacts and Data Atlas all change, and Atlas reads two shapes until every deployment has moved.

## Decision

Option 1. The topic names the kind of thing, as every other domain event's does (`folio.document.published`), and the payload stays ids only, like other events, rather than carrying a `Ref`'s and an `EntityRef`'s labels. `outboxBinding` and `readBinding` in `@augur/service-kit` write and read it. In the browser, the SDK's `EntityBinding` is unchanged: it is how a frontend passes a link around, not an event payload.

## Consequences

- No app or follower changes; Atlas can follow any app's bindings with `readBinding` instead of one case per app.
- ADR 0025 stands apart from the topic and payload, which this replaces.

## Links

- ADR 0025; PER-145, PER-221.
