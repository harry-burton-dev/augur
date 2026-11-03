# Combined V1: Back after two weeks (`v1-back-after-two-weeks.html`)

*Idea.* You open a collection in Artifacts after 14 days away. The shelf
is drawn at now, in its usual order, and the marks of what happened while
you were gone deposit onto the objects themselves. Each changed row gets an
ink notch and a "changed 27 Oct" tag. It also gets one dashed "When you
left" line showing how it stood then ("v5 · said passwords rotate every 30
days"). The three things that need you bloom. A single "When you left" line
under the masthead gives the date, the counts, and what changed in other
apps. A time rail at the foot of the list carries the one now line. On it
are your last visit as a ring, one ink tick per change (click one to jump to
its row) and the known dates ahead as distance to travel. After
`--x-settle` (6 s) the arrival layer folds away. The When-you-left lines
collapse, the top line shrinks to "Since 19 Oct: 6 changed, still marked · 3
need you · S show what changed", and the blooms stop breathing and hold
steady. **Replay is on request** (P). It plays the shelf day by day from
your last visit, and each change lands as an ink deposit, not a flicker. The
About pane answers "why and since when" for the focused row, and gives your
own trace exactly: "You last opened it on 14 Oct at 10:42 (v5), when it said
30 days. Only you see this line."

*Combines.* Library V1 patina shelf: the row itself ages through tone,
wear edge and stale hatch. Library V5: distance to travel at word size and
on the rail. Scrubber V1: the since-you-were-here rail, the "When you left"
line and stepping with [ ]. It changes scrubber V1 in the way round 1 asked:
the end state comes first and replay waits for you. Reader V3: the seam on
the repaired words ("rotation period 90 days" double-underlined, with "was
30 days" in About). Reader V6: read-since counts with the group-size rule,
and a bloom for a repair to something you read. Grammar V1/V2: mark names
and recipes, one now line, time is matter.

*Sources.* Hill and Hollan (read wear, the overview ruler beside the list),
Open MCT (now line, stale), patina, kintsugi, tide tables (distance to the
next known date), Bret Victor (replay in place, on request).

*What works.*
- **Nothing moves to tell you what changed.** The shelf keeps its order, so
  spatial memory survives two weeks away, and the changes sit on the rows
  you already know. (I went beyond the brief here: the "Changed since"
  filter chip was dropped. Re-sorting on return would have broken the "in
  place" promise.)
- **Three kinds of time, visibly different.** A stale section that was
  already stale before you left (Incident response plan) shows hatch and
  nothing else. A document that went stale while you were away and is
  yours blooms. One whose owner left while you were away shows an ink notch,
  hatch, and a When-you-left line ("owner R. Haines"). You can tell old
  trouble from new news without reading.
- **"You read the old figure" is the strongest line on the screen.** It
  joins your exact private trace to a public repair, and it is the reason
  the repair needs you, not just "changed".
- **Calm after arrival.** Once settled, the screen differs from a normal day
  only by ink notches and three steady blooms. Opening a row (Enter or
  click) clears its notch. Done catching up (D) clears all notches, but the
  blooms stay until the thing is done.
- **Cheap.** Each row needs `lastVisit` per viewer, the changes after it,
  and one `then` string. The rail bins ticks by day. All of it is CSS on
  existing rows, so it is fine on 5,000 documents if the server sends only
  changed rows' `then`.

*What fails or risks.*
- **The "When you left" string has to come from somewhere.** I wrote it by
  hand ("v5 · said 30 days"). In the product it is a per-kind summary of the
  last version you saw, which means a diff summariser per object type. A
  generic "v5 · 3 edits since" is the honest fallback.
- **Settling on a timer is a guess.** 6 s is fine for a demo, but in real
  use the fold should follow attention: settle once the rows have been in
  view for a dwell, or on first scroll. A timer folds things you have not
  looked at yet. S brings them back, which softens the cost.
- **The cap of three blooms is hit exactly.** A fourth needs-you item would
  need the light language's rule ("more becomes a list, not a glow"), which
  this screen does not yet show.
- **Overview ruler next to a hidden scroll bar.** I hid the native bar to
  avoid two rails. Keyboard scrolling still works, but the ruler is not a
  real `role=scrollbar` yet (reader V1 has that work).
- **The rail's scale is linear across about four weeks**, not the grammar's
  sqrt-past scale. A return view is a zoomed rung, so linear is right, but
  the kit `TimeScale` needs a "window" mode that says so.
- **At 1280** the meta slot drops the "· who" parts. They stay in About.
- **Replay while the About pane stays at now** is a mixed-time view. It is
  correct (About is the present answer), but it should say "now" in its
  header during replay.

*Principles.* Calm: yes after the settle. The only motion at rest is three
blooms, and they stop after three breaths and hold (that is a proposed change
to the light language, which breathes forever: see below). Explain, never
hide: the archived document stays on the shelf with "Library owners can
restore it until 23 Jan". Review now is locked, with who can do it. The
withheld counts say why. Focus stacking: none needed. The About pane is the
near plane, and the list does not rack. Letterbox: not used. Nothing here is
urgent, and a return screen should never open one unless something urgent
waits (cinematic pushback, kept).

*Privacy (question for Harry).* Others' wear is shown as counts only.
"Fewer than 5 readers" is shown with no total of readers beside it, so it
cannot be subtracted. The split by group in About shows only when every
group has 5 or more. Your own trace is exact, private, and labelled "Only
you see this line". The proposed rule is the one from reader V6 and library
V6, unchanged: **counts only; split only when every group ≥ k; names only
with consent; k per deployment.**

*Needs.*
- Tokens: `--mark-seam`, `--mark-now`, `--mark-tide`, `--mark-stale-hatch`,
  `--time-past-dim`, `--wear-min`/`--wear-max` (from the grammar), plus new
  ones from this screen: `--mark-since` (the since-you-left span, ink 5%),
  `--mark-since-edge` (the notch, ink 70%), `--mark-deposit` (a change
  landing during replay, ink 10%) and `--time-arrival-hold` (how long the
  arrival marks stay unfolded; I used `--motion-hold`).
- Light language: a "bloom then hold" variant (breathe three times, then
  steady) so a needs-you glow does not loop all day.
- Kit: Quill list row props `age`, `wear`, `stale {days, by}`, `seam`,
  `changedSince {at, then}`, `needs {short, why}`. An Aerie `TimeRail` in
  window mode. A shared `Why` panel. `lastVisit` in the shell, per viewer
  per view.
- Data: `view.visited` per viewer (private), document `update` events with
  `kind` (`correction`, `archive`, `owner.change`) and a reason,
  `review.due` and `due.passed` events, `member.left` feeding
  `owner.change`, aggregated read counts per document per month, and a
  per-kind "as you last saw it" summary. "Elsewhere" counts need a
  cross-app "since" query in the shell (the same shape as the cinematic
  waiting counts).

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5
