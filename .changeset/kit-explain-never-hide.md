---
'@augur/ui-kit': minor
'@augur/admin': patch
'@augur/shell': patch
'@apps/atlas-frontend': patch
'@apps/folio-frontend': patch
'@apps/mandate-frontend': patch
---

App kit, part 1: nothing is obtuse. `ui-button` and `ui-icon-button` take a `reason`: disabled with one, they stay focusable and say why on hover and focus, and it's read aloud. List rows, list actions and menu entries take a `reason` too. The kit warns on localhost about a disabled control without one, and `pnpm check:reasons` fails a platform screen that has one. New parts: `ui-notice` (one sentence that needs attention, with one action), `ui-note` (a quiet line with its `why` one press away) and `ui-can` (what you can do here, and who can do the rest). Every disabled control in Admin, the shell, Artifacts, Mandate and Data Atlas now says why, and ones that were only waiting for a request show as busy instead.
