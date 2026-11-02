# @augur/app-kit

## 0.2.0

### Minor Changes

- f8e9b46: Quill gets its first parts: AppFrame (three columns with a rail that folds to icons, the app's name opening its front page, and a drawer), RailLink, FrontPage, About, More and SelectionBar. Quill re-exports Common, and the shell loads Quill's `kit.css`. The tokens-only test now covers every kit's source.
- da54ae3: Quill gets depth and focus (PDR-010). `FocusStage` racks the app out of focus behind a dialog, the palette or the radial menu instead of a scrim (`veil`, `lens` or the old `scrim`), and `AppFrame` is one. `FocusField` and `FocusItem` let one thing pull focus while the rest sit ambient (`soft` or `quiet`). `RadialMenu`, opened on anything with `useRingTarget` (right-click, the context-menu key, Shift+F10 or a long press), rings a tile or fans beside a row, keeps unavailable actions with their reasons, and turns into a list past eight. `PathTree` lights the path you took and dims its neighbours. `FrontPage` takes a config any app can reuse (`FrontPageConfig`, `frontSections`), a title look and reels (`Reel`, pulled in one at a time or shown at once). `KindTile`, `AddTile` and `Tiles` give each kind of thing its own shape, and `Palette` finds and goes. New tokens in Quill's set: `depth-*`, `ambient-*`, `path-dim`, `ring-*` and `reel-card`.
- 7c8027d: Quill gains `Lifecycle`, `PeoplePicker`, `Reader` and `Contents`, the React parts for the Lit kit's `ui-lifecycle`, `ui-people-picker`, `ui-reader` and `ui-contents`, so Artifacts' details, sharing and reading can move to the new layout. `Reader` loads markdown-it the first time it shows something, as the Lit reader does.
- d500567: Quill has the parts apps used from the Lit kit, on React: State, Status, Facts, Rows, Notice, Note, Tag, Details, PageHead, Section, List, Table, Card, Cards, Tally, Timeline, Path, Ref, Refs, DateField, DropZone, Surface, Editor, Prose and Tree. Common exports its field pieces (FieldHead, FieldHint, StateMark, useMessage, useValue) so Quill's fields read like its own.
- a8854e2: Quill has `TagPicker`, the Lit kit's `ui-tag-picker` on React (PER-243): pick any number of tags by typing, the chosen shown as tags in the field, with an optional limit and `onCreate` for a word that isn't a tag yet.

### Patch Changes

- 527a413: Mandate is on React and Quill (PER-243): the floor's intents, what you hold, one intent with its statement, line of sight, parts below and what it's bound to, its dialogs, the picker other apps open with `aim.pick` and its card on Home. The words, limits and behaviour are the same as before; it no longer uses the Lit kit. Quill's `Editor` and `DateField` take a `defaultValue` for when they keep their own value.
- Updated dependencies [f8e9b46]
- Updated dependencies [2a827a0]
- Updated dependencies [d994d7b]
- Updated dependencies [2a827a0]
- Updated dependencies [2a827a0]
- Updated dependencies [2a827a0]
- Updated dependencies [2a827a0]
- Updated dependencies [f8e9b46]
- Updated dependencies [da54ae3]
- Updated dependencies [d500567]
  - @augur/kit-common@0.2.0
