# Deployment

`@augur/upgrades` is Deployment (it was the Upgrade Centre; its id and route stay `upgrades`): a platform app at `/upgrades`, for admins (ADR 0030). It shows what this deployment runs, what's available and how each component (AUGUR and each installed app) takes new releases, and it upgrades, rolls back and installs them.

It is a contract 3 app (ADR 0075, 0076). Its frontend is one ES module, `dist/sandbox.js`, which the shell runs in a web worker. It draws Quill's remote elements by name and reaches the registry, the gateway's status and the events service's deliveries, through the gateway. The registry lists its manifest (`platformManifests3` in the registry's `manifest.ts`), and the web image serves the module at `/apps/upgrades/<version>/`.

| Page | Path | What it shows |
| --- | --- | --- |
| Overview | `/` | The one thing that needs you, lit, with one action; Installed (component, running, available, status); and Status (release channel, server, next maintenance window, release feed and its signature, updater), with Check for updates |
| AUGUR | `/augur` | Available updates and their breaking changes, upgrade, install a halted release for a test, roll back, following an upgrade step by step, and the upgrade history |
| Apps | `/apps`, `/apps/<id>` | Each installed app, also under Apps in the rail: its update, install, roll back (Admin's for now, and it says so), and its install history |
| Health | `/health` | Each part's health and what to check when one is down, email, how each app takes its events, and why there's no incident history yet |
| Backups | `/backups` | The last backup, the copy off the server, point in time and the restore tests, and how restoring is done |
| Release channel | `/release-channel` | The channel this deployment tracks, each component's as an inline choice, each component's path from main to stable from the pipeline feed, and every change of channel |
| Settings | `/settings`, `/settings/<unit>` | Each component's release channel and update policy as inline choices that save at once; its maintenance windows and version pin in the editor, with the sentence now and after saving side by side; reporting to Backstage; and the settings history |

Each page keeps its own history, a page at a time in the kit's paged list: there's no History page. The words are the ones release and operations people use: update available, breaking change, roll back, release channel, maintenance window.

A question that may need the password again has its own path (`/augur/upgrade/<version>`, `/augur/roll-back/<version>`, `/augur/test/<version>`, `/apps/<id>/install/<version>`, `/settings/<unit>`). When the registry answers `sign_in_again`, the app calls `ctx.signInAgain()`, and the person comes back to the same question, open. Whatever they typed is typed again: a worker keeps nothing between visits, and the address must never hold settings.

Whether the person may change anything comes from the overview's `you.deploymentAdmin`, because a contract 3 frontend is never told anyone's roles. Without it, every change stays visible, turned off, naming the deployment-admin role. The registry checks again and has the last word.

| File | What it does |
| --- | --- |
| `src/entry.ts` | `start(ctx)`: reads, draws, follows the shell's moves, and runs each change. |
| `src/routes.ts` | Pages and questions, to and from their paths. |
| `src/data.ts` | Reads the overview, AUGUR's updates, the apps and their jobs, the gateway's status and event deliveries: every 2 s while something runs, every 30 s otherwise. |
| `src/view.ts` | Overview and Apps, the Installed table, and each page's history. |
| `src/unit-page.ts` | AUGUR's and each app's page, following an upgrade, and the upgrade, roll back, test and install questions. |
| `src/health.ts` | Health and Backups, from the gateway's `GET /status` and the events service's `GET /deliveries`. |
| `src/channel.ts` | Release channel: the pipeline feed's line (`line` on the registry's updates) and the channel changes from each unit's settings history. |
| `src/settings.ts` | Settings: the editor (`PUT /platform/units/<unit>/desired-state`), reporting, and the settings history from each unit's `desired-state/history`. |
| `src/words.ts` | Deployment's words for channels, policies, states, outcomes and steps. |
| `src/api.ts` | The calls, through `ctx.fetch`, and the gateway's refusals. |
| `src/units.ts` | A row per component from the overview, and its state. |
| `src/model/` | Needs you, maintenance windows in a time zone, levels and pins, the upgrade's steps and how it ended, the history list, and the policy sentence and checks worded as the registry words them. |
