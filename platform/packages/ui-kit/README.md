# @augur/ui-kit

The platform's UI kit: design tokens generated from the Claude Design system (working name Wave) and Lit web components rebuilt from its specs. Works in any framework.

```sh
pnpm --filter @augur/ui-kit storybook        # catalogue at http://localhost:6006
pnpm --filter @augur/ui-kit test
```

Apps on the platform don't bundle the kit: the shell serves one copy for every app through an import map, so the kit follows the SDK's versioning promise ([Versioning](../../../docs/versioning.md#the-shared-kit)). Load the tokens and base styles once per page, then import components:

```ts
import '@augur/ui-kit/tokens.css';
import '@augur/ui-kit/base.css';
import '@augur/ui-kit';
```

| Element | What it is |
| --- | --- |
| `ui-button` | Primary, secondary, tertiary, ghost, danger (asks twice); `ai`, `size="sm"`, `busy` |
| `ui-surface` | Pane, raised, inset, overlay, bar, veil |
| `ui-heading` | Eyebrow, title, summary |
| `ui-status` | Needs you, running, queued, paused, done, failed, check |
| `ui-text-field` | Label, hint, line; needs-you, error, warning, valid, read-only, busy; form-associated |
| `ui-table` | Sort (status by urgency), filter, select, open, loading, empty, error |
| `ui-dialog` | Native dialog on the veil; checks slotted fields, async submit with busy and error |
| `ui-icon` | Line icons from [Lucide](https://lucide.dev) (ISC), under the kit's own names, bare or in the bubble. To add one, import it in `icon.ts` and name it |
| `ui-icon-button` | A named icon in a round target; name shows on hover and focus; `ai`, `size="sm"` |
| `ui-keycap`, `ui-back` | A key as an outlined cap; the Esc Back control |
| `ui-facts` | Up to three values worth a glance; loading |
| `ui-rows` | Up to five label and value lines; loading, empty, error |
| `ui-glance` | A quick look before you go in: veil, sheet, card, split, title; hairline or bubble; loading, error, empty |
| `ui-conversation`, `ui-confirm-card` | AI Design: a conversation with an agent (its lines in the bubble), and the card that asks before an agent does anything (Allow, Not now) |
| `ui-shell` | The frame apps run in: the band, the water, the stage, and the sky (stream, Apps, Find, Agents, Account, Settings), summoned with ` or Ctrl/⌘ K |
| `ui-wave-background` | The water: navy and green bands over slate. Calm Tide by default; Deep Ocean, Aurora, Sonar Line, Minimal and Split Field as variants. `pulse()` swells it |
| `ui-centre-menu` | One focal point, categories across and items down. `variant="title"` picks the app (letterbox, chapters); `variant="orbit"` is the menu inside it (a ring you can spin). Type to search, right-click for options, `ai` items are bubbles |

Specs live in the design system's component READMEs.
