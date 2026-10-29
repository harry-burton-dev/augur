---
'@augur/ui-kit': minor
'@apps/atlas-frontend': patch
'@apps/mandate-frontend': patch
---

App kit, part 3: more at a glance. New `ui-card` and `ui-cards` (one thing in a grid, its floor shown as a dot and a name, with at most one line that matters; unavailable cards stay and say why), `ui-tally` (counts as segments, saying only what needs attention), `ui-details` (label and value, unknowns said, folding after eight), `ui-timeline` (history grouped by day in words) and `ui-path` (line of sight down the floors). Mandate's intent cards drop the coloured edge stripe for the floor dot and gain a tally of the parts below; its line of sight and history use `ui-path` and `ui-timeline`. Data Atlas shows an entity's, a fact's and an observation's details with `ui-details`.
