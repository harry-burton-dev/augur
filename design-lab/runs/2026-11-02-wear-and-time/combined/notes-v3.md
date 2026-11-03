# Combined · V3: Fact in place (`v3-fact-in-place.html`)

A Data Atlas entity page (Kestrel Logistics, six facts) you could ship. The
whole page draws on one record and shows it at three distances, switched with
`1 2 3` or the segmented control: **Facts** (the table, with word-sized strata
on every value), **History** (the same rows widened into History Flow small
multiples on one time axis) and **Compare** (two dates side by side as a
parallel record). The demo opens Headcount's answer 1.2 s after load. `R`
replays it. `#history` and `#compare` in the URL start in those views.

## What it combines
- **Provenance V5 ask in place** (rank 1): the table, the margin read wear,
  `?`/Enter opens "why are you like this, who can change you, since when?"
  under the value, and the rest of the table racks back (a softened near
  plane: 1 px blur, restored on hover and focus).
- **Provenance V2 history flow** (rank 2): History mode is the same drawing
  function at a larger size. Numeric facts get value lanes, categorical facts
  a flat band with labels. Faults show as forks, rejected values as **spurs**,
  and the waiting proposal as a dashed green **bud** to its proposed value.
- **Provenance V3 parallel record** (rank 3): Then and Now cards, carry-over
  ribbons by id (not by string), and dashed threads with a delta for changed
  fields. A strip on the same scale holds two handles. Then defaults to *your
  last visit*. `← →` moves Then, `⇧ ← →` moves Now, and both step through
  record moments.
- **Grammar V1/V2**: mark names and recipes (seam, stale hatch, now,
  unconformity, distance to travel), and `TimeScale` exactly as the one-scale
  sheet defines it (the past compressed by the square root of age, the next
  six months linear). One function feeds the word glyph, the history rows and
  the compare strip.
- **Scrubber concept "the record has edges" / upgrades "record-continuity"**:
  the events service declares one gap (31 Aug to 13 Sep 2026). The gap is not
  per-fact data.

## What works
- **One drawing, three distances.** `flow(fact, w, h, big)` draws a 144 px
  glyph and an 860 px history row from the same code. History mode is
  therefore a zoom, not a new screen, and the glyph column in Facts mode is
  already a column of small multiples, because every glyph shares the entity
  axis.
- **Silence vs. missing record (new distinction, the strongest finding).**
  Round 1 drew "register feed paused" as an unconformity. Here it is a
  **silent source**: we *know* nothing arrived, so the value held, unverified,
  under stale hatch. The **unconformity** is reserved for a gap the events
  service declares: we *don't know* what happened. The glyph shows the
  difference by shape. A silent source is hatch *over* the band. A record gap
  *breaks* the band. In History the gap is a single band across every fact,
  tagged once. Risk rating shows why this matters: it changed *inside* the
  gap, so its step is dotted and the answer says "about 14 Sep 2026; the
  exact day is unknown". The answer also says when the gap does not matter
  ("the value held on both sides, so it is unaffected").
- **Spur and bud read at word size.** The spur is a 5 px diagonal ending in an
  open circle, so "did anyone ever say 410?" is answered without opening
  triage. The bud is the only lit mark on the page (green, and only because
  the viewer is a steward). For a viewer outside the steward team the same
  bud is ink, and the Review button is unavailable with a reason.
- **Ribbons stay in the gutter.** The ribbons now run from card edge to card
  edge at each token's height, and the tokens get a faint "carried" fill, so
  nothing crosses the field labels (round 1's main complaint). The cross-row
  ribbon (Annual report: Source *then* → In triage *now*) still tells the
  story: the source we trusted then is the one asking to change the value now.
- **Compare is honest about gaps.** When Then lands inside the record gap, the
  card says "No record on this day… Shown: the last state the record holds",
  and the between-chips include the gap as a hatched chip.

## What fails or risks
- **The √ scale flatters recent history and squeezes 2023.** The scale is
  right for this entity, where most of the trouble is recent, but year ticks
  sit unevenly and "how long was 265 in force?" reads short. The scale is
  printed in the subtitle in words. A fact with a busy 2023 would need the
  scale's range to come from its own record (grammar note). That is
  `TimeScale(range)`, not a constant.
- **History rows are dense at 1280×800.** Labels for off-scale rejections
  (410, 52) and the bud label crowd the top of the row. Collision handling is
  minimal: spurs rise at least 14 px, and future labels flip to the left when
  they would overflow. A real kit part needs label placement.
- **Rack focus in a data table** is still the most debatable bit (as in round 1):
  softened to 1 px, but a steward comparing two facts will hover the blurred
  rows constantly. I'd ship it behind the near-plane token so a deployment can
  set it to 0.
- **Seam gold against Team amber.** Payment terms (Team floor, amber stratum)
  carries a seam whose gold is close to amber at word size. It needs
  `--mark-seam` and a contrast check against `--floor-team-high`, as the
  grammar notes warned.
- **Compare picks only one fact.** A "compare this entity" view (all six facts,
  Then/Now) is the natural next step. Its ribbons would get noisy, so it
  probably wants changed rows only.
- Cost: glyphs are about 20 SVG nodes each, so a list of 200 entities with 6
  facts is 24k nodes. That is fine for an entity page. A list page should
  draw glyphs on canvas or only for visible rows.

## Principles
Explain, never hide: strongest of the run. Every value answers in place. The
gap, the silent source, the rejected values and the steward-only decision all
stay visible and say why and who. Calm: still at rest, with one lit mark
(the bud) and one transition per action. Focus stacking: near plane in Facts.
Letterbox: n/a. A disputed fact that blocks a filing deadline would escalate
to the urgent path. That is not drawn here.

## Needs
- **Tokens (proposed, all mixes of kit tokens):** `--type-micro`,
  `--stratum-mix` (34%), `--time-past-dim` (.62), `--mark-seam`,
  `--mark-fault` (danger 55% in ink-muted, the same family as the upgrades
  scar), `--mark-now`, `--mark-stale-hatch`, `--link-same` (fill + edge),
  `--focus-near-blur` (1px for tables), plus layout widths `--x-glyph-w`,
  `--x-gutter`. SVG stroke widths and dashes are raw hairline numbers; the kit
  should name two or three. Relies on `--font-mono` (IBM Plex Mono, ADR
  pending).
- **Kit parts (Quill):** `TimeScale` (shared with V4), `StrataGlyph` /
  `HistoryFlow` (one component, a `size` prop), `ParallelRecord` with
  id-keyed carry-over.
- **Data / events:**
  - `fact.value.accepted` {source id, decider, `corrects` dispute id}.
  - `proposal.rejected` {reason}.
  - `fact.dispute.opened/closed` {sides}.
  - `source.paused/resumed` per source and field (this is what makes a
    *silent source*; today it would have to be derived from "no check in N
    days").
  - `record.gap` {from, to, by, why}: the events service declaring its own
    discontinuities. **This is new, and it is the one field that drives every
    unconformity on every surface.**
  - Per-person `last_seen` per entity (privacy question below).
  - Fact `kind` (num or cat) from the entity schema.
  - Refresh rule per type.
  - Expected-source calendar (distance to travel).

## Questions for Harry
- **"Your last visit" as the default Then** needs per-person last-seen
  timestamps per object. Proposal: keep them for the person only, never shown
  to others, and expire them after the record's retention. Your call.
- **Read wear in the margin**: still counts only, never names. Same open rule
  as round 1 (hide below a floor audience threshold).

## Where I went beyond the ask
I split "gap" into **silent source** (stale, known) and **no record**
(unconformity, unknown), and made the second come only from the events
service. That is a data-model decision as much as a design one.

## Score
Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5
