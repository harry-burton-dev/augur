# Upgrade Centre

`@augur/upgrades` is the Upgrade Centre: a platform frontend at `/upgrades`, for admins (ADR 0030). It shows what this deployment runs, what's on offer and how each unit (AUGUR and each installed app) moves. It is React (ADR 0015) on Quill (`@augur/app-kit`): `AppFrame` with a rail of units and History, the front page as `FrontPage` (Needs you, On offer, Worth knowing), an `About` drawer on each unit, and Common's controls. Its name and icon come from the manifest. Tailwind, limited to AUGUR's tokens, lays out the rest.

| Page | Path | What it shows |
| --- | --- | --- |
| Front page | `/` | Needs you, what's on offer, and worth knowing: this deployment, the next window, every unit and its state, when the feed was last read (with Check now), and how it reports to Backstage |
| A unit | `/augur`, `/apps/<id>` | How it moves (the policy sentence) with Change settings, what's on offer, and what it can go back to |
| History | `/history` | Every upgrade, app install or removal, and change of settings (with the sentence before and after), newest first; filters by unit, who started it (a person, By itself, Watch) and outcome; Export as CSV |

"I've looked at this" on a failed or went-back result clears it for every admin.

**Changing a version** happens here now. On AUGUR's page, **Upgrade AUGUR to X** asks first: what needs you (new settings, filled in place), a link to the release notes, and when (now; "in the next window" stays visible, greyed out, until the registry can schedule). AUGUR moves one release at a time, so only the next one can be started; later ones say why. **Go back** offers the release it came from. An app's release installs from its page; going an app back is still Admin's, and the button says so. Once started, the page follows the updater's steps (checks, backup, new images, switch over, health checks, watch for 10 minutes, and going back if it does), shows Cancel while it can still be cancelled, and says how it ended. Every button that can't be used stays visible and says why (the `deployment-admin` role, an upgrade already under way, nothing newer).

When the registry asks for the password again (`sign_in_again`: upgrading, going back, installing and changing settings each need a sign-in in the last 10 minutes), the page goes to the shell's sign-in and comes back to the same question, already open. Settings typed so far are kept for that tab only (`sessionStorage`), never in the address. Admin's own Upgrade Centre page stays until it is retired on purpose.

**Change settings** on a unit edits its desired state (ADR 0020): the channel (AUGUR's is fixed by `RELEASE_CHANNEL`, and a production server's apps follow Production; both stay visible and say why), Automatic, Ask first or Hold, how far Automatic goes, a pin, and the weekly windows in a time zone. The sentence for now and after saving sit side by side with the next three windows, and the registry's own checks run before saving. It needs the `deployment-admin` role.

| File | What it does |
| --- | --- |
| `src/entry.tsx` | Mounts the React app, and adds its stylesheet once. |
| `src/app.tsx` | Pages and moving between them without reloading the shell. |
| `src/data.ts` | Reads the registry's overview (the same one Backstage reads), AUGUR's updates and the apps' installs: every 2 s while a job runs, every 30 s otherwise. |
| `src/change.tsx` | The upgrade, go back and install questions, following an upgrade step by step, and an app's job. |
| `src/history.tsx` | The history page, from AUGUR's upgrade history, `GET /app-runner/jobs` and each unit's `desired-state/history`. A part it can't read is named, and the rest still shows. |
| `src/reporting.tsx` | Reporting to Backstage (ADR 0019), under Worth knowing: the registry's why, the name in Backstage, the public key with Copy, the last send or its problem, and Export the record. |
| `src/editor.tsx` | The settings editor: `PUT /platform/units/<unit>/desired-state`, answered with the overview. |
| `src/units.ts` | A row per unit from the overview, and its state in the spec's words. |
| `src/api.ts` | The registry calls, through `ctx.fetch`, and the gateway's refusals (`forbidden`, `step_up_required`). |
| `src/model/` | State words, Needs you, maintenance windows in a time zone, levels and pins, the upgrade's steps and how it ended, the history list and its CSV, the way back from entering the password, and the policy sentence and checks worded as the registry words them. |

## Under the app contract

Deployment, the Upgrade Centre's new name, is being rebuilt as a contract 3 app (ADR 0075, 0076). Its frontend runs in the shell's worker, so it draws Quill's remote elements by name and reaches only the registry, through the gateway. It is built beside the page above as `dist/sandbox.js` (`vite.sandbox.config.ts`), and the shell starts using it when the registry lists Deployment's contract 3 manifest. Until then, the page above is what people use.

Its pages are Overview (the one thing that needs you, what's installed and the deployment's status), AUGUR (available updates and breaking changes, upgrade, roll back, and its upgrade history) and Apps, with each installed app under it in the rail (its update, and its install history). Each page keeps its own history: there's no History page. A question that may need the password again has its own path (`/augur/upgrade/<version>`, `/augur/roll-back/<version>`, `/augur/test/<version>`, `/apps/<id>/install/<version>`), so signing in again comes back to it open. Settings typed into a question are typed again after signing in: a worker keeps nothing between visits, and the address must never hold them. Whether the person may change anything comes from the overview's `you.deploymentAdmin`, because a contract 3 frontend is never told anyone's roles. Without it, each change stays visible, turned off, naming the deployment-admin role.

| File | What it does |
| --- | --- |
| `src/sandbox/entry.ts` | `start(ctx)`: reads, draws, follows the shell's moves, and runs each change. |
| `src/sandbox/routes.ts` | Pages and questions, to and from their paths. |
| `src/sandbox/data.ts` | Reads the overview, AUGUR's updates, the apps and their jobs: every 2 s while something runs, every 30 s otherwise. |
| `src/sandbox/view.ts` | Overview and Apps, the installed table, and each page's history. |
| `src/sandbox/unit.ts` | AUGUR's and each app's page, following an upgrade, and the upgrade, roll back, test and install questions. |
| `src/sandbox/words.ts` | The words release and operations people use: update available, breaking change, roll back, release channel. |
