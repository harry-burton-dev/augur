---
'@augur/mfe-sdk': minor
'@augur/shell': minor
'@augur/contract-tests': minor
---

Apps on the app contract move files over the bridge and can draw on a canvas. `ctx.files.upload` and `ctx.files.download` carry the bytes to and from the host, which calls the gateway with the person's token and answers a body past the app's `maxUpload` as the gateway would, without sending it; a download can be saved for the person; files dropped on the pane reach `ctx.files.onDrop`. With `contributes.canvas`, `ctx.canvas.open(entry)` shows a canvas in the pane in place of the screen: the shell's own page in a frame sandboxed to scripts, with an opaque origin and no network, which talks to the app only over the port `open` resolves to, and stops with the app.
