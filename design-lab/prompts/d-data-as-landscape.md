---
batch: 1
kind: steered
concepts: [honest-blank, focal-planes, past-under-water, overview-rung, the-record-has-edges]
---

# Prompt D: Data as landscape. Cartography for an organisation.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-data-as-landscape/prompt.md`.

---

Spend this run exploring how AUGUR can borrow the techniques of
**cartography** to show an organisation's work as a place you can read and
travel through: where the load is high, where knowledge is thin, where
things are flowing, where the hazards are. Mapmakers solved density,
hierarchy and legibility centuries before dashboards existed. Find out which
of their techniques make AUGUR's views clearer, and which only look
impressive. Work in `design-lab/runs/<date>-data-as-landscape/`.

## Harry's direction for this run
- **A map earns its place by answering a question faster than a list.**
  Each variant names its question ("where is the work piling up?") and
  shows the list it beats.
- **Floors are the vertical axis already.** Up is towards Org; the map
  should agree with floor travel, not fight it.
- **Explain, never hide:** every mark is explained in place (hover or
  focus gives the number and the source), and areas you can't see are
  shown as unsurveyed, not left blank.
- **Many deployments:** no hand-drawn geography. Every shape is computed
  from data, so another organisation gets its own map.
- Calm: the base map is quiet; only what needs you stands out, using the
  cinematic light language.

## References and what to take from each
- **Eduard Imhof, *Cartographic Relief Presentation*; Swiss relief**:
  hillshading with warm lit slopes and cool shadows, aerial perspective
  (far things lighter and bluer). Take: depth from light, matching the
  focal planes.
- **Contours, hypsometric tints, hachures**: elevation as isolines and
  banded tints; hachures for slope. Take: load, risk or activity as height,
  with contour lines as thresholds (the limit lines from Open MCT, drawn
  as terrain).
- **Plan oblique relief**: high ground shifted up so it "stands up" on a
  flat map. Take: a cheap 2.5D that needs no 3D engine.
- **Nautical charts**: soundings (spot depths), hazards, leading lines,
  "unsurveyed" areas, notices to mariners. Take: confidence as depth in
  Data Atlas; known hazards; the honest blank.
- **Weather maps**: isobars, fronts, pressure systems moving over time.
  Take: change as weather (a front of work moving towards a deadline).
- **Harry Beck's London Underground map**: topology over geography, a
  strict angle grammar. Take: how floors, teams and apps connect, drawn as
  lines and interchanges.
- **Jacques Bertin's visual variables** and **Tufte's micro/macro
  reading**: readable from across the room and up close. Take: two
  reading distances on every map.
- **Charles Minard's march on Moscow**: flow, size and time in one figure.
  Take: one flow diagram (requests from Mandate through to Artifacts).

## Surfaces (6 variants each)
1. **Map language sheet** (grammar): base layers, marks (soundings,
   contours, fronts, hazards, interchanges, unsurveyed hatch), two reading
   distances, legend rules, token recipes.
2. **The org as terrain** (Explorer's org view): departments and teams as
   regions, work load as elevation, what needs you as lit summits.
3. **Data Atlas as a chart**: entities as coastline, confidence as depth,
   disputed facts as hazards, unsurveyed areas where nothing is known.
4. **Mandate intents as weather**: intents as fronts moving towards their
   deadlines, pressure as how many depend on them.
5. **Floors and apps as a line map**: You, Team, Department, Org and the
   apps on each, as a Beck-style map that doubles as navigation.
6. **Home "what needs you" as a relief**: the day as a landscape you scan
   in one glance, then dive into.

Round 2: combine into 3-4 screens. One must show a map and its list side by
side for the same question, and time a person (you, scripted) finding the
answer in each.

## Questions the shortlist must answer
- Which maps beat a list, for which questions, and which are decoration.
- Layout: which established layout algorithms (treemap, force layout,
  contour estimation from points) produce the shapes, and which maintained
  open-source libraries do it (adding one needs an ADR).
- Cost: SVG vs canvas for a 2,000-node org, and what degrades gracefully.
- Data the shell doesn't have yet (load per team, confidence per fact,
  dependencies between intents).

## Carry from earlier runs
Read `design-lab/concepts/README.md`. In particular:
- `past-under-water` (wear and time run): one water plane for the past; on a map, sea level can be "now".
- `overview-rung`: one cell per object for any large scope, then step down.
- `the-record-has-edges`: "unsurveyed" and "no record" as different marks from "stale".
