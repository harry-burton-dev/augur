---
"@augur/shell": minor
"@augur/admin": patch
"@augur/upgrades": patch
"@augur/home": patch
"@augur/contract-tests": patch
---

A deployment can choose how depth is drawn behind dialogs, menus and the palette (ADR 0068, PDR-010 amendment 2): `FOCUS_DEPTH` (`veil`, `lens` or `scrim`) reaches the shell's page as an `augur-depth` meta, which Quill reads for the shell and every app. `scrim` blurs nothing, for desktops without a GPU. Unset, each app chooses as before.

Serves Quill 0.11.0 (Common 0.9.0, kit bundle 0.5.6), which reads it, and PDR-010's tile amendments: a dimmer document tile and a "more" mark on tiles.
