# 0020. AUGUR upgrades follow a policy, a maintenance window, a semver pin and a post-upgrade watch

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry

## Context

Apps already have Automatic, Ask first and Hold. AUGUR itself takes releases by itself only on the workbench; everywhere else an admin starts each upgrade. There are no maintenance windows, pins are exact versions, and the health gate ends as soon as each service answers on its new version.

## Options

1. **One desired-state record per unit (AUGUR and each app) holding channel, policy, pin range and window, with a 10-minute watch after each upgrade.** The updater reconciles to it, and Flux could later do the same on Kubernetes.
2. **Keep starting every AUGUR upgrade by hand.**

## Decision

Option 1.

- **Policy.** On production, AUGUR patch releases are Automatic and minors and majors are Ask first by default. Automatic never takes a major, a release needing a setting only a person can give, or one that asks for new powers.
- **Windows.** Weekly slots per deployment in its own time zone (production default Sunday 02:00 for 2 hours, workbench any time). Automatic upgrades start only inside a window. No cron library: a weekly rule needs none.
- **Pins** are semver ranges (`0.13.x`), as Flux's ImagePolicy uses them.
- **Watch.** For 10 minutes after an upgrade, the updater checks the gateway's error rate and a sign-in probe, and goes back by itself if either crosses its threshold and no release between is breaking.

## Consequences

- The registry gains the desired-state record and its history. Every change to it is audited.
- Thresholds start at an error rate above 5% or a failed sign-in, and are tuned after real use.

## Links

- Linear PER-177
- Upgrade Centre UI spec (a private design note)
