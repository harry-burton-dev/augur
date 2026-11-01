# 0026. The Inbox holds work that waits on someone, apart from notifications

- **Status:** Proposed
- **Date:** 2026-11-01
- **Decided by:** waiting on Harry

## Context

Notifications tell people things. Nothing holds work that waits on a person or a team: an assignment, an approval, an agent's checkpoint. Intent, the agent runtime (ADR 0014) and Artifacts' publish and share requests each need that.

## Options

1. **Inbox items as a kind of notification.** Fewer concepts, but notifications have no owner, state or hand-on.
2. **A separate Inbox:** items have an owner (person or team), a state (open, done, declined, handed on) and a `Ref` back to the app. The events service stores them, the service kit has `inboxItem()`, and the shell shows them.

## Decision (proposed)

Option 2. "Requests" (PER-155) folds into Intent plus the Inbox, so it doesn't need an app of its own.

## Consequences

- One place for everything that waits on you, instead of one per app.
- The shell screen waits for the React kit (ADR 0015); the events-side store and the service-kit call can come first.

## Links

- Foundation gap analysis, 27 October 2026: gap G2, decision D3.
- PER-144, PER-146, PER-155.
