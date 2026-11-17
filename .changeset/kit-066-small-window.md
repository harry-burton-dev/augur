---
'@augur/shell': minor
'@augur/contract-tests': patch
---

Kit 0.6.6: in a small window (under 720 px), the open app has the width. The floor picker sits in the top band, and the app pane is a toggle there that opens over the page. At 320 px an app now gets 236 px instead of 88 px, so the reflow contract test passes again. The reflow contract test now names what runs past the edge.
