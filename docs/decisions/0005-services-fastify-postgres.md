# 0005. Services are TypeScript on Fastify, with a Postgres schema each and OpenAPI contracts

- **Status:** Accepted
- **Date:** 2026-10-17
- **Decided by:** Harry

## Context

AUGUR's backend is a set of small services behind one gateway: identity, registry, events, storage, models, updater, and each app's own service. They need to be cheap to run on one server and still separable later.

## Decision

- Services are TypeScript on Node (22 or later) with Fastify, sharing `@augur/service-kit`.
- Each service owns its own Postgres schema and no service reads another's tables. Services talk through HTTP APIs and domain events.
- Every service API is described by an OpenAPI file in `contracts/`.
- A migration that shipped never changes. Within a major version migrations only add; one that drops, renames or tightens needs a major bump of its service. `pnpm check:migrations` holds both, so a deployment can always roll back to the release before.
- No ORM: SQL through `pg`.
- Retrieval data uses pgvector in Postgres.

## Consequences

- One Postgres can serve every service now, and a service can move to its own database later without code changes.
- Per-service database logins are still an open security item.

## Links

- docs/domain-events.md
- Architecture review (a private design note)
