# 0043. CI lints with ESLint and scans with gitleaks, OSV-Scanner and Trivy

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** none

## Context

CI built, type-checked and tested, but nothing linted, nothing looked for secrets committed by mistake, nothing checked dependencies against known vulnerabilities, and nothing scanned the images we ship. Release images already carry an SBOM and provenance. The repository is private, so GitHub's code scanning (CodeQL) and secret scanning need a paid plan.

## Options

1. **ESLint, gitleaks, OSV-Scanner and Trivy.** The most used open-source tool for each job, free, each a minute or less in CI. Cost stays low (Harry: scarce but effective): lint rides the existing build-test job, gitleaks and OSV are one small job of pinned images, and Trivy runs once per release.
2. **Biome instead of ESLint.** Faster and simpler to set up, but fewer rules and plugins, and less common.
3. **GitHub's own (CodeQL, Dependabot alerts, secret scanning).** Nothing to run ourselves, but a paid plan on a private repository, and no lint.

## Decision

Option 1:

- **ESLint 10** (flat config, `eslint.config.mjs`) with `@eslint/js` and `typescript-eslint` recommended rules, and `eslint-plugin-react-hooks` (rules of hooks and exhaustive deps) for the React frontends (ADR 0015). `pnpm lint`; CI fails on any error.
- **gitleaks** scans every pull request's commits for secrets.
- **OSV-Scanner** checks `pnpm-lock.yaml` against the OSV database on every pull request. It lists every known vulnerability in the run's summary, and fails only on ones the pull request brings in: those already on `main` are fixed by Renovate's weekly updates (ADR 0033), not by whoever happens to open the next PR.
- **Trivy** scans each AUGUR release's images in the deploy test, once per release, and fails on a critical vulnerability that has a fix. A finding we accept goes in `.trivyignore` with the reason and a date to look again.

Each runs as a pinned container image or action, not as a service we host.

## Consequences

- Lint errors in code that was already there are fixed in the PR that adds lint. Warnings (React hook dependency advice) are shown but never fail a check, so one thread's new warning doesn't block another's PR.
- A vulnerability published upstream can turn a PR red without that PR changing anything. The fix is a dependency update, or an entry in `.trivyignore` or `osv-scanner.toml` with its reason.
- Renovate (proposed in the drift audit) would keep dependencies current so these scans stay green; it's a separate decision.

## Links

- Linear PER-172
