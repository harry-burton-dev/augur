---
'@augur/shell': minor
'@augur/contract-tests': minor
---

Kit 0.6.5 (shell-kit 0.16.0): at 320 px the desktop bar folds what doesn't fit, open apps included, into More, and a split pane's columns stay inside the pane (WCAG 2.2 reflow). Muted text is drawn in ink-muted, not faded, so it keeps 4.5:1 contrast. A new contract test, `reflow.spec.ts`, holds the desktop and an open app at 320 px: nothing cut off past either edge, and nothing scrolling sideways.
