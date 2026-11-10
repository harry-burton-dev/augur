# @augur/clients

Typed clients for AUGUR's platform APIs: events, identity, registry, models and the gateway, and any
service that has a contract in `contracts/`. For each `contracts/<service>.openapi.yaml` the package has

- a factory, `<service>Client(options?)`, returning an [openapi-fetch](https://openapi-ts.dev/openapi-fetch/)
  client for that API, so paths, parameters, bodies and answers are all typed;
- its types as a namespace, `<service>.paths`, `<service>.components` and `<service>.operations`, from
  [openapi-typescript](https://openapi-ts.dev/);
- an entry in `services`: the API's title, version and the path its routes are under (`/v1`).

## It's generated: change the service, not the client

Nothing per service is written by hand, except where a client adds behaviour rather than types (the knowledge
graph's, below). `scripts/generate.mjs` reads every `contracts/*.openapi.yaml` and
writes `src/generated/` (not committed) before each build, typecheck and test, so the package is always the
contracts it was built from. The contracts come from the services' route schemas
(ADR 0055, [api-contracts.md](../../../docs/api-contracts.md)):
to change a client, change the service's API, then `pnpm build && pnpm contracts`. A new contract gets
its client on the next build.

## Using it in an app

Add it beside the SDK, aliased from GitHub Packages the same way:

```json
"dependencies": {
  "@augur/clients": "npm:@harry-burton-dev/augur-clients@^0.1.0"
}
```

In a frontend, send calls through `ctx.fetch` so the person's token and the current floor go with each one:

```ts
import { eventsClient, throughPathFetch, type events } from '@augur/clients';

const api = eventsClient({ fetch: throughPathFetch(ctx.fetch) });
const { data, error } = await api.POST('/notifications/{id}/read', { params: { path: { id } } });
```

By default a client calls `/api/<service>/v1` on the page's own origin, which is where the gateway serves
it. Outside the browser, pass where the gateway is from your config, never a literal host:

```ts
const api = registryClient({ gateway: `${process.env.GATEWAY_URL}/api`, headers: { authorization: `Bearer ${token}` } });
```

`baseUrl` replaces the whole base, for a service called directly rather than through the gateway. Every
other option is openapi-fetch's (`fetch`, `headers`, `querySerializer`, …).

A client is typed for the contracts it was built against. A change to an API reaches apps when this
package is released, so a pull request that changes a contract adds `'@augur/clients'` to its changeset
with the same kind of bump (docs/api-contracts.md).

## The knowledge graph

The knowledge graph adds actions within a major, so its client reads them when it connects instead of
fixing them at build time (ADR 0079). `connectKnowledge(options)` takes the same options as any client,
reads `GET /actions` once, and gives:

- `api`, the typed client for every read;
- `actions`, `offers(name)` and `declaration(name)`: what this deployment offers, with each action's input
  schema, scope, who may take it and whether apps get it by default;
- `act(name, input, { idempotencyKey?, dryRun? })`, which posts the action with a fresh Idempotency-Key
  unless given one, and answers `{ data }` or `{ error }` with the service's problem. An action the
  deployment doesn't offer answers an `unknown_action` problem listing those it does, without a request.

```ts
import { connectKnowledge, throughPathFetch, type KnowledgeClass } from '@augur/clients';

const kg = await connectKnowledge({ fetch: throughPathFetch(ctx.fetch) });
if (kg.offers('retain')) await kg.act('retain', input);
```

`KnowledgeBaseClass` types the base profile's classes, which every deployment has; `KnowledgeClass` is one
of those or any class a deployment adopted. When the catalogue can't be read, `connectKnowledge` throws a
`KnowledgeUnavailable` with the status and the service's problem.
