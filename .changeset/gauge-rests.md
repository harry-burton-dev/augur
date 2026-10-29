---
'@augur/mfe-sdk': minor
'@augur/ui-kit': minor
'@augur/shell': minor
'@augur/registry': minor
---

The floor gauge opens out smoothly. Pointing at it or tabbing into it, each floor's label grows from nothing to its size while it fades in, the gaps widen, and the pinned app icon shrinks away, so nothing jumps. It closes the same way. In an app that shows the same on every floor, the gauge rests: it stays in view, dimmed, and pointing at it says why, and Page Up and Page Down don't move floors. Apps say this with the new manifest field `sameOnEveryFloor` (SDK 1.6, registry contract 1.22.0), and Admin sets it. `ShellApp` gains `sameOnEveryFloor`, and `ui-shell` gains `floorsRest`.
