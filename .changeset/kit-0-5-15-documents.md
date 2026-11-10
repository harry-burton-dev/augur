---
'@augur/shell': minor
'@augur/mfe-sdk': patch
'@augur/admin': patch
'@augur/home': patch
'@augur/upgrades': patch
---

On kit 0.5.15, an app on the app contract can describe what a documents app needs: `quill-reader`, `quill-file-button`, `quill-people-picker`, `quill-floor-path` and `quill-filter-bar`. The shell fetches a reader's pictures itself, only under the app's own `/api/<id>/` and with the person's token, and frees them when the app stops (ADR 0092). A file button's files reach the app's `ctx.files.onDrop` handler as a drop does; while the app has no handler, the button says it can't take files.
