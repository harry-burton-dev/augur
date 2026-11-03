# Surface 3 · Data Atlas fact provenance: critique

One fact throughout: **Kestrel Logistics · Headcount**. It has six accepted
values from four sources, two rejected proposals (268 and 410), a 10-month gap
in the record (the register feed paused), a two-month dispute (Procurement 290
against Finance 312) settled by a correction (305, payroll extract), a refresh
that fell due on 14 Aug 2026 and was missed (stale for 3 months), and one
proposal (330) that has waited 194 days in triage. The viewer is in the
steward team, so that proposal is the only thing on any screen that lights up
(green beacon). Every name, label, count and date comes from the `DATA` object
at the top of each page.

Mark names follow the grammar sheet: **stratum** (an accepted value held for a
time), **unconformity** (no record), **fault** (a dispute), **seam** (the
correction that closed it), **stale hatch**, **tide line** (a refresh date
that was missed), **high-water mark**, **now line**, **distance to travel**
(dashed, to the next expected source). Two marks are new here and only make
sense inside triage: the **spur** (a rejected proposal: it branches and dies)
and the **bud** (a pending proposal on the newest surface). V4 renames the
marks for wood (knot, scar, missing ring, bark); if V4 survives, those names
should be aliases, not new marks.

Colour of a stratum = the **floor that supplied the value** (Org register
blue, Department lavender, Team amber, You green), mixed at `--x-stratum-mix`
into slate so it stays quiet. Past strata dim towards `--x-past-dim`.

---

## V1: Core sample (`v1-core-sample.html`)
*Idea.* The fact is drilled out as a vertical core, youngest at the top, with
depth proportional to time. Accepted values are strata labelled on the right.
Rejected proposals sit beside the core like pebbles that never deposited.
The gap is a hatched unconformity between two erosion lines, the dispute
cracks the core into two offset halves (a fault) and a bright seam closes it.
Above the surface there is only air: dashed distance to travel to the next
expected sources. The bud waits on the surface. The panel answers "Why 305,
and since when?" for any layer you step to.

*Sources.* Stratigraphy and core logging; Open MCT now line; Hill and Hollan
(the core is a scroll bar you can read).

*What works.* It is the most literal reading of the brief and the easiest to
learn: up is now, a thick layer held for a long time, a blank is a blank. The
rejected values beside the core answer "did anyone ever say 410?" without
opening triage. Every mark from the grammar has a natural place.

*What fails or risks.* A full screen for one fact. Depth equals time, so a
fact with ten years of history and one busy month squashes that month to
nothing. Labels collide when strata are thin (1280 needed wrapping), and with
several close rejections the pebbles would stack. The core reads as a
skeuomorph if it is drawn any more literally.

*Principles.* Explain, never hide: strong (the blank stays in the core,
rejected values stay beside it). Calm: one beacon. Focus stacking: none.
Letterbox: n/a.

*Needs.* `--stratum-mix`, `--time-past-dim`, `--mark-seam`, `--mark-fault`,
`--type-micro`. Events: `fact.value.accepted`, `proposal.rejected` with
reason, `fact.dispute.opened/closed`, a refresh policy per entity type.

*Score.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V2: History flow (`v2-history-flow.html`)
*Idea.* The fact's whole history as one horizontal picture (value against
time). A new value is a step, a rejected proposal a **spur**, a dispute a
**fork** that a seam joins back up, a gap a hatched band. Below it, every
fact on the entity is drawn as a word-height flow on the same time axis, so
the record of a whole supplier reads as small multiples: a quiet strip, a
busy one, one going hatched. ↑ ↓ switches the main chart, ← → scrubs the
record and the card on the right says what the record showed then.

*Sources.* Viégas and Wattenberg, History Flow ("shapes that mean
something"); Tufte small multiples.

*What works.* The small multiples are the best thing in this set: six facts,
six shapes, and you see straight away which fact has trouble (payment terms
hatched for 1.8 years; headcount with a fork and two spurs). The glossary
teaches the shapes once. The high-water mark and the tide line fit naturally
on a value axis.

*What fails or risks.* Two ideas on one screen; the main chart alone is a
fancy line chart. Short disputes (payment terms, 7 weeks) draw as a thin
spike, not a fork. Rejected outliers (410) wreck the value scale, so they are
clamped and labelled "off scale". Text facts (office, contact) get value
lanes, which read as up and down movement that means nothing.

*Principles.* Explain, never hide: good (the "off scale" label says what was
clamped). Calm: one beacon. Focus stacking: none.

*Needs.* As V1, plus a per-fact "kind" (numeric or categorical) from the
entity schema.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V3: Parallel record (`v3-parallel-record.html`)
*Idea.* Two states of the fact side by side, Xanadu style: the record
**then** (a chosen day) and the record **now**, as full provenance sheets.
Fields that changed get a dashed thread with the delta (+40, changed).
Content that carried over is joined by ribbons wherever it now sits.
"Annual report" leaves the Source row on the left and lands in the In triage
row on the right; "Dana Okafor" lands in Triage history. A strip at the top
holds the whole record with two handles. A row of chips says what happened
between the two moments.

*Sources.* Ted Nelson, Project Xanadu (visible links, transpointing windows);
Maggie Appleton's "Xanadu patterns".

*What works.* It is the only variant that answers "what's different since I
last looked?" directly, and the cross-row ribbons are a real discovery: they
show that the source we trusted then is the one asking to change the value
now. It extends to any record (an intent, a document's metadata), so it is
a pattern, not a chart.

*What fails or risks.* Ribbons cross the field labels and get noisy once
more than four tokens match. "Same content" is string equality here; real
matching (same document, same person) needs ids, not text. You have to know
which two moments to pick: the default (your last visit against now) needs
per-user "last seen" data.

*Principles.* Explain, never hide: strong (nothing is diffed away; both
states are whole). Calm: ribbons fade in once, then hold still. Focus
stacking: could rack the unchanged rows back; not done.

*Needs.* `--link-same` (ribbon fill/edge). Data: `last_seen` per user per
object (privacy question for Harry), stable ids for sources and people inside
field values.

*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V4: Ring section (`v4-ring-section.html`)
*Idea.* The fact as a tree cross-section: one ring per quarter, width set by
how much **evidence** arrived that quarter (checks, imports, triage
decisions), colour by the floor of the value held. Quarters with nothing are
**missing rings** (hatched). The dispute burns a **scar** wedge, rejected
proposals are **knots**, the correction is a bright ring, stale quarters are
hatched, the bark is the now line, and dashed future rings mark distance to
travel. The bud sits on the bark. A radial borer and a chronology bar chart
read it ring by ring.

*Sources.* Dendrochronology (ring width, fire scars, missing rings);
Tufte sparklines for the chronology.

*What works.* It shows something the others don't: **how well attended** the
fact was, not only what it said. The thin outer rings make "nobody has looked
at this for a year" visible at a glance, which is the true story behind the
staleness. Beautiful as a still.

*What fails or risks.* The value itself is not visible in the picture; you
have to read the panel. Rings read as decoration to anyone who doesn't know
wood. Quarters are an arbitrary bin and the outer ring is partial. A big disc
of colour is the loudest thing in this set even at 24% mix: it breaks "dark
when normal" if it is ever larger than an icon. Gimmick risk is high.

*Principles.* Calm: weakest of the six. Explain, never hide: good on blanks.

*Needs.* An evidence count per fact per period: new aggregation over the
events service. Rings below icon size would need a `--ring-*` set.

*Score.* Clarity 2 · Distinctiveness 4 · Feasibility 3 · Fit 2

## V5: Ask in place (`v5-ask-in-place.html`)
*Idea.* The ordinary Data Atlas entity page, but every value carries its
history at word size: a 100 px strata glyph (floor colours, a hatch for gaps
and staleness, an amber box for a dispute, dots for rejections, a seam tick),
a stale hatch on the age, and **read wear** in the left margin (density =
uses this quarter, counted, never named). Press `?` or Enter on a value and
the row opens downward in place: a small core column, the answer to "why 305,
and since when?", who can refresh it, and the record as a dated list. The
rest of the table steps back on the near focal plane.

*Sources.* Tufte sparklines (word-sized graphics); Hill and Hollan read wear
in the margin; the cinematic run's focal planes.

*What works.* History is on the object without adding a screen or a column,
and the answer appears exactly where the question was asked. It is calm at
rest: glyphs are quiet, only the pending proposal's dot glows. It is the
cheapest to build (an inline SVG per cell from data the row already loads)
and the one most likely to survive real use.

*What fails or risks.* Glyphs at 100 px only show the coarse shape; spurs
and seams are hard to see under 2× zoom. The time axis differs per glyph
unless it is fixed per entity (here: since 2023 for all). Read wear in the
margin raises the privacy question below. Rack focus blurs rows you may want
to compare against.

*Principles.* Explain, never hide: strongest (every value answers in place).
Focus stacking: yes (near plane). Calm: yes. Letterbox: n/a.

*Needs.* `--mark-stale-hatch`; reuses `--focus-near-blur`. A `StrataGlyph`
part in Quill. A uses count per fact (aggregate only).

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 5

## V6: Afterimage scrub (`v6-afterimage-scrub.html`)
*Idea.* The fact's card, as anyone would see it, replayed in place: scrub the
record and the card changes to what it showed on that day (disputed, with no
source behind it, stale). Each earlier state stays behind it as an
**afterimage** on a farther focal plane (blurred, desaturated, offset), so
the recent past is a visible stack of cards. A three-rung ladder steps up:
one moment → with afterimages → all values at once (value against time,
with the moment marked). The auto-demo replays the record from the first
import to now.

*Sources.* Bret Victor, "Up and Down the Ladder of Abstraction"; onion
skinning in animation; the cinematic run's focal planes.

*What works.* "Depth = time" makes the cinematic focal planes mean
something: the past really is behind. "As shown on 4 Nov 2024" answers the
audit question ("what did the dashboard say when we signed?") better than
any log. The ladder is a reusable control for surface 5 (the time scrubber).

*What fails or risks.* Afterimages are unreadable by design; the labels do
the work, so it is atmosphere. Five stacked blurred cards are expensive
(filters) and must not exist at rest. Rung 3 repeats V2's chart. The card is
big for one value.

*Principles.* Focus stacking: strongest. Calm: the stack only appears while
scrubbing; it should collapse after one still beat. Explain, never hide: good.

*Needs.* `--afterimage-step`, the `--focus-far-*` set from cinematic.
Snapshot-at-time queries (event replay) on the events service.

*Score.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 4

---

## Ranked
1. **V5 Ask in place**: ships, calm, history on every value.
2. **V2 History flow**: the small multiples of a whole entity.
3. **V3 Parallel record**: the "what changed between two moments" pattern, with cross-row ribbons.
4. **V1 Core sample**: the clearest teaching picture of the grammar.
5. **V6 Afterimage scrub**: right idea for the scrubber surface, too heavy for one fact.
6. **V4 Ring section**: the evidence-density idea is good; the disc is not.

## What I'd build first
V5's row, with V1's column inside it and V3's comparison behind one key.
That means a `StrataGlyph` in Quill (inline SVG, about 20 nodes, fed by the
fact's own record), the `?` answer that opens in place with the small core
column and the dated list, and a "compare with…" action in that answer that
opens V3's parallel record, defaulting to "your last visit and now". Take V4's
one real insight (attention, not only value) into the glyph as one number,
"checked 1× in the last 2 quarters", rather than as rings. Take V2's small
multiples as the entity overview at 1600 px, where the glyph column already
lines up on a shared time axis. Leave V6's afterimages for the time-scrubber
surface, where a whole screen replays and depth-as-time earns its cost.

## Where this pushes on the principles
- **Calm against honesty.** On a big entity nearly every fact goes stale
  quietly, so a page of stale hatches would be noise. Proposal: the hatch
  sits only on the age text by default and on the glyph tail, never on the
  value, and a floor-level policy can raise it (from quiet to beacon) for
  facts that feed something with a deadline.
- **Rack focus in a table** (V5) blurs rows you may want to compare against.
  Hover and focus restore them; it may still be one step too far for a data
  app.

## Questions for Harry
- **Read wear privacy (V5 margin).** Proposal to decide, not decided: show
  use counts only, aggregated per quarter, never names; hide the count when
  the fact's audience is under a threshold (for example under 5 people on the
  floor) so a count cannot identify a reader. Does reading a fact through a
  document count as a read of the fact?
- **"Since your last visit" (V3 default)** needs per-person last-seen
  timestamps per object. Same question: who may see them, and are they kept?

## Data the shell doesn't have yet
| Mark | Needs |
|---|---|
| stratum, seam | `fact.value.accepted` with source id, decider, and `corrects` link to a dispute |
| spur | `proposal.rejected` with reason (triage already records a decision; reason may be free text today) |
| fault | `fact.dispute.opened` / `.closed` with the parties' values |
| unconformity | source-feed health events (`source.paused` / `.resumed`), or derived: no check in N days |
| stale hatch, tide line | a refresh policy per entity type or per fact (`refresh_months`), and `fact.verified` events |
| distance to travel | expected-source calendar (next questionnaire round, next filing date) |
| bud | pending proposals (triage has these) |
| ring width (V4) | evidence count per fact per period: an aggregate over events |
| read wear (V5) | `fact.read` counts: **new, privacy-sensitive** |
| afterimages (V6) | point-in-time snapshot queries (event replay) |

## Needs token (all prototypes)
`--type-micro`, `--stratum-mix`, `--time-past-dim`, `--mark-seam`,
`--mark-fault`, `--mark-stale-hatch`, `--link-same` (V3), `--afterimage-step`
(V6); V5 and V6 reuse the cinematic `--focus-near-*` / `--focus-far-*`
proposals. IBM Plex Mono is used for numerals throughout (needs its ADR).
