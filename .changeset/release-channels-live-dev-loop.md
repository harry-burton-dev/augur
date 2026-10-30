---
'@augur/shell': patch
---

The live dev loop: `pnpm dev:app <id> --kit` rebuilds the UI kit, its tokens and the shared modules as you change them and reloads the page; `DEV_PREVIEWS` turns an app's feature previews on in the stand-in; `DEV_HOST` opens the dev server to the tailnet. Each pull request's CI keeps its Storybook as an artifact (docs/release-channels.md, "The live dev loop").
