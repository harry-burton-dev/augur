---
batch: 1
kind: steered
concepts: [hierarchy-without-containers, the-object-explains-itself]
---

# Prompt C: Type as instrument. Hierarchy without boxes.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-type-as-instrument/prompt.md`.

---

Spend this run exploring how far AUGUR can carry hierarchy, state and data
with **typography alone**: no cards, no badges, no coloured pills, few
borders. Editorial design, signage and instrument faces have done this for
a century; most SaaS UIs reach for a box instead. Find out what AUGUR looks
like when weight, size, tracking, case, rhythm and position do the work,
and when type itself carries values. Work in `design-lab/runs/<date>-type-as-instrument/`.

## Harry's direction for this run
- **Remove a box, add a rule:** every variant should show the same screen
  with fewer containers than today and still read faster.
- **Type carries data:** weight, width or grade may encode a value (recency,
  urgency, confidence), but only where a person would read it that way
  without a legend.
- **No layout shift:** emphasis changes (hover, focus, escalation) must not
  reflow text. Measure it.
- Jost stays the voice. Titles keep their wide tracking. IBM Plex Mono is a
  candidate for figures and codes (needs an ADR). Any other face is a
  proposal with a reason.
- Calm: at rest the page is a quiet column of text; type gets louder only
  when something needs you.

## References and what to take from each
- **Robert Bringhurst, *The Elements of Typographic Style***: measure (45-75
  characters), vertical rhythm, one change at a time for emphasis. Take:
  a modular scale and baseline from the existing type tokens.
- **Josef Müller-Brockmann, grid systems; Swiss/International style**:
  hierarchy by position and size on a strict grid, ragged right, flush
  left. Take: the grid as the only container.
- **Newspaper front pages and the *Financial Times* / *The Economist***:
  headline, deck, standfirst, kicker, byline; dense pages that stay
  scannable. Take: the "standfirst" as the one-sentence explanation every
  item gets.
- **Signage: Jock Kinneir and Margaret Calvert (UK road signs), Otl Aicher
  (Munich 1972)**: legibility at a glance and at distance, a strict
  vocabulary. Take: labels for floors and apps you read in a fraction of a
  second.
- **Instrument faces and dials** (aviation, Braun, watch dials): numerals
  as the main graphic, tick weights as hierarchy. Take: figures that are
  the chart.
- **Variable font axes**: weight (`wght`), width (`wdth`), optical size
  (`opsz`) and grade (`GRAD`, which changes darkness without changing width,
  so emphasis doesn't reflow; Roboto Flex has it, Jost does not). Take:
  test what Jost's weight axis can do, and say whether a grade axis is worth
  a font change.
- **Jacques Bertin, *Semiology of Graphics***: the visual variables
  (position, size, value, texture, colour, orientation, shape) and which
  suit ordered vs categorical data. Take: apply them to type deliberately.
- **Film title design (Saul Bass, Pablo Ferro, Kyle Cooper)**: type that
  moves with meaning. Take: one or two typographic moments for the
  Letterbox and floor travel title, never more.

## Surfaces (6 variants each)
1. **Type language sheet** (grammar): the scale, rhythm, emphasis ladder
   (quiet, normal, loud, urgent), how each state is set, and which visual
   variable carries which kind of data.
2. **Home "what needs you"** as a front page: lead story, decks, briefs,
   no cards.
3. **Artifacts library** as a contents page or index: documents found by
   reading, with age and status in the type.
4. **Admin tables** as typeset tables: no zebra stripes, no pills; status by
   weight, case and a single rule.
5. **Data Atlas entity page**: facts set with confidence in the type
   (disputed facts look disputed), sources as footnotes.
6. **Shell title, floor mark and the Letterbox headline**: the urgent
   sentence as a headline that does the job of a banner.

Round 2: combine into 3-4 screens. One must take a real current screen
(capture one from the dev server or the cinematic `combined/` pages),
count its containers, and rebuild it with half as many.

## Questions the shortlist must answer
- Which encodings people read without a legend, and which need one (test
  each on the "would a new employee read this right?" bar).
- Contrast: lighter weights on dark grounds lose contrast; give the minimum
  weight per size against `--ink` and `--ink-muted`.
- What to change in the kits (Aerie and Quill) and in the type tokens,
  and what needs an ADR (fonts, axes).
