# @im/ui-kit

The platform's UI kit: design tokens generated from the Claude Design system (working name Wave) and Lit web components rebuilt from its specs. Works in any framework.

```sh
pnpm --filter @im/ui-kit storybook        # catalogue at http://localhost:6006
pnpm --filter @im/ui-kit test
```

Load the tokens and base styles once per page, then import components:

```ts
import '@im/ui-kit/tokens.css';
import '@im/ui-kit/base.css';
import '@im/ui-kit';
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

Specs live in the design system's component READMEs.
