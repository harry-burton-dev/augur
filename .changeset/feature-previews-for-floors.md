---
'@augur/registry': minor
'@augur/admin': minor
'@augur/shell': patch
---

Feature previews can be turned on for chosen floors: Admin → Apps picks the floors, the preview is on there and on the floors beneath them, and off everywhere else, without a release (ADR 0021, amended). `ctx.previewOn` is unchanged; an app's service passes `?workspace=` when it asks the registry for a person.
