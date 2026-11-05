# 0052. The SDK's surface is an API Extractor report, and packages are checked by publint and attw

- **Status:** Proposed
- **Date:** 2026-11-03
- **Decided by:** Harry
- **Replaces:** none

## Context

The alpha freezes SDK 2.0 (alpha spec, goal 1; PER-264). Nothing showed when a pull request changed what `@augur/mfe-sdk` exports: a removed field or a renamed type looked like any other diff, and only an app built in another repository would find out. Apps now build in their own repositories against the packages we publish to GitHub Packages (ADR 0012, 0047), so a package with broken `exports` or types is found by an app team after it is released, not by us before. The SDK also has to stay free of third-party types, so a library's next major (React Aria, TanStack, openapi-fetch) never forces an SDK major.

## Options

1. **API Extractor reports, plus publint and Are the Types Wrong (attw) on the packed packages.** Microsoft's API Extractor is the most used tool for this: it writes a readable `.api.md` per entry point that is committed and diffed. publint and attw are the standard checks for a package's `package.json`, `exports` and types. All three are dev-only, run in seconds, and add no runtime dependency.
2. **Hand-written export snapshot test.** A test that lists `Object.keys` of the module. Catches removed values, misses every type change, which is most of the contract.
3. **Nothing; rely on semver discipline and the contract tests.** The contract tests mount the reference app, so they catch a change the reference app happens to use, not the whole surface, and they don't check how a package resolves.

## Decision

Option 1:

- Each published library may carry an `api-extractor*.json` per entry point. Its report lives in the package's `etc/` and is committed. The SDK (`@augur/mfe-sdk`, both entry points) carries one now; the service kit and the records package join at the SDK 2.0 cut, once their 2.0 surfaces have landed; Common and Quill do the same in `augur-kit`.
- `pnpm check:api` (`scripts/check-api.mjs`) runs in CI's `build-test` and fails when a report doesn't match the built types, when a report names a type from a package outside `@augur/*`, or when a pull request changes a report without a changeset for that package of the right size: a minor for additions only, a major when anything is taken away or changed (or a minor with a `Not breaking:` line explaining why).
- `scripts/publish-packages.mjs` packs each library and runs publint (strict, warnings fail) and attw (ESM-only profile, as our packages have no CommonJS build) before anything is published. Its `--check` mode does the same without publishing, on pull requests that touch `platform/packages`.
- Dependencies: `@microsoft/api-extractor`, `publint` and `@arethetypeswrong/cli`, as root dev dependencies, kept current by Renovate (ADR 0033).

## Consequences

- A reviewer sees every change to the SDK's surface as a diff in `etc/*.api.md`, and CI holds the changeset to it. Freezing SDK 2.0 means its report only grows within 2.x.
- Changing an export now means running `pnpm build && pnpm api:update` and committing the report too.
- A package whose `exports` or types don't resolve fails before it merges, not after release.
- About a minute more of `build-test` on pull requests that touch the libraries; seconds otherwise (Harry's CI budget rule).
- The checks: `scripts/check-api.mjs` (with `check-api.test.mjs`) and `checkPacked` in `scripts/publish-packages.mjs`.

## Links

- Linear PER-264 (W1.1, SDK 2.0 cut and frozen), PER-222.
- Alpha milestone spec, goal 1, and the alpha implementation plan, block 1.1 (project files, `specs/alpha-milestone/`).
- Library and patterns report, M1 table (a private note).
- docs/versioning.md, "The API report".
