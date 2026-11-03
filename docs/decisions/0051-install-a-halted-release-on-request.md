# 0051. A deployment admin can install a halted release on request, on dev and preview servers only

- **Status:** Accepted
- **Date:** 2026-11-03
- **Decided by:** Harry
- **Replaces:** none. Extends [0017](0017-signed-release-feed.md) (halted releases) and [0020](0020-upgrade-policy-windows-watch.md) (the watch).

## Context

The self-upgrade chain (signed feed, watch, going back by itself) has only been tried against fakes (PER-201). The alpha proving run ([0050](0050-alpha-proving-run.md)) has to show AUGUR going back from a broken release on real hardware. Any signed AUGUR release lands in the one feed every deployment reads, and a halted release is offered to no one and taken by no one.

## Options

1. **Halt a deliberately broken release at once, and let a dev or preview server install it on request.** Proves AUGUR's own go-back on real hardware, with one small updater change.
2. **Break a release of an app instead.** No platform change, but it proves only the app runner's go-back; AUGUR's own is left to CI.
3. **A separate signing branch and feed that only staging reads.** Fully isolated, but a second branch, feed and trust rule to keep.

## Decision

Option 1. The updater and registry install a halted release only when all of these hold:

- the server's `SERVER_RING` is `dev` or `preview`; a production server refuses it;
- the person holds `deployment-admin` and has signed in freshly ([0022](0022-upgrade-roles-step-up.md));
- the request names the exact version and gives a reason.

Every request, allowed or refused, goes to audit with the person, the version and the reason. The watch then judges the release as it judges any other, and goes back by itself if it fails.

## Consequences

- A halted release stays invisible to every Automatic policy and to every production server.
- The change ships in the stepping-stone release before alpha, because it can't be added during the run.
- Tested by the deploy test's broken mode, and by the run's first step on staging.

## Links

- Linear PER-201, PER-245, PER-278
