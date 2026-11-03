# 0054. App frontends load data with TanStack Query, route with TanStack Router and call APIs with openapi-fetch, all wrapped by the app kit

- **Status:** Accepted
- **Date:** 2026-11-03
- **Decided by:** Harry (the library report's default D2, taken on 2026-11-03; record accepted the same day)
- **Replaces:** none

## Context

Every React frontend repeats the same plumbing: mounting React into the element the shell gives it, turning `ctx.path` into a place and back, an API client with its own error class, and hand-written `useEffect` fetches with their own loading, error and retry state. The alpha's Goal 3 asks for one app-frontend starter in `@augur/app-kit` instead (PER-267, PER-261, PER-182).

The library report recommends established libraries for the three hard parts: TanStack Query for data loading, TanStack Router for routing, and openapi-fetch for typed calls against the OpenAPI contracts. For long lists it adds TanStack Table beside React Aria's Virtualizer, and for tests without a running AUGUR it adds MSW. Each one is a new dependency, so it needs a record (AGENTS.md).

Two constraints hold. The SDK promise (ADR 0013, docs/versioning.md): within a major, the SDK and the kits add and never remove or rename, so a library's next major must not force an SDK major. And the import map ([0003](0003-import-maps-not-module-federation.md), [0048](0048-kit-served-from-a-kit-url.md)): one copy of shared code per page, served at `KIT_URL`.

## Options

1. **Expose the libraries.** Apps import `@tanstack/react-query` and `@tanstack/react-router` themselves, served as their own import map entries. Full power, but their types become part of the SDK, and their next major is an SDK major.
2. **Wrap them in the app kit.** `@augur/app-kit` gives apps its own small API (`defineReactApp`, `placeRoutes`, `useData`, `useChange`, `createAppClient`, `Table`). The libraries are bundled inside the kit's `@augur/app-kit` module, so each page still loads one copy. No third-party type appears in what the kit exports.
3. **Write our own.** A cache, a router and a client of our own. No dependency, but it is the plumbing every app already repeats, written once more and maintained by us.

## Decision

Option 2.

- **Data loading: TanStack Query 5.** `defineReactApp` puts one query client in every mount. Apps load with `useData(key, load)` and change with `useChange(run, { refreshes })`. A domain event on the shell's bus refreshes the queries an app ties to it, so lists stay fresh without polling.
- **Routing: TanStack Router 1.** `placeRoutes()` declares an app's places by path, with typed parameters and search parameters. The base path is where the shell mounted the app (the address minus `ctx.path`), so the manifest's `route` stays the only place the prefix is written. Back and Forward work the same in every app.
- **API calls: openapi-fetch.** `createAppClient(ctx, { base })` calls through `ctx.fetch`, so the person's token and the floor's `X-Workspace-Id` are always sent. Every failure becomes one `AppError`, read from the RFC 9457 problem body with AUGUR's `reason` and `whoCanChange`. Generating the contract types (openapi-typescript) belongs to Goal 4 and its own record.
- **Long lists: TanStack Table 9 and React Aria's Virtualizer** behind Quill's existing `Table`, whose props only grow.
- **Tests: MSW**, in the SDK's `@augur/mfe-sdk/testing` entry beside a fake `ctx`: handlers made from a contract, so an app's tests run without a running AUGUR. MSW is a test dependency only; it never reaches a page.
- **The rule.** No TanStack, React Aria, openapi-fetch or MSW type appears in the exports of `@augur/app-kit`, `@augur/kit-common` or the SDK's main entry. The kit bundle carries the libraries inside `app-kit.js`; apps never list them in their import map entries or bundle their own copy. A library major moves in a kit minor when the wrapper keeps its promise, or waits for the next SDK major when it can't.

## Consequences

- Each React app deletes its own mount code, place parser and API client class, and gets caching, retry and one "can't reach it" state for free. Each app moves in its own repository (alpha W5).
- The app kit's module grows by the size of the three libraries, about 40 kB gzipped. Pages load it once, from the kit URL, and cache it for the kit version.
- Apps that need a feature the wrapper doesn't offer ask for it in the kit, rather than importing the library. That is the cost of a stable contract.
- Renovate keeps the pins current in `augur-kit`. The SDK's API Extractor report (Goal 1) holds the no-third-party-types rule; until it runs on the kit, its tests check the exported names.

## Links

- Linear: PER-267, PER-261, PER-182 (alpha W1.3).
- AUGUR alpha milestone spec, Goal 3, and its implementation plan, block 1.3.
- Library and patterns report, R3 and R4 (Drive).
