# Surface 5: a time scrubber for any view

Six variants of one question: how do you replay a screen (a floor's Home, a
library, an org view in Explorer) to any moment, with "what changed since I
was last here" as the first move? Every page puts sample data in one `DATA`
object at the top of its script, plays its moment about 1.2 s after load,
replays on `R`, and works at 1600×900 and 1280×800. Marks use the run's time
language names: wear, seam, stratum, unconformity, tide line, high-water mark,
now line, stale hatch, distance to travel.

Files: `v1-since-you-were-here.html`, `v2-ladder.html`, `v3-parallel.html`,
`v4-core-sample.html`, `v5-local-time.html`, `v6-tide-table.html`.

Shared pieces in every file (copied in, so each page stands alone):
- **The rail**: one horizontal time axis per view. Wear ticks stack where
  events cluster, a ring marks your last visit, a tinted span runs from there
  to now, the **now line** is the one bright vertical (Open MCT), and the
  future after it is a dashed line (**distance to travel**) with known dates
  as tide marks ("Upgrade window, in 1d 12h").
- **Past is quieter**: when a view is scrubbed back, it desaturates a little
  and the time chip in the top band turns `--info` and says "Viewing Tue 27
  Oct 14:40 · 5d 18h ago". You can't mistake the past for now.
- Changes that arrive during a replay use the cinematic **flicker** (two
  short frames, then still). No new signals.

---

## V1: Since you were here

*Idea.* Opening a floor's Home sets the playhead on your last visit, then
plays forward one day at a time to now. Each change lands in place and
flickers once. At the end every changed row keeps a quiet mark: an `--info`
edge, "Changed 27 Oct", and a dashed "When you left: v3 · read by 31" line
showing the value it had before. A ticker above the rail names each change.
`[` `]` step change by change, `S` jumps back to the last visit.

*Sources.* Hill and Hollan read wear (wear ticks on the rail); Open MCT now
line; Bret Victor's scrubbing; Glance and "new since you last looked" from
the cinematic Home.

*What works.* It answers the prompt's default first move directly. "When you
left" turns a diff into one quiet line on the object, with no log screen.
Archived things stay visible, struck through, with who can restore them.
Stale things carry the stale hatch with their age and who can refresh them.
The summary ("14 days · 13 changes · 3 need you") is the whole story in one
line.

*What fails or risks.* Auto-play on every arrival is not calm: thirteen
flickers in two seconds are a light show, every time you come back. Rows
appear and push the layout around during playback. The "when you left" line
makes rows taller: fine for 4 to 12 rows, too much for a dense list.

*Principles.* Calm: playback should be **offered, not forced**, so the
default first move should be the end state with marks, plus a "Replay" key.
This pushes back on the prompt. Explain, never hide: strong (archived rows
stay, stale rows say who can refresh them). Focus stacking: not used. No
letterbox: nothing here is urgent enough.

*Needs.* Tokens: `--x-since`, `--x-wear`, `--x-now`, `--x-stale-hatch`,
`--x-seam`, `--x-future-dash`, `--x-past-opacity`. Data: a per-person
`lastSeenAt` per view. Field-level before/after on each domain event, so
"when you left" doesn't need a second query.

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 5

## V2: Up the ladder

*Idea.* A three-rung ladder on the left of a library. **One moment** is the
library at the playhead's time, with a 7-day read-wear bar on each card.
**Moments** is seven small multiples, one every three days, with each
document a cell (brighter = read more, outlined = edited, hatched = out of
date, dotted = not written yet). **All times** is one History Flow picture:
a band per document from creation to now (or to archive), read wear as
brightness along the band, versions as ticks with author initials,
corrections as gold **seams**, stale hatch where the review passed, and the
dashed distance to the next review. Click anywhere on rungs 2 and 3 to drop
to rung 1 at that time.

*Sources.* Bret Victor, "Up and Down the Ladder of Abstraction"; Tufte small
multiples; Viégas and Wattenberg, History Flow (edit clusters as shapes).

*What works.* Rung 3 is the most legible picture in this set. An edit war
shows as a cluster of ticks, and the page labels it in words ("4 edits in a
day · Ana, Tomas"): History Flow's "1 + 1 = 3". Two hatched bands show the
two neglected documents at once. The ladder names the abstraction you are on,
which an ordinary zoom control doesn't.

*What fails or risks.* Rung 2 is the weakest: cells are anonymous until you
hover, and "every three days" is arbitrary. It should be "every visit" or
"every week". Rung 3 doesn't scale as drawn. At 5,000 documents it needs
aggregation (a band per collection, documents on demand) and canvas, not
DOM. Author initials are not names, and colour per author (History Flow's
key move) would clash with floor colours, so I left it out.

*Principles.* Explain, never hide: strong (archived bands end in a dashed
cap; not-yet-written cells are dotted, not missing). Calm: still unless you
climb. Focus stacking: rungs crossfade with a small scale, close to a focus
pull, but not the cinematic planes.

*Needs.* The proposed `--x-ladder-w`. Daily read counts per document (an
aggregate, not raw read events). Version events with the author. A
correction flag on edits.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V3: Then and now

*Idea.* An Explorer org view shown twice, side by side: **Then** (your last
visit) and **Now**. Between them, Xanadu-style bridges join each unit to
itself. A thin grey bridge means unchanged, an `--info` bridge means changed
(with a label: "41 → 42 people · Ana Lima joined"), and a crossing bridge
means moved ("Moved to Operations by Dana Whitfield"). A retired unit stays
on the right, struck through; a new one grows out of the gutter. The rail has
two handles: drag either one to compare any two moments. `U` dims the
unchanged. A **record gap** between the two times is a hatched row and a
"No record" span on the rail, never a silent skip.

*Sources.* Ted Nelson's Project Xanadu, parallel documents and transpointing
windows (via Maggie Appleton's "Xanadu patterns"); diff tools' side-by-side
mode; the geological unconformity.

*What works.* It is the most distinctive variant, and the only one where you
see what *stayed the same* as clearly as what changed. Moves read at once as
crossing bridges, where a list diff shows a delete plus an add. Floor colours
on each row (Org blue, Department lavender, Team amber) keep the structure
readable.

*What fails or risks.* It costs half the width: each side gets a narrow
column. Past about 30 rows the bridges become spaghetti, so it needs grouping
or "show only changed units with their parents". Labels need collision
handling (done here by pushing them down), and that gets fragile with many
changes. It suits structural views (org, collections, intents' sub-parts),
not a free-form Home.

*Principles.* Explain, never hide: the best of the six. The retired unit, the
record gap and "recorded late" are all explicit. Calm: bridges draw in once,
then hold still. Focus stacking: "quiet the unchanged" is a dim, not a blur.
It could become a rack focus.

*Needs.* The proposed `--x-col-w`. Identity and registry need events for
renames, owner changes and parent changes (moves), with before and after
values. The events service needs to publish its coverage gaps (see below).

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V4: Core sample

*Idea.* The scrubber is a vertical drill core beside a Team's Home, newest at
the top like rock. Each day is a **stratum** whose thickness is how much
happened that day (tree-ring width), with a green edge where something needed
you. Future days sit above the now line as dashed, unlaid strata with the
known dates printed beside them. Drag or wheel down to dig. Three days where
the events service kept no record are an **unconformity**: two wavy lines
around a hatched band. Dig into it and the view turns to stale hatch, with a
plain panel: what is missing, why ("offline while the 1.8 upgrade was rolled
back"), that what you see is the last recorded state, and who can explain
the gap ("No one can fill it in").

*Sources.* Stratigraphy (unconformities); dendrochronology (ring width as
good and bad years); the honest blank.

*What works.* The honest blank is the strongest moment in the set. Software
almost never admits "we do not know what happened here", and this says it in
place, with a person to ask. Thickness as activity makes busy weeks and quiet
weekends visible without a chart.

*What fails or risks.* The core takes a permanent column and fights the
shell's own left side (Orbit, rails). Thickness distorts time, so the same
drag distance covers different durations: good for "dig to events", bad for
"go to Tuesday". The lamination texture reads as stripes at small sizes.
Mostly a showcase: **the unconformity mark belongs on every rail** (V1, V3
and V6 should all draw it), and the core itself is optional.

*Principles.* Explain, never hide applied to time: exemplary. Calm: still at
rest. Focus stacking: the view desaturates in the gap. That is a weaker cue
than a rack focus, but right, because the gap is not something to focus on.

*Needs.* The proposed `--x-core-w`. The events service must record its own
coverage: start and end of ingestion outages, retention cut-offs and imports.
Events need `recordedAt` as well as `occurredAt` to mark "recorded late".

*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V5: Local time

*Idea.* Each library row carries its own word-sized history: a sparkline
with read wear below the line, versions as ticks above, corrections gold,
stale hatch, your last visit dashed and now green. Focus a row and press `←`
(or drag its sparkline), and **only that object** goes back in time. It lifts
with an outline and a "Local time · Mon 19 Oct 17:40" tag. The rest of the
library stays at now and racks out of focus (the cinematic far plane: blur
and desaturate, no scrim). The side pane makes the object explain itself:
each field shows its value then, its value now if different, and "since
when, by whom, why". There is also a "what happened next" list and a read
count with a privacy floor: "31 of 42 people", or "fewer than 5" below it.

*Sources.* Hill and Hollan, edit wear and read wear (the scrollbar as a
record, shrunk to a row); Tufte sparklines (history at word size); cinematic
rack focus and focal planes.

*What works.* It is the most honest model of what people actually do: they
ask about *one thing* ("what did this say when I approved it?"), not about
the whole screen. Rack focus makes a view at mixed times readable, because
the plane in focus is the one at the other time. Field-level "since when" is
the prompt's "why are you like this, and since when?" answered in place.

*What fails or risks.* Two times on one screen is a new idea people have to
learn. The blur makes the rest unreadable, so a second object can't be
compared without leaving. A sparkline per row adds SVG cost, so it needs list
virtualisation and pre-binned daily counts. The lens outline uses `--info`,
and so does the keyboard focus ring: that is a real clash (see Gaps).

*Principles.* Focus stacking: the best use of it in the set. Explain, never
hide: field by field. Calm: one object moves, and only on request. Privacy:
read counts are shown only above a threshold, and never with names.

*Needs.* Tokens `--x-far-blur` and `--x-far-saturate` (from the cinematic
focus recipe), `--x-spark-w` and `--x-pane-w`, plus a "then" colour distinct
from focus. Data: field-level history per object, daily read counts per
object, and reads since each version.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V6: Tide table

*Idea.* The scrubber faces forward. On the You floor's Home, scrub right of
the now line and the view becomes a forecast ("if nothing changes"): rows
turn dashed, things fall due and go **overdue**, review dates pass into stale
hatch, a share request **lapses** into shadow, and the upgrade window opens
and closes. Each row has a distance-to-travel tape: now, the due date, the
playhead, hatching past the due date, and **tide lines** where a date was
already missed once. An almanac prints the next known dates as a tide table
does. Under the list sits a tide chart: recorded load behind now (filled),
known load ahead (dashed), and the **high-water mark** of the past fortnight
across both, so "Thursday will be higher than any day this month" is a
picture.

*Sources.* Tide tables and almanacs (the future printed beside the past);
flood marks on bridges; Open MCT limit lines; the cinematic mini limit tape.

*What works.* It is the only variant that treats the future as a real place
on the same axis. The high-water mark gives a forecast a comparison, which a
plain list of deadlines lacks. Forecast rows are visibly dashed, so nobody
mistakes them for now.

*What fails or risks.* A forecast built only from known dates leaves out
what people will do. "If nothing changes" is honest, but it can feel
alarming. The tide chart's load measure (open plus due within two days) is my
invention and needs Harry's definition. It is too much for a Home at rest, so
it belongs behind a key or in the Glance.

*Principles.* Distance to travel: done fully. Calm: still until you scrub.
Explain, never hide: lapsed things stay as shadow, with who can act. Letterbox:
not used. A forecast that crosses the high-water mark *could* be the trigger
for the urgent path, which is worth a discussion.

*Needs.* The proposed `--x-tape-w` and `--x-tide-h`. A "known future" query
across apps: Mandate deadlines, Artifacts review dates, Upgrade Centre
windows, identity role expiries and share-request expiry. Plus a daily
snapshot of open items that need each person.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

---

## Ranked

1. **V1 Since you were here**: the default, built on one rail every view
   shares. Change it to show the end state first and replay on request.
2. **V5 Local time**: scrub one object; it is the way to ask a single value
   "since when?"
3. **V3 Then and now**: the mode for structural views (org, collections,
   intent sub-parts).
4. **V6 Tide table**: the forward half of the same rail; the almanac and
   high-water mark are worth keeping.
5. **V2 Up the ladder**: keep rung 3 (All times) as a library mode; drop
   rung 2 as drawn.
6. **V4 Core sample**: keep the unconformity and its explanation everywhere;
   the vertical core is a showcase.

## What I'd build first

One `TimeRail` component in Aerie that every view can mount. It has the now
line, the last-visit ring, wear ticks binned by hour (so a busy view never
draws more than a few hundred ticks), unconformities from the events
service's coverage, and the dashed future with known dates. Pair it with
V1's end state: on arrival the view is drawn at now with "changed since"
marks and a "When you left" line on each changed object, and replay is one
key away, not automatic. Next, add V5's object lens (`←` on a focused object
scrubs only that object, the rest racks back), because it reuses the focal
planes and answers "since when?" with no new screen. V3's bridges and V2's
All-times picture are modes to add per app later. V6's forward half is the
same rail pushed past now, so it costs little once the rail exists.

**What the events service would need to record** (today it keeps domain
events; this is what each mark needs on top):
- **Every replay**: `occurredAt` *and* `recordedAt` on each event, so late
  arrivals can be marked "recorded late". Also a `subject` (kind, id), the
  `floorId`, the `actor`, and **field-level before/after** values, so a view
  can be rebuilt at time *t* without diffing snapshots. For big views, a
  periodic snapshot per view or projection, so replay doesn't fold millions
  of events.
- **Since you were here**: a per-person `view.visited` (view id, time).
  It is only ever read back by the same person.
- **Unconformity**: the service's own coverage, published as events
  (ingestion paused or resumed, retention cut-off, import backfill). Without
  these, a gap looks like a quiet day, which is the worst lie a time display
  can tell.
- **Seam**: `correctionOf` on edits, to tell a correction from a new
  version.
- **Moves and renames** (V3): parent-change and rename events from identity
  and registry, with old and new values.
- **Read wear** (V2, V5): daily read counts per object, and reads since each
  version. *Privacy, flag for Harry:* store counts, not who read what, where
  possible. Raw per-person read events are needed only for "who has read
  this since it changed" in the reader surface.
- **Distance to travel** (V6): a "known future" feed of deadlines, review
  dates, maintenance windows, role and share expiries, each with its source
  app and who can move it.
- **High-water mark** (V6): a daily snapshot of open "needs you" items per
  person. It can be derived, but is cheaper stored.

**Questions for Harry (not decisions):**
- *Read wear privacy.* Show read counts only when at least N people (say 5)
  are in the count, as V5 does with "fewer than 5". Never show names without
  each reader's consent. Should N be a per-floor setting, and does the Org
  floor need a higher floor?
- *Replay permissions.* When you replay a view, do you see past state through
  today's access, through the access you had then, or only what both allow?
  I recommend both (the intersection), so replay can never reveal something
  you couldn't see at the time or can't see now.
- *Auto-play.* The prompt makes "what changed since I was last here" the
  default first move. I recommend the default be the **still end state with
  marks**, and playback a choice, to stay "dark when normal".

## Where it conflicts with the cinematic shortlist

- **Flicker overload.** The light language allows a flicker when something
  changes. A replay produces a run of them. I capped it at one flicker per day
  group, and only during a replay, but the right fix is no auto-play.
- **`--info` means three things.** The focus ring, "changed" (flicker) and
  "then / your last visit" all use `--info`. In V5 the lens outline can be
  mistaken for keyboard focus. *Needs token:* a distinct `--then` colour
  (perhaps a cooler mix of `--floor-you-low` and `--ink`), kept apart from
  `--focus`.
- **The rail and the bottom band.** The rail sits where the shell's bottom
  band (`--band-bottom`) is. If both exist, the rail must become the band's
  content when a view is scrubbed, not a second strip.

## Needs token (all are `--x-*` at the top of each file)

`--x-now`, `--x-past-opacity`, `--x-wear`, `--x-wear-strong`,
`--x-stale-hatch`, `--x-seam`, `--x-since`, `--x-future-dash`, `--x-rail-h`;
layout: `--x-ladder-w`, `--x-col-w`, `--x-core-w`, `--x-spark-w`,
`--x-pane-w`, `--x-tape-w`, `--x-tide-h`; reused from the cinematic run:
`--x-type-micro`, `--x-pattern-unavailable`, `--x-far-blur`,
`--x-far-saturate`. IBM Plex Mono (`--font-mono`) is used for every time
label and needs its ADR.

## Accessibility notes

The rail track is a focusable `role="slider"` with `aria-valuetext` (the
time, in words). Buttons are real buttons, and the icon-only ones get an
`aria-label` at 1280. Under reduced motion, flickers are off, the playhead
jumps without easing, and demo steps run at the instant duration. Every
state has words beside its colour or hatch.
