---
"@augur/shell": minor
---

A deployment can choose how depth is drawn behind dialogs, menus and the palette (ADR 0068, PDR-010 amendment 2): `FOCUS_DEPTH` (`veil`, `lens` or `scrim`) reaches the shell's page as an `augur-depth` meta, which Quill reads for the shell and every app. `scrim` blurs nothing, for desktops without a GPU. Unset, each app chooses as before.
