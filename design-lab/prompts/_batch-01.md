# Batch 1

Written 2 November 2026 after the cinematic run, from online research into
areas the cinematic run did not touch. Three steered prompts (A was run
first, B, C, D wait here) and one wildcard, [W1 Paper and the desk](w1-paper-and-the-desk.md),
from paper tools for high-stakes work (air traffic strips, ward
whiteboards, T-card boards, ledgers).

Why A ran first: it was the furthest from the cinematic run, it lands on
the pillar apps, and it uses data AUGUR already records.

## The steered prompts

| | Prompt | Area | Grounded in | Best for |
|---|---|---|---|---|
| A | [Wear and time](../runs/2026-11-02-wear-and-time/prompt.md) | History as a material on every object | Hill and Hollan's edit and read wear, Viégas and Wattenberg's History Flow, Xanadu patterns, Bret Victor's ladder of abstraction, geology and tree rings, conservation's visible repairs, tide tables | Artifacts, Data Atlas provenance, Mandate deadlines, "what changed while I was away" |
| B | [Room tone](b-room-tone.md) | Sound as a calm second channel | Brewster's earcon guidelines (hard numbers), avionics aural alerts, film sound design and room tone, calm technology, Apple Audio Graphs sonification, Braun detents | Urgent path, floor travel, radial menu, accessibility |
| C | [Type as instrument](c-type-as-instrument.md) | Hierarchy and data with type alone, no boxes | Bringhurst, Müller-Brockmann grids, newspaper front pages, Kinneir and Calvert signage, instrument dials, variable font axes (grade avoids reflow), Bertin's visual variables, Saul Bass titles | Home, Admin tables, Data Atlas, the Letterbox headline |
| D | [Data as landscape](d-data-as-landscape.md) | Cartography for an organisation | Imhof's Swiss relief, contours and hypsometric tints, plan oblique relief, nautical charts (soundings, "unsurveyed"), weather fronts, Beck's Tube map, Minard | Explorer's org view, Data Atlas, Mandate |

## Research notes behind each

**A. Wear and time.** Hill and Hollan (Bellcore, 1992-94) showed edit and
read wear as marks on the scroll bar, banded by author, so navigation and
history share one control. History Flow (IBM, 2004) drew every Wikipedia
revision as one picture in which edit wars and vandalism show up as
shapes. Maggie Appleton's survey of Xanadu patterns lists visible links,
parallel documents and versions as ideas the web never shipped. Physical
analogues (strata with gaps, tree rings with scars, conservators' "visible
and reversible" repairs, high-water marks) give a vocabulary for honest
history, including missing records. This fits AUGUR closely: the events
service already records domain events, and "explain, never hide" extends
naturally to "why is this like this, and since when?"

**B. Sound.** Brewster, Wright and Edwards' earcon guidelines give hard
numbers: pitch between about 150 Hz and 5 kHz, notes at least about 80 ms,
at most about 6 notes per second, a 0.1 s gap between compound earcons,
loudness kept in a narrow band because loudness is the main cause of
annoyance, and hierarchies where children inherit their parent's sound
(floors map onto this neatly). Avionics keeps a tiny fixed alert
vocabulary that stops on acknowledgement. Weiser's Dangling String is the
calm-technology model for ambient activity. Apple's Audio Graphs show
sonified charts working for accessibility. Web Audio can generate all of
it from parameters, so sound can be tokenised like colour. Risks: office
use, screen readers, and browser autoplay rules (sound only after a click).

**C. Type as instrument.** Editorial design and signage carry hierarchy
without containers. Variable fonts add axes: the grade axis changes
darkness without changing width, so emphasis doesn't reflow, but Jost has
no grade axis (Roboto Flex does), so the run must say whether that is
worth a font change (an ADR). Bertin's visual variables say which
encodings suit ordered vs categorical data.

**D. Data as landscape.** Terrain cartography (hillshading, contours,
hypsometric tints, Imhof's warm-lit and cool-shadow Swiss style, plan
oblique relief) gives depth without 3D. Nautical charts add soundings,
hazards and the honest "unsurveyed" area, which matches explain, never
hide. The risk is decoration: each map must beat a list for a named
question, and a layout library would need an ADR.

## Sources
- Brewster, Wright, Edwards: earcon guidelines,
  https://www.dcs.gla.ac.uk/~stephen/earcon_guidelines.shtml
- Hill and Hollan: history-enriched digital objects,
  https://apparent-wind.com/navigation/wear.html
- Calm technology (Weiser and Brown; Dangling String),
  https://en.wikipedia.org/wiki/Calm_technology ; Amber Case's book,
  https://calmtech.com/book
- Terrain cartography, https://en.wikipedia.org/wiki/Terrain_cartography
- Maggie Appleton, Xanadu patterns,
  https://www.maggieappleton.com/xanadu-patterns
- Grade axis and layout shift,
  https://www.stefanjudis.com/blog/the-relative-font-weight-axis-how-variable-fonts-ease-font-weight
- Apple, Bring accessibility to charts (Audio Graphs), WWDC 2021,
  https://developer.apple.com/videos/play/wwdc2021/10122/
- Bertin's visual variables, https://en.wikipedia.org/wiki/Visual_variable
- Bret Victor's ladder of abstraction (summary),
  https://nohn.bearblog.dev/victors-up-and-down-the-ladder-of-abstraction/
- Psychoacoustic sonification as a user interface,
  https://arxiv.org/pdf/1912.08609
