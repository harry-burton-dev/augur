# @augur/app-kit (Quill)

The React kit apps build with (ADR 0015), on [Common](../kit-common/README.md). The shell serves it, with React 19 and Common, through the import map, so it keeps the SDK's promise ([Versioning](../../../docs/versioning.md#the-react-kits-adr-0015)) and an app's bundle carries none of it.

Its parts arrive as the Lit kit's groups move to React; until then apps keep `@augur/ui-kit`. For an app's own layout, Tailwind with only AUGUR's tokens:

```css
@import 'tailwindcss/utilities' layer(utilities);
@import '@augur/app-kit/theme.css';
```

No preflight: apps draw inside the shell, which already sets the page's base.

## Parts

Quill re-exports all of Common, so an app imports everything from `@augur/app-kit`. Its own parts are the ones only apps need:

- `AppFrame` lays out the three columns of docs/app-patterns.md. The rail holds `RailLink`s, the main column holds the screen, and the drawer holds `About`. The app's name and icon at the top of the rail open its `FrontPage`. The rail and the drawer fold to a strip, which the frame remembers on this device, and the frame tells the shell how much of the edge its drawer takes (`ui-drawer`).
- `FrontPage` has three sections: what needs you, what's new, and what's worth knowing. An empty section still says something.
- `About` is always in the same order: what it is, owner, floor, state, links and history. An empty row stays and says so.
- `More` goes under a long list ("Showing 50 of 312 records"). `SelectionBar` holds what to do with several picked things.

The parts apps used from the Lit kit, on React with the same words, looks and limits (PER-243). Events become callbacks (`ui-open` is `onOpen`, `ui-action` is `onAction`), and behaviour comes from React Aria where it has it:

| Lit kit | Quill |
| --- | --- |
| `ui-state`, `ui-status`, `ui-facts`, `ui-rows` | `State`, `Status`, `Facts`, `Rows` |
| `ui-notice`, `ui-note`, `ui-tag`, `ui-details` | `Notice`, `Note`, `Tag`, `Details` |
| `ui-page-head`, `ui-section` | `PageHead`, `Section` |
| `ui-list`, `ui-table` | `List` (a React Aria grid list), `Table` (a React Aria table) |
| `ui-card`, `ui-cards`, `ui-tally`, `ui-timeline`, `ui-path`, `ui-ref`, `ui-refs` | `Card`, `Cards`, `Tally`, `Timeline`, `Path`, `Ref`, `Refs` |
| `ui-date`, `ui-drop-zone`, `ui-surface` | `DateField`, `DropZone`, `Surface` |
| `ui-editor`, `ui-prose`, `ui-tree` | `Editor`, `Prose` (with `readMentions`, `writeMentions`, `plainText`), `Tree` (a React Aria tree) |

Common already had the controls (`Button`, `TextField`, `Select`, `Toggle`, `CheckboxGroup`, `Dialog`, `Menu`, `Heading`).

The shell loads `@augur/app-kit/kit.css` once, after Common's.
