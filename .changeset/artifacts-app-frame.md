---
"@apps/folio-frontend": minor
"@augur/ui-kit": minor
"@augur/shell": patch
---

Artifacts gets the three-column app layout from the live session with Harry: a rail that folds to icons (the app's name on top opens its front page, then Your collections, Shared libraries, From below, and the open collection), the content in the middle with Back above its title and a search above the grid, and a drawer on the right that says what's on screen. Collections, folders and documents are tiles that answer hover by rank; right-click one, or the empty grid, for a ring of what can be done with it. The front page shows only what needs you, what's new, and your collections. What was "Published to you" sits under Shared libraries. The reader keeps its facts and actions in the drawer too.

New in the kit: `ui-tile`/`ui-tiles`, `ui-toolbar`, `ui-radial-menu`, and `ui-app-frame` gains a folding rail and a drawer. `pnpm dev:app` now runs on Windows.
