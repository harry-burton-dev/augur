# 0027. The runs service also runs ordinary background jobs

- **Status:** Accepted; the amendment of 2026-11-05 is Proposed
- **Date:** 2026-11-01
- **Decided by:** Harry

## Context

Artifacts built its own queue (a renditions table with leases) and its own timers. Intent (deadlines, phase changes) and Data Atlas (extraction) would each build another. ADR 0014 proposes a durable runs service for agents.

## Options

1. **One engine:** the runs service runs scheduled and background jobs as well as agent runs, with one grant, audit and cancel model.
2. **Each app keeps its own queue.** Simple per app, with three ways to see, cancel and audit work.

## Decision

Option 1, if ADR 0014 is accepted. Artifacts' queue moves over once the runs service exists. Until then, no new app builds its own queue.

## Consequences

- Depends on ADR 0014. If 0014 is rejected, this record has to be decided again.

## Amended 2026-11-03

[0014](0014-agent-runtime.md) is now accepted for its jobs engine only, so this record no longer waits on the runs service. Ordinary background and scheduled jobs run on DBOS through the service kit's `jobs` interface. Every app service and the app template use it; Artifacts' queue and timers move onto it, and until they do, they keep working. The rule that no new app builds its own queue holds. Agent runs join the same engine when the agent runtime is accepted.

## Amended 2026-11-05 (Proposed)

Artifacts has moved: its renditions run as jobs on the queue `folio.renditions` and its timers (late reminders, moving publications, clearing deleted documents) are scheduled jobs (`augur-folio` `service/src/index.ts`, `service/src/rendition-queue.ts`). Every app service gets the jobs interface from `startAppService`, and Mandate's reminder sweep uses it too. Nothing else in this record changes.

## Links

- Foundation gap analysis, 27 October 2026: gap G9, decision D4.
- PER-133, PER-144.
- Linear PER-245, PER-278 (alpha milestone spec and its Step 0 records)
