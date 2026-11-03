# Intents: critique

Surface 4: a Mandate intent from the day it was asked to its deadline. All six
pages show the same intent ("Supplier payments on the new ledger", asked by
the Org, owned by Payables) so they can be compared directly. The record:
asked 4 Aug, two missed deadlines (30 Sep, 31 Oct), deadline now 28 Nov, six
edits of the ask, a two-week gap in the event record, peak effort in the week
of 19 Oct, and a status that is 19 days old.

The marks use the run's names everywhere: **water** (effort, navy to green),
**high-water mark** (an engraved notch, ink, never lit), **tide line** (a
missed date: dotted, info mixed into ink-muted, a stain that never fades),
**seam** (the ask changed: a double hairline in light at 62%, never a
severity colour), **now line** (the only bright line), **distance to travel**
(dashed hairline-strong), **stale hatch** (135° hatch plus the light
language's ember), **unconformity / no record** (hatch between wavy edges),
**ring** and **stratum** (V5, V2). Only "needs you" uses light (bloom, V6).
Every mark answers "why are you like this, and since when?" in one shared
pane: what, since, who can change it.

Shared proposed tokens (top of each page's `<style>`): `--x-now`,
`--x-tide`, `--x-tide-stain`, `--x-hw`, `--x-seam`, `--x-travel`,
`--x-past` (.62), `--x-stale-hatch`, `--x-water-lo/hi`, `--x-type-micro`.
All are built from kit tokens. SVG stroke widths, dash patterns and hatch
cells are raw numbers. These are data-drawing details, but a `--mark-*` set
would make them shareable with the grammar sheet. All pages rely on
`--font-mono`.

## V1: Tide table
*Idea.* An almanac spread. A single time scale with effort as water, tide
lines where dates were missed, the high-water mark set across the past like
a flood mark on a bridge, the gap as an unconformity, and the dry side ahead
printed with known events. Under it are two printed pages: *Recorded* (the
past, quieter) and *Ahead* (the future, with distance in days and the work
still to travel).

*Sources.* Tide tables and almanacs (the past and the known future on one
page), bridge flood marks, Open MCT's now line and stale marking.

*What works.* It is the most legible page: a newcomer reads it like a weather
chart. Putting past and future on one scale makes "distance to travel"
literal, and the two missed dates read as stains the water left behind. The
two tables give screen readers and keyboard users the same story as text.

*What fails or risks.* It is the most conventional page: a good chart, not a
new object. The upper band of labels gets crowded when deadlines fall close
together (31 Oct and now are two days apart), and the label layout has no
collision handling yet. The table half is a log, which Harry asked to avoid
as the main carrier.

*Principles.* Explain, never hide: the gap is drawn and explained, not left
blank. Calm: the page is still at rest, and the water fills only on the
demo and on R. Letterbox: not used. Focus: none.

*Needs.* Weekly effort per intent (an aggregate of existing domain events:
tasks closed, linked documents edited, approvals). Deadline history with who
moved it and why: a new `intent.deadline_moved` event with `reason`. Known
future events from calendars and windows.

*Score.* Clarity 5 · Distinctiveness 2 · Feasibility 5 · Fit 4

## V2: Staff gauge
*Idea.* Time rises up a river gauge. The past is under water (dimmer, tinted),
the waterline is now, and the dry staff above it is the distance to travel to
the deadline cap. Each deadline extension is a **seam** where a new section
was bolted onto the staff. The old tops are tide lines across the whole
gauge. Edits of the ask are engraved plates on the upstream side. Effort is
the flow on the downstream side, and its widest week carries the high-water
plate.

*Sources.* River staff gauges (the E-pattern graduations), flood marks on
bridge piers, kintsugi and conservators' "visible repair".

*What works.* It is the strongest single metaphor here. Extensions turn
physical: you can *see* the staff is 59 days longer than first asked, in two
repaired sections. "The past is under water" gives *past is quieter than now*
for free, with no extra rule. The dry staff makes the future feel like
distance, not a date.

*What fails or risks.* Vertical time fights every other timeline in AUGUR
(left to right), and a 900 px screen only holds about four months. Long
intents would need a scale break. The plates have to be pushed apart when
edits cluster, which loses exact height (kept with leader lines). The water
tint over the plates costs contrast: it stays readable at the current mix,
but has no margin.

*Principles.* Explain, never hide: every plate, seam and tide line opens the
pane. Calm: still at rest. Seams glint once as the water passes them, only
on the demo. Focus: none. Letterbox: none.

*Needs.* As V1, plus a reason on every extension. Needs token:
`--x-water-*` alpha mixes, and a rule on what text may sit under water.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 5

## V3: Ask flow
*Idea.* History Flow for the wording of the ask. Each edit is a vertical
slice, each clause a band coloured by the author's floor (Org blue,
Department lavender, Team amber), and bands join between slices. Clauses
that end taper off; new ones begin with a seam. The deadline clause shows as
a sawtooth: cut, rewritten, cut, rewritten. Spacing switches between by edit
and by date (key D). The right pane shows the ask at the chosen edit: new
words double-underlined, removed words struck through but kept.

*Sources.* Viégas and Wattenberg, History Flow (IBM 2004), kintsugi seams.

*What works.* It is the only page that makes *what changed in the ask* a
shape. Scope creep shows as the stack getting taller, and the floor colours
show who has been steering (here the Org added most of the late weight).
Stepping with ← → in the reading pane is quick and precise. Removed words
never disappear, which is explain-never-hide applied to text.

*What fails or risks.* Sorting an ask into clauses is the hard part. For the
demo the clauses are hand-made; in real use it needs either a structured
intent (fields for scope, criteria and deadline) or a word-level diff with
stable span ids. Floor colours depend on hue, so colour-blind readers need
the legend and the pane. It doesn't show effort at all.

*Principles.* Explain, never hide: strongly (removed text stays). Calm: still
at rest. Focus: hovering a band dims the others, a small rack.

*Needs.* Versioned intent text with stable clause or span ids, and each
author's floor at the time of the edit (not their floor today). A new
`intent.revised` event with a diff.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V4: Parallel asks
*Idea.* Two states of the ask side by side, "as asked" (r1) and "as it stands"
(r6), with Xanadu-style bridges joining the clauses that stayed. Added
clauses get a seam stub in the gutter and no bridge to the past. The deadline
is a single dotted bridge that passes through its two tide lines, labelled
"rewritten 2× · both dates missed". Each pane carries its own distance to
travel at that moment (57 days when asked, 26 now). Any two edits can be
compared (chips, ← → and Shift ← →).

*Sources.* Ted Nelson's transpointing windows, Maggie Appleton's Xanadu
patterns, kintsugi.

*What works.* It is the fastest way to answer "what are we actually being
asked now, versus what we agreed to?", which is a real argument in any
organisation. The empty space at the bottom of the left pane *is* the scope
creep. It is also cheap to build: two text panes and an SVG overlay.

*What fails or risks.* It shows only two moments, so the path between them
(when each clause arrived) is only in the tags. Bridges have to be redrawn
on resize and after fonts load, a known failure point. At 1280 × 800 the
right pane is close to full.

*Principles.* Explain, never hide: removed clauses stay struck through. Calm:
still. Focus: the earlier pane sits slightly back (past at 86%).

*Needs.* As V3 (clause ids). It conflicts with nothing in the cinematic
shortlist, and could become the radial menu's "Compare" verb.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V5: Growth rings
*Idea.* The intent as a cross-section of a trunk: one ring a week, ring width
is effort, the bark is now (the only bright circle), and dashed rings still
to grow reach out to the dotted deadline circle. Missing rings (no record)
are hatched. Tide lines run round the trunk at the moment a date was missed.
Seams sit on a core read along one radius, with labels fanned out like a
dendro report. A side panel "reads the core" in words, and hovering a reading
isolates that mark. Sibling intents appear as small multiples.

*Sources.* Dendrochronology (ring width, missing and false rings, reading a
core), Tufte's small multiples.

*What works.* At word size it is the best page: five tiny cross-sections
next to each other tell you at once which intent grew steadily, which
rushed, which stalled. The bark-as-now and rings-to-grow pair is a calm,
memorable picture of distance to travel.

*What fails or risks.* A large disc is pretty but hard to read precisely:
week 3 and week 9 are hard to compare, and the eye reads area, not width,
so outer rings look bigger than they are (a real perception bias). It is the
most gimmicky page if used as the main view. Eccentric circles hint at wood
but cost nothing in meaning.

*Principles.* Explain, never hide: the readings panel says what every mark
means. Calm: still. Focus: hovering a reading is a rack focus, dimming the
other marks. Letterbox: none.

*Needs.* Weekly effort per intent (as V1). Small multiples need that number
for every intent on a floor: a cheap aggregate, but a new query.

*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 4 · Fit 4

## V6: Intent ledger
*Idea.* Mandate's list of intents for a floor, with each intent's whole life
drawn at word size on one shared time axis and one now line running through
every row. Each row carries water, a high-water notch, tide ticks, seams,
stale hatch and its dashed distance to travel. An overdue intent shows a
solid green overrun past its deadline and the row **blooms** (needs you).
Enter opens "why and since when" in place: distance, tide lines, high water,
status. A restricted Org intent stays in the list as a **shadow** row with
the reason and who to ask. A finished intent goes quiet, with a green dot.

*Sources.* Tufte's sparklines, Open MCT's now line, tide tables, the
cinematic light language (bloom, shadow, ember).

*What works.* It is the one to ship first. It needs no new metaphor, it
scales to dozens of rows, and it answers "which of these needs me?" with
light only where it should be. The shared now line makes "how far each has
to travel" comparable across rows at a glance. Every mark from the other
five pages appears here at word size, which proves the grammar holds when
small.

*What fails or risks.* At word size the marks are small (seams are 5 px, tide
ticks 1 px dotted), so they need the key and hover, and fail in bright rooms.
The bloom is the only motion and should obey the "three blooms" cap. A floor
with 40 intents would need grouping by state, not a longer list.

*Principles.* Explain, never hide: the shadow row (exists, unavailable, why,
who) and the in-place why panel. Calm: dark at rest, with one bloom that
stops under reduced motion. Focus: none. Letterbox: an intent past its
deadline that blocks an Org commitment could escalate into the urgent path;
this page stops at bloom.

*Needs.* Per-intent weekly effort, deadline history and edit dates (all as
above). Permission metadata for shadow rows: the reason and who grants
access. The viewer's allowed actions (Extend, Hand back).

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 5

## Ranked
1. **V6 Intent ledger**: the shippable list, and the proof that the marks
   work at word size.
2. **V2 Staff gauge**: the strongest single-intent picture; extensions as
   seams on the staff are the idea of this surface.
3. **V4 Parallel asks**: the clearest answer to "what changed in the ask".
4. **V3 Ask flow**: the richest history of the ask, but it depends on
   clause-level data.
5. **V1 Tide table**: clear and safe, but conventional.
6. **V5 Growth rings**: keep only as small multiples; the big disc is a
   gimmick.

**What I'd build first.** The V6 ledger row as a kit part, `IntentLine`,
in Quill. It draws water, high-water notch, tide ticks, seams, stale hatch,
travel and overrun from one `IntentHistory` record, on a time scale the list
shares, with one now line drawn by the list rather than by each row. It runs
on two things Mandate can record today with small additions: weekly counts
from existing domain events, and a new `intent.deadline_moved` event (old
date, new date, by, reason). Then open the intent itself as the V2 staff
gauge with V4's "Compare" as its second tab. That is the same data seen
closer, not a new screen. Where this goes beyond the ask: I'd make "deadline
moved" carry a required reason, because a tide line without a why is just a
scar. That is a product decision for Harry, not a design one.

**Where it pushes back.** Wear on a deadline should never fade. A missed date
is a fact, and letting tide lines age away would hide exactly what "explain,
never hide" protects. The cinematic "past is quieter" holds for opacity, not
for disappearance.
