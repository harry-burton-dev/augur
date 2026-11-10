---
"@augur/mfe-sdk": minor
"@augur/app-tools": minor
"@augur/shell": minor
---

An app on contract 3 chooses its pane's layout from the shell's named ones: `focus`, `aside` (with the About panel), `split` and `canvas`, with `density` and `inset` beside `width`. `contributes.frame` in the manifest sets the defaults, and `ctx.frame.set` changes them for a page. The shell takes the choice and shows the About panel only in `aside`; an app with About sections and no choice keeps `aside`, so nothing it shows today moves. The spacing of each layout follows in the next kit release.
