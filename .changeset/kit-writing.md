---
'@augur/ui-kit': minor
'@apps/atlas-frontend': patch
'@apps/folio-frontend': patch
'@apps/mandate-frontend': patch
---

App kit, part 5: the writing kit. New `ui-date` (a day said and typed in words, with quick choices and the calendar one press away), `ui-people-picker` (people and teams by name; ones that can't be added stay and say why), `ui-editor` (Markdown without a toolbar at rest: a bar on a selection, Ctrl B and Ctrl I, `@` and `#` mentions saved as references, and a soft length guide) and `ui-prose` (shows what the editor writes, safely). Data Atlas's seven date fields and Mandate's "Done by" use `ui-date`, and Mandate says its dates in words. Artifacts' share dialog finds people with `ui-people-picker`. Mandate's statement, back-brief and concern are written in `ui-editor` and shown with `ui-prose`. Timeline days with a year no longer carry a stray comma.
