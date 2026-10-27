---
'@augur/ui-kit': minor
---

`ui-centre-menu`: the wheel, a trackpad and a press-and-drag move both ways in Title and Orbit, following the hand and settling on the nearest item; a notched wheel still moves one item per notch, and a drag locks to one axis after 6px. The wheel now works in the shell (its listener was lost when the menu first drew empty). Categories are a tablist and items a listbox, shown icons keep at least 55% opacity, and the hint line is shorter. The rules are in docs/shell-principles.md.
