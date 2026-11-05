# 0067. Update control stays in the registry for now, behind a checked seam, and leaves as its own service

- **Status:** Proposed
- **Date:** 2026-11-05
- **Decided by:** Harry
- **Replaces:** none

## Context

The registry started as the app catalogue: what apps there are, where they load from, who may open them on which floor. Since then it has gained AUGUR's update control: the release feed and its trust ([0017](0017-signed-release-feed.md)), rings and halts ([0018](0018-rollout-gates.md)), reports to the portal ([0019](0019-deployment-reporting.md)), desired state, windows and the after-upgrade watch ([0020](0020-upgrade-policy-windows-watch.md)), the app runner's installs from the signed app feed, alerts as notices ([0059](0059-grafana-alerting-and-faro.md)) and the Upgrade Centre's overview. By line count, that is about 5,000 of the registry's 8,700 lines. Its tables are `upgrades`, `desired_states`, `desired_state_history`, `installs`, `app_jobs`, `guardrails` and `deployment_key`, beside the catalogue's own.

Moving this is worth doing before Kubernetes and Flux work starts. Flux would take over reconciling to desired state, so the code that holds it should be easy to lift out. It isn't worth doing in the middle of the alpha, when every service already has a lane working in it.

## Options

1. **Move update control into the updater.** One fewer place for it. But the updater is the one part with Docker access (through the socket proxy), it is an optional Compose profile, it restarts parts of AUGUR, AUGUR's registry among them, and it takes no calls from people. Giving it a public API and the record of every upgrade makes the most privileged part the busiest.
2. **Its own service now** (a `releases` service with its own schema). The cleanest end state. It costs a container, a Keycloak client, a gateway route, a contract, and a move of seven tables between schemas on every live server, during the alpha.
3. **Keep it in the registry's process, behind a seam that a check holds, and lift it out into its own service later.** Update control lives in its own modules and route plugins, never imports the catalogue's code, and reaches catalogue data only through the store. The service split then becomes a move of files and tables, not a rewrite.

## Decision

Option 3.

- Update control is these modules: `platform-upgrades.ts` (AUGUR's own upgrades, moved out of `app.ts`), `updates.ts`, `update-schemas.ts`, `desired-state.ts`, `after-watch.ts`, `ring.ts`, `feed-trust.ts`, `pipeline.ts`, `changes.ts`, `app-updates.ts`, `app-runner.ts`, `app-runner-schemas.ts`, `overview.ts`, `report.ts`, `notices.ts` and `alerts.ts`.
- None of them imports `app.ts` or the catalogue's own modules (`floors.ts`, `frontends.ts`, `feature-previews.ts`). Both sides may use the shared checks: `manifest.ts` and `upstreams.ts`, which the app runner needs for the apps it installs, and `schemas.ts`, `roles.ts` and the store.
- `app.ts` only registers update control's route plugins. New update routes go in a plugin of their own, not into `app.ts`.
- **It leaves as its own service, not into the updater,** when the first of these comes: Kubernetes or Flux work starts; update control needs a database role or a release cadence of its own; or the registry's catalogue needs to scale apart from it. That move gets its own record.

## Consequences

- Nothing changes on a server: the routes, the contract and the tables stay where they are.
- `app.ts` drops from about 1,800 lines to about 1,270, and AUGUR's upgrade routes can be read in one file.
- The store is still shared. Splitting it in two (catalogue and update control) is the first step of the later move, and can happen without one.
- The seam is held by `src/seam.test.ts`, which fails when an update-control module imports the catalogue's code.

## Links

- Linear PER-241 (from the 2 November red team), PER-273 (splitting the biggest files)
