# 0027. The runs service also runs ordinary background jobs

- **Status:** Proposed
- **Date:** 2026-11-01
- **Decided by:** waiting on Harry

## Context

Artifacts built its own queue (a renditions table with leases) and its own timers. Intent (deadlines, phase changes) and Data Atlas (extraction) would each build another. ADR 0014 proposes a durable runs service for agents.

## Options

1. **One engine:** the runs service runs scheduled and background jobs as well as agent runs, with one grant, audit and cancel model.
2. **Each app keeps its own queue.** Simple per app, with three ways to see, cancel and audit work.

## Decision (proposed)

Option 1, if ADR 0014 is accepted. Artifacts' queue moves over once the runs service exists. Until then, no new app builds its own queue.

## Consequences

- Depends on ADR 0014. If 0014 is rejected, this record has to be decided again.

## Links

- Foundation gap analysis, 27 October 2026: gap G9, decision D4.
- PER-133, PER-144.
