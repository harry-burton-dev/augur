---
"@augur/shell": minor
"@augur/identity": minor
"@augur/admin": patch
"@augur/upgrades": patch
"@augur/home": patch
"@augur/contract-tests": patch
---

The app bar replaces Title and Orbit (PDR-020), on kit 0.5.8 (Common 0.11, Quill 0.13, Aerie 0.8.1). On the desktop the bar runs across the still horizon with a tile per group of apps, from each app's manifest category: Platform, Pillars, then Apps. With an app open it docks as the rail beside it, with Home, Apps, the app and its pages, one per item of its manifest menu; an app with one page or none shows no page list. Esc no longer leaves an app: it closes a start menu, and Home in the rail goes back to the desktop. The groups' names are the shell's words, not the kit's. Where the bar rests is kept in the person's preferences: Identity takes `barStop` (0 to 3) in `PUT /v1/me/preferences` (contract 1.31.0). The manifest's `areas` and `orbit` are still read but no longer drawn. The contract tests check the desktop bar, a start menu, the rail, Esc, Home and an address with no app.

The kit is the Horizon look Harry picked on 6 Nov 2026, for the shell's own pages and every app that takes the kit from `KIT_URL`: square corners, buttons as keys, fields, checks, toggles and selects as wells with one focus ring, solid sheets for dialogs, notices, toasts, menus and tips, and the needs-you colour and the typefaces (Instrument Sans, IBM Plex Mono) as tokens. Nothing an app uses is removed.
