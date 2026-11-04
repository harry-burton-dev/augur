# 0063. Accessibility is checked by axe in CI, failing on serious findings

- **Status:** Proposed
- **Date:** 2026-11-04
- **Decided by:** Harry
- **Replaces:** none. Builds on [0016](0016-storybook-on-chromatic.md) (Storybook on Chromatic) and the alpha spec's goal 16.

## Context

AUGUR targets WCAG 2.2 AA. The UI/UX review found gaps no test caught: an unnamed control, a prohibited ARIA attribute, no `main` landmark, loops that ignored Reduce motion. Reviews are occasional; a regression lands between them. The alpha spec (goal 16) asks for an automated accessibility check in CI that fails on serious findings, without new long jobs.

## Options

1. **axe-core, run where tests already run.** The kit's Storybook gets `@storybook/addon-a11y`, and a test in its existing `pnpm test` renders every story and fails on serious or critical findings. AUGUR's contract job runs `@axe-core/playwright` on the real shell. The de facto standard engine, maintained by Deque, no new service.
2. **Lighthouse CI.** Scores pages, but its accessibility audits are axe underneath, it needs its own job, and a score hides which rule broke.
3. **Pa11y.** Wraps axe or HTML_CodeSniffer behind a CLI; adds a tool without adding coverage over option 1.
4. **Manual audits only.** No cost in CI, but nothing stops a regression.

## Decision

Option 1. Accessibility is checked by axe (WCAG 2.0 to 2.2 A and AA rules), and CI fails on any finding axe rates serious or critical:

- **augur-kit:** every Storybook story, in `pnpm test` (`storybook/a11y.test.tsx`), with `@storybook/addon-a11y` showing the same rules in Storybook and Chromatic. Colour contrast needs a real browser, so it is checked in Storybook and Chromatic, not in that test.
- **AUGUR:** `platform/contract/tests/a11y.spec.ts` with `@axe-core/playwright`, inside the existing contract job: Title, an app, Orbit and the notification stream on the real shell, once per run (the build from source, Folio off), not once per frozen build.

Moderate and minor findings don't fail CI; they are fixed when the screen is next touched.

## Consequences

- New dev dependencies: `@axe-core/playwright` (AUGUR's contract tests), `@storybook/addon-a11y`, `axe-core`, `vitest` and `happy-dom` (augur-kit's Storybook package). Renovate keeps them current.
- A kit or shell change that adds a serious finding fails its pull request, in the job that already runs for it; the axe pass adds seconds, not a job.
- A new app frontend in its own repository should run the same spec shape against its screens (the reference app gets it once it exists, W1.6).
- Contrast regressions are caught only where a browser renders: Chromatic and the contract job.

## Links

- Linear PER-281 (W3.2), PER-170 (W3.3), PER-225.
- augur-kit #10 (axe on every story, AskTwice, Aerie landmarks, Reduce motion), AUGUR #292, #317.
