# Upgrade Centre

`@augur/upgrades` will be the Upgrade Centre: a platform frontend at `/upgrades`, for everyone with an Upgrade Centre role ([ADR 0030](../../../docs/decisions/0030-upgrade-centre-platform-frontend.md)). It shows what this deployment runs, what's on offer and what would happen, and lets deployment admins upgrade, pin, hold or go back, for AUGUR and each app.

So far it holds the parts that don't depend on the app kit:

| File | What it does |
| --- | --- |
| `src/api.ts` | The registry calls, through `ctx.fetch`, and the gateway's refusals (`forbidden`, `step_up_required`). |
| `src/model/states.ts` | A unit's state (running, watching, halted, held, waiting for you, waiting for its window, update available, up to date), with words and an icon for each. |
| `src/model/needs-you.ts` | Everything waiting on a person, across AUGUR and the apps. |
| `src/model/time.ts` | Maintenance windows in the deployment's time zone, and times written absolute and relative. |
| `src/model/levels.ts` | Patch, minor or major from what runs; pins as semver ranges. |
| `src/model/sentence.ts` | The one sentence that sums up a unit's policy, channel, pin and window. |

It isn't in the registry's platform apps yet, so nobody is offered it. The screens come once the app kit (Quill) is ready, and Admin's Upgrade Centre page stays until they reach the same ground.
