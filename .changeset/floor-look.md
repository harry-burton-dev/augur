---
"@platform/ui-kit": minor
"@platform/shell": minor
---

Floors you can see. `ui-shell` takes `floors` and `floor`: the top left shows the current floor's icon and its breadcrumb from the org (each step goes up to it), a gauge at the right edge has a notch per floor from yours to the org, Account lists every floor in place of Switch workspace, and Page Up and Page Down go up or down a floor once the page is at its top or bottom (Alt for at once). It fires `ui-floor` with `{ id, direction }`, and a new `floor` plays the move: the floor's name shows for a moment, the app fades in, and the water slides in from above or below. `ui-wave-background` gains `level` and `move(direction)`, gliding colours and height between floors (a plain cross-fade under reduced motion). New `floor-you-*`, `floor-team-*` and `floor-org-*` colour tokens (one shared team colour), an `org` icon, and `floorStack`, `floorBeside` and `floorDirection` helpers. The shell passes the person's floors to `ui-shell` and keeps you in the same app when you change floor.
