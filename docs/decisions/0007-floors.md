# 0007. Workspaces are floors: you, nested teams, and one organisation

- **Status:** Accepted
- **Date:** 2026-10-19
- **Decided by:** Harry

## Context

People in an organisation work alone, in teams inside teams, and across the whole organisation. Apps need to know which of these they're working in, and people need to move between them without confusion.

## Decision

- Each person has a personal floor ("You"), teams sit above it, and the organisation is the top floor. There is one organisation per deployment.
- Only teams nest, at most five deep. The identity service owns floors and membership.
- People move up and down floors; they never "switch workspace", and the word "workspace" isn't shown.
- An app is told its floor by the shell (`ctx.workspace`); the gateway checks membership before forwarding. Apps keep one model per concept keyed by floor.
- Every team floor uses one shared team colour; levels can be named per deployment (SDK 1.9 `WorkspaceRef.level`).

## Consequences

- Admin models departments as a team tree and app installs per floor.
- Apps that read more than one floor need per-app, per-floor tokens.

## Links

- Nested workspaces plan (a private design note)
