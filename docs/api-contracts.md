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
4. Add `'@augur/clients'` to the changeset with the same kind of bump as the API (minor for something new,
   major for something removed or renamed): the clients are built from the contracts, and apps get the
   change when the package is released ([Clients](#clients)).

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
| Typed clients for apps | `platform/packages/clients` (`@augur/clients`) |

Response schemas document what is sent; they don't filter it. A route answers with plain JSON, as it did
before contracts were generated.

A contract whose service has no `src/contract.ts` yet is still hand-written; it is linted once its
service generates it.

## Clients

`@augur/clients` ([its README](../platform/packages/clients/README.md)) gives apps a typed client for each
contract in `contracts/`, with [openapi-typescript](https://openapi-ts.dev/) for the types and
[openapi-fetch](https://openapi-ts.dev/openapi-fetch/) to call. Each `contracts/<service>.openapi.yaml`
becomes a factory, `<service>Client()`, and a namespace of its types, `<service>.paths` and
`<service>.components`:

```ts
import { eventsClient, throughPathFetch } from '@augur/clients';

const api = eventsClient({ fetch: throughPathFetch(ctx.fetch) });
const { data, error } = await api.GET('/notifications');
```

A client calls `/api/<service>/v1` behind the gateway, on the page's own origin unless `gateway` (the
gateway's API root, from config) or `baseUrl` says otherwise. An answer the contract names as a refusal
comes back as `error`.

Nothing in the package is written per service: its build generates `src/generated/` from the contracts
(not committed), so a client always says what its contract says. Change the service, not the client. It
is published like the other packages, as `@harry-burton-dev/augur-clients`; an app aliases it to
`@augur/clients` as it does the SDK ([versioning.md](versioning.md)).
