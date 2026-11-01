# Upgrade Centre

`@augur/upgrades` is the Upgrade Centre: a platform frontend at `/upgrades`, for admins ([ADR 0030](../../../docs/decisions/0030-upgrade-centre-platform-frontend.md)). It shows what this deployment runs, what's on offer and how each unit (AUGUR and each installed app) moves. It is React (ADR 0015) and draws with the Lit kit's parts until Quill has its own, with Tailwind limited to AUGUR's tokens for its layout.

| Page | Path | What it shows |
| --- | --- | --- |
| Overview | `/` | Needs you, this deployment, every unit and its state, the next maintenance window, when the feed was last read (with Check now) |
| A unit | `/augur`, `/apps/<id>` | How it moves (the policy sentence), what's on offer, and what it can go back to |
| History | `/history` | Every upgrade, newest first |

Changing a version still happens in Admin's Upgrade Centre page: the buttons here stay visible, greyed out, and say so (or name the `deployment-admin` role when you don't hold it). The change flow, pins, holds and windows follow as the updater's steps land.

| File | What it does |
| --- | --- |
| `src/entry.tsx` | Mounts the React app, and adds its stylesheet once. |
| `src/app.tsx` | Pages and moving between them without reloading the shell. |
| `src/data.ts` | Reads the registry, every 2 s while a job runs and every 30 s otherwise. |
| `src/units.ts` | A row per unit: running version, offer, policy, pin, state. |
| `src/api.ts` | The registry calls, through `ctx.fetch`, and the gateway's refusals (`forbidden`, `step_up_required`). |
| `src/model/` | States, Needs you, maintenance windows in the deployment's time zone, levels and pins, the policy sentence. |
