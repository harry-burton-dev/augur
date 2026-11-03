# 0014. Agents are apps, run by a durable runs service on DBOS

- **Status:** Accepted in part (2026-11-03): the jobs engine. The agent runtime stays Proposed.
- **Date:** 2026-10-24 (proposed), 2026-11-03 (jobs engine accepted)
- **Decided by:** Harry

## Context

The reason AUGUR exists is to run custom agents that need their own screens, backend and data model; hosted chat agents aren't enough. Draft pull request #51 added an Agents surface before there was a runtime.

## Options

1. **An Agents app inside the shell** (#51). Couples every agent to one screen.
2. **Each agent is an ordinary app, with a platform `runs` service.** Durable runs, grants at start, checkpoints to the shell Inbox, budgets, cancel and audit.
3. **Temporal as the engine.** More to run; only needed at a scale AUGUR doesn't have.

## Decision (proposed)

Option 2, with DBOS Transact on the existing Postgres behind AUGUR's own run API. A small default agent loop in the service kit; apps may use other agent libraries inside a step. Additive only: an SDK `runs` client and an optional manifest `agents` block. Close #51.

## Accepted in part, 2026-11-03

The alpha has no AI in it (PER-245). Harry accepted the part of this record that alpha needs, and left the rest Proposed for beta:

- **Accepted: DBOS Transact on the existing Postgres is AUGUR's jobs engine.** Services reach it only through the service kit's `jobs` interface (define, schedule, start, cancel), so no app depends on DBOS directly. Jobs are durable and resume after a restart; steps must be idempotent, because DBOS may run a step again on recovery; each run is recorded for audit. This settles [0027](0027-runs-is-the-jobs-engine.md).
- **Still Proposed: the agent runtime.** The `runs` service and its run API, grants at start, checkpoints to the Inbox, budgets, the default agent loop, the SDK `runs` client and the manifest `agents` block wait for beta.

## Consequences

- Nothing about agents is built until the agent runtime part is Accepted.
- New dependency: DBOS Transact (TypeScript), and its Python SDK where a Python worker needs jobs.
- Artifacts' renditions queue and timers move onto `jobs`; until they do, they keep working as they are.

## Links

- Agent runtime design (a private design note)
- Linear PER-245, PER-278 (alpha milestone spec and its Step 0 records)
