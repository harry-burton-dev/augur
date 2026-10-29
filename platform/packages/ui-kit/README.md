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
| `ui-button` | Primary, secondary, tertiary, ghost, danger (asks twice); `ai`, `size="sm"`, `busy`; `disabled` with a `reason` says why |
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
| `ui-notice` | One sentence in a page that needs attention, with one action: needs, warning, refused, info |
| `ui-note` | A quiet line that explains, with its `why` one press away; `live` for an action's result |
| `ui-can` | What you can do from here, and who can do the rest |
| `ui-app-frame` | An app's page: the slate ground, a rail, the main column and an aside |
| `ui-page-head` | Trail, eyebrow, title, one line of summary, two actions and ⋯ |
| `ui-section` | A labelled part with its count, one action and a why; folds after five |
| `ui-card`, `ui-cards` | One thing in a grid: title, mark, floor dot and name, one line of meta, at most one line that matters; unavailable cards stay and say why |
| `ui-tally` | Counts as a short bar of segments; words only for the total and what needs attention |
| `ui-details` | Label and value pairs; unknown values say so; folds after eight |
| `ui-timeline` | What happened, grouped by day in words, newest first; five then "Earlier" |
| `ui-path` | Where something sits on the floors above it, one disc per floor, you are here ringed |
| `ui-glance` | A quick look before you go in: veil, sheet, card, split, title; hairline or bubble; loading, error, empty |
| `ui-shell` | The frame apps run in: the band, the water, the stage, and the sky (stream, Apps, Find, Agents, Account, Settings), summoned with ` or Ctrl/⌘ K |
| `ui-wave-background` | The water: navy and green bands over slate. Calm Tide by default; Deep Ocean, Aurora, Sonar Line, Minimal and Split Field as variants. `pulse()` swells it |
| `ui-centre-menu` | One focal point, categories across and items down. `variant="title"` picks the app (letterbox, chapters); `variant="orbit"` is the menu inside it (a ring). Keys, wheel, trackpad and drag move both ways and settle; a category with no items is a choice by itself, and `section` names the part a category is in; type to search, right-click for options, `ai` items are bubbles. Follows the [shell principles](../../../docs/shell-principles.md) |

Specs live in the design system's component READMEs.
