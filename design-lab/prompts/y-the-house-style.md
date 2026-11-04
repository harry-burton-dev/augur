---
batch: 6
kind: steered
concepts: [light-as-signal, focal-planes, dark-when-normal, feel-as-a-setting]
---

# Prompt Y: The house style. An art direction AUGUR can be known by.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-the-house-style/prompt.md`.

---

Batch 6 is about **thinking made visible**: the art style AUGUR's work
appears in, the reasoning people put into their outputs, and the climb
from data to information to context to intent. This prompt is the art
style.

AUGUR already has a visual language: slate ground, glowing "water" bands
of navy and green, Jost with wide tracking, glass panes, the cinematic
light language and focal planes. What it doesn't have is an **art
direction**: a named tradition behind those choices that says what a new
screen, an empty state, a diagram or an illustration should look like
before anyone draws it. Without one, each new part drifts towards generic
software. This run asks which real art and design traditions could become
AUGUR's house style, and tests each one on the same screens. Work in
`design-lab/runs/<date>-the-house-style/`.

## Direction
- **One tradition per variant, applied all the way down**: ground, light,
  colour relations, line, type, image, motion. A tradition that only
  survives as a background texture fails.
- **Grow from what won.** The water bands, the light language and dark
  when normal stay; the question is what art they belong to.
- **Many deployments.** The style must hold when an organisation adds its
  own name, colour and floor names, and must never look like any one
  organisation's brand.
- **Quiet at work, rich at rest points.** Working screens stay calm; the
  style can speak more on Home, empty states, onboarding and the sign-in.
- **Images without hand-drawn icons.** Icons stay Lucide. Any
  illustration must be generated from data or geometry (SVG or canvas),
  never hand-drawn paths, and must say what it shows.
- Explain, never hide; many deployments; calm at rest (from the brief).

## References and what to take from each
- **Japanese woodblock prints** (Hokusai, Hiroshige, Hiroshi Yoshida's
  water prints) and their *bokashi* colour gradation. Take: flat planes,
  graded water, and a few colours carefully layered. The closest match to
  the water bands.
- **Chiaroscuro and tenebrism** (Caravaggio, Rembrandt, Wright of Derby).
  Take: a dark ground with one lit subject; light as the way attention is
  directed, which is the focal planes in paint.
- **Josef Albers, *Interaction of Color* (1963)** and Rothko's colour
  fields. Take: colour judged by its neighbours; the floors' lavender,
  amber and blue tested against each other, not alone.
- **The International Typographic Style** (Müller-Brockmann, *Grid
  Systems*, 1981) and the **NASA Graphics Standards Manual** (Danne and
  Blackburn, 1975). Take: a grid and a manual strict enough that strangers
  produce consistent work.
- **The British Rail Corporate Identity Manual (1965)** and Kinneir and
  Calvert's road signs. Take: one identity across thousands of sites,
  each with its own local name, which is the many-deployments problem.
- **Technical and scientific illustration** (axonometric drawings, Ernst
  Haeckel's plates, Otto Neurath's diagrams already used for data). Take:
  images that explain a structure rather than decorate.

## Surfaces (6 variants each, one tradition per variant)
1. **Style sheet** (grammar): ground, light, colour relations, line, type
   pairing, image rules, motion character, what the style forbids.
2. **Home at rest**: the first screen of the day with nothing urgent.
3. **A working screen**: an Artifacts library or a Data Atlas record
   under the style, where calm and legibility win over flavour.
4. **Empty states and onboarding**: where the style may speak most.
5. **A diagram**: floors, or how a fact reached Triage, drawn in the
   style.
6. **Another organisation's AUGUR**: the same Home with a different
   organisation's name, colour and floor names, to test the style
   doesn't become anyone's brand.

Round 2: combine into 3-4 screens. One must take the strongest style
through all five working surfaces in one deployment, and show the style
manual page a new app author would read.

## Questions the shortlist must answer
- Which tradition should be named in the handbook as AUGUR's art
  direction, and what it forbids.
- What it needs from the token files (`common`, `shell`, `app` in
  `augur-kit`) and from the design tool; list every "needs token".
- Whether AUGUR needs an illustration rule (and a record) for generated
  imagery, and where Lucide stops.

## Carry from earlier runs
Read the cinematic grammar (`runs/2026-11-02-cinematic/grammar/`), and
`concepts/light-as-signal.md`, `focal-planes.md`, `dark-when-normal.md`
and `feel-as-a-setting.md`.
