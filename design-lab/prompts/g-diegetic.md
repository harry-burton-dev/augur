---
batch: 2
kind: steered
concepts: [the-object-explains-itself, focal-planes, frame-for-urgency]
---

# Prompt G: Diegetic. Information that lives in the world.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-diegetic/prompt.md`.

---

Game designers sort interface into four kinds: **non-diegetic** (a HUD laid
over the world), **diegetic** (inside the world, like Dead Space's health
bar on the character's spine), **spatial** (placed in the world but not part
of it, like an outline on a door), and **meta** (on the screen's surface,
like blood spatter at the edges). Most software is all HUD: toolbars,
badges, panels laid over content. This run asks how much of AUGUR's chrome
could move into the objects and places themselves, so that a document,
a floor or a fact shows its own state, and the HUD can shrink. Work in
`design-lab/runs/<date>-diegetic/`.

## Direction
- **The object carries its state.** Before adding a badge, ask whether the
  object itself could show it (the-object-explains-itself).
- **Floors are places.** If a floor were a room, what would you see on
  arrival without reading a single label?
- **Meta for urgency.** The Letterbox is already a meta interface (it
  changes the screen itself); find what else belongs at that level.
- **Never at the cost of clarity.** Diegetic UI fails when players can't
  find vital information. Every variant shows where the plain fallback is.
- Explain, never hide; many deployments; calm at rest (from the brief).

## References and what to take from each
- **Fagerholt and Lorentzon's taxonomy** (2009) of diegetic, non-diegetic,
  spatial and meta UI. Take: the four kinds as a sorting tool for AUGUR's
  existing chrome.
- **Dead Space** (2008): health and stasis on the suit, holographic menus
  in the world, no HUD. Take: state on the subject itself.
- **Firewatch, Metro, Alien: Isolation**: maps, watches and devices held
  in the world. Take: the cost of making people look for information.
- **Journey and Inside**: almost no UI; light, movement and sound guide.
  Take: wayfinding without labels.
- **Game UI Database** for screenshots by genre. Take: concrete patterns.
- **Architecture: "light from two sides" and prospect-refuge**
  (Christopher Alexander, *A Pattern Language*). Take: how real rooms
  signal where to go.

## Surfaces (6 variants each)
1. **Taxonomy sheet** (grammar): AUGUR's current shell and app chrome
   sorted into the four kinds, with a proposal for each piece.
2. **A document that shows its state**: status, owner, age and approvals
   on the document itself, no status column.
3. **A floor as a room**: arriving at a Team or Department floor and
   reading its state from the space.
4. **Facts and entities in Data Atlas**: confidence and disputes on the
   value itself.
5. **Meta layer**: what belongs on the screen's surface (Letterbox,
   connection lost, read-only mode, impersonation).
6. **Spatial hints**: outlines and markers that show where to go next
   without a toolbar.

Round 2: combine into 3-4 screens. One must take a real AUGUR screen and
remove half its HUD, moving the information into the content, with a side
by side.

## Questions the shortlist must answer
- Which pieces of AUGUR chrome belong in which of the four kinds?
- What does each move cost a screen reader or keyboard user, and what is
  the plain fallback?
- Where this agrees or clashes with focal planes and the radial menu.

## Carry from earlier runs
Read `design-lab/concepts/README.md`, especially `the-object-explains-itself`,
`time-is-matter` and `frame-for-urgency`.
