# 0008. Apps have their own identity, and services trust only the gateway's signed caller

- **Status:** Accepted
- **Date:** 2026-10-23
- **Decided by:** Harry

## Context

Services used to trust `x-user-*` headers, which anything on the network could send. Apps also shared one service token, so one app could act as another.

## Decision

- Each app has its own client identity, registered through the registry.
- The gateway signs every forwarded request with a short-lived Ed25519 token (`x-augur-caller`) naming the person, roles, floor and the one service it is meant for. Services accept the caller only from that token, through `signedCallers` in the service kit.

## Consequences

- New apps from `pnpm create-app` get the check by default.
- Scoped `ctx.fetch`, audit actor spoofing and the floor-rule bypass are open follow-ups from the security review.

## Links

- docs/signed-caller.md
