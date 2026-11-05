# 0068. Knip finds dead code, and Vitest's v8 coverage is reported on main

- **Status:** Proposed
- **Date:** 2026-11-05
- **Decided by:** Harry
- **Replaces:** none

## Context

CI shows no coverage numbers, and nothing finds files, exports or dependencies that nothing uses. Moving apps
into their own repositories (ADR 0012), removing Lit and cutting SDK 2.0 all leave code behind that no check
notices. CI minutes are scarce (the cut-CI-minutes rule), so whatever we add has to be cheap, and adding a tool
needs a record.

## Options

1. **Knip, and Vitest's own v8 coverage written to the run's summary.** Knip is the maintained, common tool for
   unused files, exports and dependencies in a TypeScript monorepo, and understands pnpm workspaces, Vite,
   Vitest and Playwright through plugins. The v8 provider is Vitest's own, with no instrumentation step. Costs
   two dev dependencies and a few seconds a run.
2. **ts-prune or ts-unused-exports, plus Codecov.** ts-prune is no longer maintained and neither finds unused
   files or dependencies; Codecov sends our code's coverage to an outside service and needs a token.
3. **Nothing.** Dead code keeps building up, and nobody sees which parts go untested.

## Decision

Knip (`knip.json` at the root, `pnpm knip`) checks the platform's workspaces on every CI run. It starts as a
warning, with its findings in the run's summary, and becomes a failing check once `main` is clean. A finding is
fixed by removing the dead code, or, when Knip can't see a use (a binary on the server, a file a config loads
by name), by saying so in `knip.json`.

Coverage is measured with `@vitest/coverage-v8` on a push to `main` only, and `scripts/coverage-summary.mjs`
writes one table of it, a row per package, to the run's summary. No coverage number fails a run, and coverage
goes to no outside service.

## Consequences

- Unused exports, files and dependencies show up on the pull request that leaves them, as a warning for now.
- `ignoreExportsUsedInFile` is on: an export used only in its own file (often a constant a test reads) is not
  a finding.
- Pull request runs cost about what they did: Knip takes seconds and their tests don't measure coverage. A
  push to `main` runs its tests again with coverage instead of replaying the pull request's.
- Coverage is a number to watch, not a gate; a threshold, if we want one, is a later record.
- Watch: the warning becoming a failing check (a follow-up once `main` is clean), and Knip's plugin list when a
  new tool's config is added.

## Links

- PER-186 (Report test coverage and find dead code in CI); PER-165 (lint and format checks); PER-172 (fewer CI minutes).
- docs/ci-cd.md, "Dead code and coverage".
