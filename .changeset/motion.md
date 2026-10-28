---
"@augur/ui-kit": minor
"@augur/shell": minor
---

Moving between Title, Orbit and an app is one motion: what you chose is carried from where it was to where it lands. The menu steps aside (deeper into Title or Orbit, or down on Back), the chosen icon or app name flies to its place on the next screen, and an opened app rises a short way into place while its surfaces settle in one after another. Leaving an app sinks it before Orbit comes back. A key or press during a move jumps it to its end, and "Opening…" shows only when an app takes longer than 400ms. New kit `motion.ts` exports `motionMode()`, `liftGhost()`, `finishMotion()` and `moving()`; `ui-shell` gains `arrive()`, `sink()`, `settleStage()` and `placeTitle`, and `ui-centre-menu` gains `leave()`, `focusedIcon()` and `focusedRect()`. Reduced motion is one switch: the system setting or `data-motion="reduce"` sets every motion token near zero in the kit's base styles, stops loops, and leaves only crossfades. New token `travel-near` (24px).
