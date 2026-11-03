# API contracts

Each platform service's API has one source: the TypeBox schemas on its Fastify routes
([ADR 0055](decisions/0055-schema-first-apis-with-typebox.md)). Request validation, the handlers' types
and the contract in `contracts/<service>.openapi.yaml` all come from them.

## Changing an API

1. Change the route's schema in the service (`src/schemas.ts` for named shapes, the route's `schema` for
   the rest). Give each route a `summary`, and a `description` where there is more to say. Name every
   response the route sends, refusals included (`refused('when')`: an RFC 9457 problem as
   `application/problem+json`, which `problemDetails()` in `@augur/service-kit` makes of every error).
2. Bump `info.version` in the service's `src/contract.ts` as [versioning.md](versioning.md) says: a new
   endpoint or optional field is a minor, a removed or renamed one a major.
3. `pnpm build && pnpm contracts`, and commit the contract it writes.

CI runs `pnpm check:contracts`. It fails when a contract isn't what its service generates, or when
Spectral finds an error in it (`.spectral.yaml`).

## How it fits together

| Part | Where |
| --- | --- |
| Named shapes, with `$id` | `platform/services/<service>/src/schemas.ts` |
| Title, description, `info.version` | `platform/services/<service>/src/contract.ts` |
| Routes and their schemas | the service's route files |
| The generated contract | `contracts/<service>.openapi.yaml` |
| The generator and check | `scripts/check-contracts.mjs` |
| Lint rules | `.spectral.yaml` |
| The app manifest's JSON Schema | `contracts/manifest.schema.json`, from the registry's `src/manifest.ts` by `pnpm manifest-schema`; checked by `pnpm check:manifest` ([Build an app](build-an-app.md#checking-a-manifest)) |

Response schemas document what is sent; they don't filter it. A route answers with plain JSON, as it did
before contracts were generated.

A contract whose service has no `src/contract.ts` yet is still hand-written; it is linted once its
service generates it.
