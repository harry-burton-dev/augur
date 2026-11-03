# Upgrade Centre and deployment history: critique

Surface 6 of "Wear and time". Every page reads the same deployment from one
sample `DATA` object: AUGUR 0.8 Wren to 0.13.4 Curlew on five servers, with
one rollback (0.11.2 on Servers 1 to 3, repaired by 0.11.3), five weeks with
no record (the events store move, 19 Jun to 23 Jul), one missed window
(1 Oct), two patches never taken (0.13.2, 0.13.3), Server 5 not reporting for
47 minutes, and 0.14.0 Dunlin waiting for Thursday's window. That last item is
the only thing that lights up. It uses the cinematic **bloom** (green, still,
with words), and the same "needs you" pill sits in the head of every variant.

Marks use the run's names: **ring**, **stratum**, **scar** (a rollback; muted
danger, because it is past), **seam** (a repair; white with a soft glow),
**unconformity** and **stale hatch** (the same diagonal hatch, always with
words), **tide line** (dotted: a window that passed with a release waiting),
**high-water mark** (the worst bake), **now line** (solid ink) and **distance
to travel** (green, from now to the window).

Shared across all six: the page head, the in-place "why are you like this,
and since when?" card (Why / Since / Who rows), the R replay, Esc, and a
reduced-motion path. Under reduced motion the reveals cut to their end state
and the card still opens. Checked at 1600×900 and 1280×800 with no console
errors.

---

## V1: Tree rings (`v1-tree-rings.html`)
*Idea.* The deployment is drawn as a trunk cross-section. Each minor release is
a ring, its width the time it ran. Patches are thin latewood lines, and a
harder bake leaves darker, thicker latewood. Each server owns a fifth of the
circle, so the 0.11.2 rollback is a fire-scar notch in Server 3's sector,
healed over by a seam at 0.11.3. The missing weeks are a hatched ring. The
bark is now, and the window ahead is a dashed green ring not grown yet. On
load an increment borer takes a core along Server 3, and the right-hand panel
reads that core as a strip and a list.

*Sources.* Dendrochronology (ring width, latewood, fire scars, callus), the
increment borer, Hill & Hollan (navigation and record in one control).

*What works.* "The object remembers" is literal: one glance shows age, a
hard year and a wound that healed. The core strip is a good bridge from the
picture to a readable list. The scar reads as a scar without a legend.

*What fails or risks.* Angles mean nothing in time, so the sectors are an
invented convention. Radial area exaggerates outer rings. The future needs
its own scale (4×, labelled), or three days would be 4 px. Labels compete in
a small space at 1280. It is a picture of history, not a working screen:
approving 0.14 still happens somewhere else.

*Principles.* Explain-never-hide: the gap and the stale arc are drawn and
labelled. Calm: still after the borer. No letterbox. Focus stacking is not
used.

*Needs.* `--pattern-stale`, `--time-past-opacity`, a future-scale token or a
rule, and per-server rollback reach (`reached: [s1, s2, s3]`), which the
updater has to record.

*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V2: Borehole strata (`v2-borehole-strata.html`)
*Idea.* A stratigraphic correlation chart. Dev, Preview and Stable are
reference cores, and each server is a core beside them. Releases are beds:
deeper is older, the ground is now and the sky above is the window ahead.
Correlation lines join where each release begins in every core, so their
slope is the lag between channel and server. The rollback is a jagged fault
that pinches out before Servers 4 and 5. The unconformity is a wavy erosion
surface over hatch. A wireline-log track (bake errors on Server 3) carries
the high-water mark and Preview's forecast for 0.14.

*Sources.* Stratigraphic correlation between boreholes, unconformities,
wireline (gamma-ray) logs.

*What works.* Lag becomes visible: the 0.12.2 line is the steepest because
it missed a window. "Pinches out" explains a partial rollout better than any
table. The log track puts a measure beside the record, the way geologists do.

*What fails or risks.* Five server columns are nearly identical, which wastes
width when servers move together (the normal case). Downward time is the
opposite of the reader's expectation in software. Short events (29 minutes,
47 minutes) need fixed-size marks that break the scale. Dense to read at
first.

*Principles.* Explain-never-hide is strong (gap, stale cap, pinch-out). Calm:
correlation lines draw once, then still.

*Needs.* Upstream dates per release and channel (registry), per-server
rollback reach, bake error samples per server (updater), and the same stale
and past tokens.

*Score.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 3

## V3: Tide almanac (`v3-tide-almanac.html`)
*Idea.* A printed tide table with one row for every Thursday window, past and
ahead, split by a now line. Past rows are quieter. The no-record weeks fold
into one hatched row, the missed window carries a dotted tide line, the
rollback row has a scar on its edge and the repair a seam. Beside the table
stands a bridge pier. Every bake is carved at its peak error rate: the
ordinary weeks wear a dense band near the waterline, and 6 Aug stands alone
as the high-water mark. On load, Preview's bake for 0.14 is drawn on the pier
as a dashed forecast, and the 0.14 row opens its card.

*Sources.* Tide tables and almanacs (known future events printed beside the
past), flood marks on bridge piers, Open MCT's now line.

*What works.* It is the clearest of the six and the cheapest to build: a
table with row classes plus a small SVG. "Windows are the unit" matches how
admins think. The forecast mark ("on Preview it peaked at 0.7%") is a useful
new idea for approving: it gives a known tide ahead, drawn on the same scale
as the past.

*What fails or risks.* It looks the most like ordinary software. The pier
uses a square-root scale so ordinary weeks stay readable; that is labelled
only by the axis marks, and could mislead. With weekly windows, a year is 52
rows, so it needs the fold-and-scroll behaviour this page only half has.

*Principles.* Explain-never-hide in every row. Calm. Uses the bloom for the
due row, which fits the light language exactly.

*Needs.* A window rule in config (exists as a setting, needs an id),
missed-window events, Preview bake peaks (needs telemetry from preview
deployments: a new upstream feed), `--pattern-stale`.

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V4: Release timetable (`v4-marey-timetable.html`)
*Idea.* Marey's train graph. Rows are stations (Dev, Preview, Stable,
"Waiting here", then each server) and time runs left to right. Every release
is a train line: it slants down through the channels, runs flat in "Waiting
here" until a window, then drops through the servers. Flat is waiting and
steep is fast. The rollback is a train that reverses at Server 3 (the scar).
Patches that were never taken end at Stable with a bar. Thursday windows are
faint vertical bands, the next one green. On load the past reveals left to
right up to the now line, then the future dashes in and the 0.14 card opens.
← and → step from release to release.

*Sources.* E. J. Marey's Paris–Lyon timetable (1885; in Tufte's *Visual
Display*), Open MCT now line.

*What works.* It shows the whole pipeline and your place in it in one
picture, including releases you never took and how long each one waited
(0.12.2's long flat run through the missed window). The distance to travel
is a real arrow on the same axis. It scales to years by panning.

*What fails or risks.* Twenty-two lines get busy, so it needs the focus mode
(others dim to 18%) to read one. Server rows add little while servers move
together; they earn their place only during a bake or a rollback. Line
colour by state needs words alongside, which the legend and labels carry.

*Principles.* Explain-never-hide (skipped and inferred releases are drawn,
not dropped). Focus stacking light: the selected train is sharp and the rest
dim. Calm after the reveal.

*Needs.* Upstream channel dates (registry), "approved at" and "applied at"
events per release (updater), the rollback path, and estimate flags for
future channel dates.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit 4

## V5: Worn inventory (`v5-worn-inventory.html`)
*Idea.* The Upgrade Centre's ordinary list (AUGUR, platform apps, pillar
apps, servers), where each row's own surface is worn by its history. A strip
behind the row's timeline carries a tick for each change (taller means a
bigger change), scars, seams, the unconformity hatch, a tide line, and a
**patina** gradient that grows the longer the part has been unchanged. The
row ends at the now line, with a green dashed tick where Thursday will change
it. The Ahead column says what arrives, or "no change in 0.14". Opening a row
answers in place, in one sentence ("Artifacts is 2.6.0 because AUGUR 0.13.0
Curlew brought it on 15 Oct, applied by Harry Burton…"), with the version
ladder as chips. The five servers share one row of five thin lanes, so the
scar on Servers 1 to 3 and the stale hatch on Server 5 sit side by side.

*Sources.* Hill & Hollan edit wear (marks on the control itself), patina,
Tufte sparklines and small multiples.

*What works.* It is history on the object with no new screen, and it is still
the list admins need for work. It reads at a glance (Home and Explorer have
patina; Artifacts has a scar and a seam), and the sentence answers "why, and
since when" without a log. It is cheap: absolutely positioned ticks, so 50
parts or 5,000 rows cost the same per row.

*What fails or risks.* Least distinctive to look at. Patina could be misread
as stale, so the rule "patina = unchanged, hatch = unknown" must hold
everywhere. Ticks under 2 px merge on long axes, so above about a year it
needs binning. At 1280×800 the legend is hidden.

*Principles.* Explain-never-hide: every row can answer, the stale server
stays visible and says who can restart it. Calm: still. Bloom only on the
"needs you" pill and green only where the window changes something.

*Needs.* `--pattern-stale`, `--time-past-opacity`, a patina recipe token, app
versions per platform release (the registry has this), and release-notes read
counts for the AUGUR row ("read by 2 of 3 Org admins"). **Privacy flag for
Harry:** that read count is read wear on colleagues. I propose counts only,
never names, and only on the Org floor where the audience is the admins
themselves. That is a question, not a decision.

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 5

## V6: Now and Thursday (`v6-transpointed.html`)
*Idea.* Two states of one deployment side by side, as transpointing windows:
on the left Now (0.13.4 Curlew), on the right after Thursday's window (0.14.0
Dunlin), changes first. Bridges join each part. Unchanged parts get a quiet
hairline, changed parts a lit band, and a new migration fans in from nothing
on the right. Changes that are not version numbers are first-class: the
default for approving minor releases goes from one approver to two, and the
search index rebuild takes about 12 minutes a server. A scrubber below moves
the left side to any past release ([ and ]), and the bridges then carry the
scars and seams that happened in between. O overlays each part's earlier
versions as fading ghosts.

*Sources.* Ted Nelson / Xanadu (Maggie Appleton's patterns: parallel
documents, visible links), Bret Victor's ladder of abstraction (scrub one
state, then step up to all of them).

*What works.* This is the approval screen. It answers "what will Thursday do
to me?" in place, including the setting change that a version list would
hide. Scrubbing back to 0.11.0 makes the bridges show the Swift scar and its
seam. That is the strongest "history between two states" moment of the run.

*What fails or risks.* Crossing bridges look striking but cost attention.
Sorting "changes first" on the right only is a trade-off: it is readable,
but the lines cross. It needs a manifest-level "what changes" (settings,
migrations), which apps do not declare yet. The scrubber's ticks are small
targets.

*Principles.* Explain-never-hide (the changed default is shown before it
happens, with who can keep the old one). Calm: bridges draw once. It would
pair with the urgent path: a halted bake would open the Letterbox from here.

*Needs.* Release manifests that declare setting defaults and migrations with
time estimates, per-release app versions, `--x-row` (target-md + space-1).

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

---

## Needs token (all variants)
- `--x-type-micro` (11px mono numerals; carried over from the cinematic run).
- `--pattern-stale`: one diagonal hatch for unknown, stale and no-record.
- `--time-past-opacity` (.62 here): how much quieter the past is.
- Colour roles, not new colours: `--mark-scar` (danger mixed with muted ink)
  and `--mark-seam` (light at 78%).
- A rule for drawing the future at a different scale from the past, always
  labelled.
- SVG stroke widths and dash patterns (1–3 px) are hairline values, not
  tokens. The kit should name two or three of them.

## Data the shell doesn't have yet
- Upstream: dev, preview and stable dates per release (registry), estimates
  flagged.
- Updater events: approved, applied per server, bake samples per server,
  halted, rolled back (with the servers reached), and missed window (a window
  opened while a release waited).
- A heartbeat per server for stale marks, and **record continuity**: the
  events service must be able to say "no events from X to Y" rather than
  showing a quiet stretch. That one field drives every unconformity.
- Release manifests that list setting defaults and migrations (V6).
- Release-notes read events (V5), which raise the privacy question above.

## Ranked
1. **V5 Worn inventory**: the list that ships, with history on every row.
2. **V4 Release timetable**: the best whole-history picture; the history view.
3. **V6 Now and Thursday**: the approval screen.
4. **V3 Tide almanac**: the clearest table; keep its pier forecast.
5. **V1 Tree rings**: the most memorable; a poster, not a tool.
6. **V2 Borehole strata**: right idea (lag as slope), wrong orientation and
   too much width.

## What I'd build first
Build V5 as the Upgrade Centre's home list. Its strip is cheap, it needs only
data the registry and updater nearly have, and it sets the rules every other
surface reuses: tick = change, scar, seam, hatch = unknown, patina =
unchanged, green dashed = arrives in the window. Then make the "needs you"
pill open V6 as the approval screen, with V3's Preview forecast added beside
each changed part ("on Preview it peaked at 0.7%"). V4 comes third, as the
history view one level up. It also answers the shortlist question of what a
whole year looks like on one screen. Where I went beyond the ask: V6 treats
changed setting defaults and migrations as part of the upgrade's history.
Today they are invisible until they bite, and that is what an admin
approving Thursday needs most. It needs release manifests to declare them, so
it is a gap for an ADR, not a UI change.
