# 0055. Each API has one source: TypeBox schemas on its routes, with the contract generated from them

- **Status:** Accepted
- **Date:** 2026-11-03
- **Decided by:** Harry (library report default D1, taken for the alpha on 2026-11-03)
- **Replaces:** none. Hand-written `contracts/*.openapi.yaml` become generated files.

## Context

Each platform service's API is written down three times: the JSON Schemas on its Fastify routes, the
TypeScript types its handlers use, and a hand-written OpenAPI file in `contracts/`. Nothing keeps them in
step. Linting the hand-written files finds 31 errors, the files miss responses the code sends, and every
app hand-writes its own client types. The alpha needs an app builder to trust what a contract says
(alpha Goal 4).

## Options

1. **Keep hand-written contracts, add a lint.** Cheap, but the code and the file still drift.
2. **TypeBox on the routes, generate the contract.** One schema gives validation, handler types and the
   contract. TypeBox is plain JSON Schema, so Fastify's Ajv uses it unchanged.
3. **Zod with a converter.** Popular, but its JSON Schema is a translation and Fastify needs an adapter
   to validate with it.
4. **Contract first, generate the server types.** Keeps YAML as the source; the handlers' schemas are
   generated and harder to read in the code.

## Decision

Option 2.

- A service's wire shapes are **TypeBox** schemas (`typebox`), used on its routes through
  **@fastify/type-provider-typebox**. Named shapes carry an `$id` and become `components/schemas`.
- **@fastify/swagger** collects the routes, and `pnpm contracts` writes
  `contracts/<service>.openapi.yaml` from them (`scripts/check-contracts.mjs`). Nobody edits a generated
  contract by hand. What a contract says about the API as a whole (title, description, `info.version`)
  is in the service's `src/contract.ts`.
- CI runs `pnpm check:contracts`: the files must be what the code generates, and **Spectral**
  (`.spectral.yaml`, its OpenAPI rules) must find no errors.
- Response schemas document the API. They don't filter what is sent: responses are serialised as plain
  JSON, as before.
- Clients are generated from the contracts with **openapi-typescript** and **openapi-fetch**
  (`@augur/clients`). The app manifest gets a published JSON Schema from TypeBox, checked with Ajv.
- The services apps call (events, gateway, identity, registry) move first. Models follows. Storage and
  the updater serve no HTTP API and have no contract.

## Consequences

- A change to a route's schema changes the contract in the same pull request, and CI shows it.
- The handlers' request types come from the schemas, so a handler can't read a field the schema doesn't
  allow.
- New dependencies: `typebox`, `@fastify/type-provider-typebox`, `@fastify/swagger` in the services;
  Spectral runs through `pnpm dlx` at a version pinned in `scripts/check-contracts.mjs`, so its
  dependencies stay out of the lockfile and the dependency scan.
- Until the service starter lands (PER-266), each service keeps its own small `describeApi` in
  `src/contract.ts`; it moves into `@augur/service-kit` then.
- Bumping `info.version` is still by hand, as [versioning.md](../versioning.md) says.

## Links

- Linear: PER-260 (TypeBox and generated contracts), PER-182, PER-262 (manifest schema), PER-269.
- Guide: [api-contracts.md](../api-contracts.md).
