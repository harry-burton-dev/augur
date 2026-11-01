# 0014. Agents are apps, run by a durable runs service on DBOS

- **Status:** Proposed
- **Date:** 2026-10-24
- **Decided by:** waiting on Harry

## Context

The reason AUGUR exists is to run custom agents that need their own screens, backend and data model; hosted chat agents aren't enough. Draft pull request #51 added an Agents surface before there was a runtime.

## Options

1. **An Agents app inside the shell** (#51). Couples every agent to one screen.
2. **Each agent is an ordinary app, with a platform `runs` service.** Durable runs, grants at start, checkpoints to the shell Inbox, budgets, cancel and audit.
3. **Temporal as the engine.** More to run; only needed at a scale AUGUR doesn't have.

## Decision (proposed)

Option 2, with DBOS Transact on the existing Postgres behind AUGUR's own run API. A small default agent loop in the service kit; apps may use other agent libraries inside a step. Additive only: an SDK `runs` client and an optional manifest `agents` block. Close #51.

## Consequences

- Nothing about agents is built until this is Accepted.

## Links

- Agent runtime design (a private design note)
