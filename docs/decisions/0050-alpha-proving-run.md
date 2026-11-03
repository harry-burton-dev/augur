# 0050. Alpha is proved by a build gate and a 48-hour run on staging

- **Status:** Accepted
- **Date:** 2026-11-03
- **Decided by:** Harry
- **Replaces:** none. Changes the gate in the handbook's PDR-011.

## Context

Alpha is the first AUGUR release built to run in production. Its aim is that an app can be built and shipped without changing the platform. The first version of the alpha plan judged that with calendar time: four weeks of building one app and a week of real use in each pillar app. There is no real work to put through them, so they would measure the calendar, not the platform. Faking the clock in services was considered and rejected: it would touch every service to prove what CI can prove with fake timers.

## Options

1. **Calendar soaks.** Honest only with real work to put through them.
2. **Compressed time with a clock seam in every service.** Proves weekly jobs quickly, but adds test-only code to production paths, and can't fake Keycloak tokens or signatures.
3. **Two gates: build an app, then run a release on fresh hardware for 48 real hours.** Measures what alpha is for; longer cycles are proved in CI.

## Decision

Option 3. Alpha ships when both gates pass.

- **The build gate.** A reference app is built from `augur-app-template` on the frozen SDK 2.0, using every seam an app has: its own data, entity bindings, Inbox items, notifications, email and a floor-targeted feature preview. It is pinned to the platform release tagged at the SDK 2.0 freeze. It passes only if it ships on that release, or on later releases where no pull request mentions the reference app or its issues.
- **The run gate.** The signed alpha release is installed by hand from `docs/deploy.md` on a staging deployment (preview ring, its own server, joined to the tailnet), with every step outside the guide logged. It then runs 48 wall-clock hours of scripted synthetic use, monitored as if live. Only jobs whose natural period fits inside 48 hours are expected to fire; weekly and longer cycles are CI checks with fake timers. The server clock is never faked.
- **The run ledger.** Every anomaly is a row with a class. No action, documented setting, patch (a platform patch that changes no contract) and docs gap are allowed. Failure is a contract change, an undocumented server step, data loss or a missed alert, and fails the run. A failure means a new signed release and a fresh run on a wiped server. A patch restarts the bake for the patched release.
- **The order of events.** The build gate passes on the workbench. Staging is installed on release A. The deliberately broken release is installed on request and goes back by itself ([0051](0051-install-a-halted-release-on-request.md)). The 72-hour bake for A starts once staging is back on A, and the 48-hour run happens inside it. Promote to stable then passes with no override. Staging is wiped and refreshed, and stays up on the preview ring for testers.
- **Where the run lives.** The run suite (timeline, persona cast, ledger, evidence) is its own repository, `augur-run`. Each app repository provides its own scenario module. The suite stays as a regression suite after alpha.

## Consequences

- No calendar soak holds the alpha.
- New repository: `augur-run`, with its own CI dry run against a fresh deploy-test install.
- `docs/deploy.md` gains sections to run a deployment as staging, to wipe and refresh it, and to decommission one.
- The check is the traceability table in `augur-run`: every gate goal maps to a run scenario, a CI check, the build gate or a recorded review, with evidence linked.

## Links

- Linear PER-245, PER-278
- Alpha milestone spec and implementation plan (private design notes)
