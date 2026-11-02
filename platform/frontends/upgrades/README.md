# Upgrade Centre

`@augur/upgrades` is the Upgrade Centre: a platform frontend at `/upgrades`, for admins ([ADR 0030](../../../docs/decisions/0030-upgrade-centre-platform-frontend.md)). It shows what this deployment runs, what's on offer and how each unit (AUGUR and each installed app) moves. It is React (ADR 0015) on Quill (`@augur/app-kit`): `AppFrame` with a rail of units and History, the front page as `FrontPage` (Needs you, On offer, Worth knowing), an `About` drawer on each unit, and Common's controls. Its name and icon come from the manifest. Only the status mark is still the Lit kit's (`ui-status`). Tailwind, limited to AUGUR's tokens, lays out the rest.

| Page | Path | What it shows |
| --- | --- | --- |
| Front page | `/` | Needs you, what's on offer, and worth knowing: this deployment, the next window, every unit and its state, when the feed was last read (with Check now) |
| A unit | `/augur`, `/apps/<id>` | How it moves (the policy sentence) with Change settings, what's on offer, and what it can go back to |
| History | `/history` | Every upgrade, newest first |

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
| `src/editor.tsx` | The settings editor: `PUT /platform/units/<unit>/desired-state`, answered with the overview. |
| `src/units.ts` | A row per unit from the overview, and its state in the spec's words. |
| `src/api.ts` | The registry calls, through `ctx.fetch`, and the gateway's refusals (`forbidden`, `step_up_required`). |
| `src/model/` | State words, Needs you, maintenance windows in a time zone, levels and pins, the upgrade's steps and how it ended, the way back from entering the password, and the policy sentence and checks worded as the registry words them. |
