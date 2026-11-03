# Round 2: combined screens

## Combined V1: Back after two weeks (`v1-back-after-two-weeks.html`)

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

---

## Combined V2: Reader with history (`v2-reader-with-history.html`)

*Idea.* The Artifacts reader with seams as the main idea and every other
time mark beneath them. A repaired value keeps its gold double line and a
"repair · 9 days" margin note. Pressing it opens the **why and since when**
card in the aside. The card is tied to the value by a dotted seam thread and
shows the value's strata: €42 for 1.6 years, €48 for 9 months, €45 for
4 weeks (wrong), €54 now, and "no record before 16 May 2024". It also gives
the repair reason, how long the wrong value stood, and how many have read it
since. From the card, **Before and after** (B) opens the parallel page, with
ribbons joining what stayed the same (reader V3). Every heading carries its
review state in words ("review 8 months overdue") and a read-since waterline
("6 of 38"). The stale section is hatched and carries its card, with "Ask
Jonas Meyer". A section that changed since you read it says so. It says it in
ink for ordinary edits ("1 edit, no repairs") and in light only when a
figure you read was repaired. That light dims once your reading counts,
after a dwell. The aside's resting state is the almanac: every section on
one scale, with one now line drawn through all seven strips, your last read
marked, and below it read-since for the section you are on. A thin wear rail
replaces the scroll bar. It shows edit wear left by floor, read wear right,
gold repair ticks, the stale band and an ink "since you read" bracket.
**History** (H, in the band) is the only way in to the History Flow view. It
widens the aside, draws all 18 versions as one picture and lets ← →
replay the page in place, with the page dimmed and a "Viewing version 12 as
it stood on 19 Aug 2026" bar.

*Combines.* Reader V3 seams (the main idea, and the parallel page). V4
section almanac (heading state, stale card, the almanac with one now line).
V2 margin ledger (only its value card, now in the aside rather than on
hover). V1 scrollbar wear (the rail). V6 read since changed (gauges, the
high-water mark, the safe group rule, bloom then dim). V5 history flow
(behind H only).

*Sources.* Kintsugi and conservators' "visible and reversible". Xanadu
(parallel pages, visible links). Hill and Hollan (edit and read wear).
Geology (strata, unconformity). Tide tables and high-water marks. Open MCT
(stale, now). Viégas and Wattenberg, History Flow. Bret Victor (scrub in
place).

*What works.*
- **One explain surface.** Round 1 had the value card floating over the
  page, and it covered the almanac. Here the aside holds four states:
  almanac, why, before/after, history. Only one shows at a time, and a
  dotted thread keeps the answer tied to the value it explains. Esc always
  goes back one step.
- **The one now line is real.** Because every almanac strip shares one
  scale, the now line is a single element across all of them, not seven
  lines that happen to align. That is the grammar's rule, built.
- **Light is spent once.** Only "a figure you read was repaired" glows, and
  it dims when you have read it. Ordinary changes since your last read use
  the same words in ink. Stale is hatch. Repairs are gold matter. A screen
  full of history still reads calm.
- **History on request is right.** The default reader is still a page you
  read. The flow picture is one key away, and it starts from where the
  aside already was, so it feels like stepping up a rung, not changing
  screens.
- **The privacy rule holds in the open.** Daily allowances has 4 and 2
  readers since the repair. The heading shows "6 of 38" as a single bar, and
  the panel says why the split is hidden.

*What fails or risks.*
- **Five marks on one page is the limit.** Seam, state words, gauge, wear
  rail and since-you-read bracket are each quiet, but together the heading
  rows are busy. If one goes, the heading gauge should become hover-only,
  since the panel already shows the count for the section you are on.
- **Value strata need value-level history.** Artifacts keeps versions, not
  values. Here `values` is hand-written. In the product it needs an
  extractor (fields in a structured document, or a marked value), or the
  card falls back to the paragraph's changes.
- **The wear rail replaces the native scroll bar.** That is an
  accessibility cost (reader V1 noted it). It has `role=scrollbar` and arrow
  keys, but OS scroll settings are not honoured.
- **Ribbons and the thread are fragile.** They are drawn from bounding boxes
  on scroll and resize. In React they need anchor ids and a ResizeObserver.
- **History mode at 1280** leaves the reader quite narrow: the page keeps
  its measure, and the margins shrink.
- **Seam gold against Team amber.** Field Operations edits are amber in the
  wear rail and the flow, close to the repair gold. A seam token with its
  own hue is still needed (round 1 flagged this).

*Principles.* Explain, never hide: Undo repair and "Tell the 25 who read the
old version" are visible, unavailable, and say who can. The unconformity is
drawn in the strata and the flow. The stale card says how old it is, why,
and who can fix it. Calm: nothing moves at rest except the one bloom, which
stops when read. Focus stacking: History dims and desaturates the page
(V5's past plane, no blur, so it stays readable). That is a cousin of the
cinematic far plane and should share its tokens. Letterbox: not used.
Radial menu: "Why and since when", "Before and after" and "History" are
natural verbs for the History direction of the cinematic radial menu. Today
they are keys and buttons.

*Privacy (question for Harry).* As in reader V6: counts only, a split by
group only when every group has at least k (here 5), owners see the same
counts, never names. Section read events are new and sensitive. Your own
"you read it here" mark in the almanac and the flow is private to you.

*Needs.*
- Tokens: the grammar set (`--mark-seam` with its own hue, `--mark-wear`,
  `--mark-wear-read`, `--mark-tide`, `--mark-now`, `--mark-stale-hatch`,
  `--time-past-dim`), plus `--mark-since-edge` (shared with V1) and
  `--aside-history-width` (I used `--x-aside-history`).
- Kit: a Quill `Seam` inline mark, a `Why` aside panel with a tether, the
  shared `TimeScale` driving both the almanac strips and their one now line,
  a `WearRail` scroll bar, and a `HistoryFlow` in Explorer or the reader's
  History mode.
- Data: `update.kind = correction` plus reason (seams, the cheapest and
  most valuable field). Section anchors on updates. `review.due` per
  section or a library default, with a refresher role. Aggregated
  `section.read` per group after a dwell (privacy). Your own last read
  (private). Value-level history, or a value extractor. `record.started`
  for the unconformity.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 5

---

## Combined · V3: Fact in place (`v3-fact-in-place.html`)

A Data Atlas entity page (Kestrel Logistics, six facts) you could ship. The
whole page draws on one record and shows it at three distances, switched with
`1 2 3` or the segmented control: **Facts** (the table, with word-sized strata
on every value), **History** (the same rows widened into History Flow small
multiples on one time axis) and **Compare** (two dates side by side as a
parallel record). The demo opens Headcount's answer 1.2 s after load. `R`
replays it. `#history` and `#compare` in the URL start in those views.

### What it combines
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

### What works
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

### What fails or risks
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

### Principles
Explain, never hide: strongest of the run. Every value answers in place. The
gap, the silent source, the rejected values and the steward-only decision all
stay visible and say why and who. Calm: still at rest, with one lit mark
(the bud) and one transition per action. Focus stacking: near plane in Facts.
Letterbox: n/a. A disputed fact that blocks a filing deadline would escalate
to the urgent path. That is not drawn here.

### Needs
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

### Questions for Harry
- **"Your last visit" as the default Then** needs per-person last-seen
  timestamps per object. Proposal: keep them for the person only, never shown
  to others, and expire them after the record's retention. Your call.
- **Read wear in the margin**: still counts only, never names. Same open rule
  as round 1 (hide below a floor audience threshold).

### Where I went beyond the ask
I split "gap" into **silent source** (stale, known) and **no record**
(unconformity, unknown), and made the second come only from the events
service. That is a data-model decision as much as a design one.

### Score
Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

---

## Combined · V4: One now line (`v4-one-now-line.html`)

An Org Home view, "Ahead", that puts two apps on one time axis with one now
line. **Mandate**: the intents you own or asked, as the intent ledger.
**Upgrade Centre**: the deployment's parts, as the worn inventory. Everything
older than now sits under one translucent water plane. The selected object
opens in a gauge panel on the right: a **staff gauge** for an intent, a
**pier** with the Preview forecast for an upgrade. The demo fills the water,
draws distances out from now and selects "Records retention in Artifacts"
1.2 s after load. `R` replays it. `#augur`, `#sso` and the other ids in the
URL pick the selected row.

Keys: `↑ ↓` rows, `Enter` reads it closer, `Tab` reaches every mark (each
answers "why, since when, who can change it"), `M` opens Move deadline,
`Esc` closes, `R` replays.

### What it combines
- **Intents V6 intent ledger** (rank 1): rows with effort water, a high-water
  notch, stale hatch, distance to travel, overrun, a shadow row and a done row.
  One now line is drawn by the board, not by each row.
- **Intents V2 staff gauge** (rank 2): in the panel. Time rises, the past is
  under water, and the dry staff above is the distance to travel. Each
  extension is a seam where a section was bolted on, and its old top stays as
  a line. An overdue intent's staff is fully under water, with the waterline
  above the cap, which reads "overrun" without a word.
- **Intents recommendation "a reason is required when a deadline moves"**:
  built. Every seam carries its reason in the why-pane. The Move deadline form
  keeps its Move button unavailable (dashed, and it says why) until there is
  a reason. On Move, the new seam appears on the row and the staff grows a
  section. A move made before the rule (`reasonRequiredSince`) shows a
  *dashed* seam: "No reason recorded. Moves after 1 Oct must carry one."
- **Upgrades V5 worn inventory** (rank 1): AUGUR, Artifacts, Explorer,
  Mandate and Servers. Change ticks (taller means bigger), the rollback
  **scar**, the repair **seam**, the missed-window **tide line**, an
  inferred change inside the gap (dashed tick), Server 5 stale, and the green
  dashed tick where Thursday changes the part.
- **Upgrades V3 tide almanac's forecast**: the pier. Past bakes are carved at
  their peak, the 3.1% high-water mark sits at 0.11.2, there are watch and
  halt lines, and 0.14.0's Preview peak is drawn dashed green as a *known
  tide ahead*. Maintenance windows run as faint bands across the whole board,
  and the next one is named under it.
- **Concepts from round 1:** *past-under-water* (intents), *one-now-line*
  (intents, grammar), *record-continuity* (upgrades), *forecast-from-upstream*
  (upgrades).

### What works
- **Distance compares at a glance.** Under a year the past is linear, so a
  week is the same width on both sides of now. Every dashed distance starts
  at the one now line, and a small ruler (+1w +2w +4w) hangs from it. All
  four upgrade parts travel the same 3 days to one window. The intents travel
  26, 32 and 40 days. "What lands first" is read as length, not by reading
  dates. The readout column says it in words for screen readers.
- **One water plane is cheaper and calmer than per-mark dimming.** The past
  is quieter through one absolutely positioned element (a navy gradient,
  deeper further back, and one `saturate(.7)` backdrop filter). No mark has
  its own "past" opacity. The rule is now physical: if it is under water, it
  is over. On 5,000 rows this costs the same as on 11.
- **Apps share a record and its edges.** The events-store move (a done intent
  in Mandate) *caused* the gap that crosses every row, including the
  upgrades. The gap band is drawn once for the whole board, the 0.12.0 bake
  has "no bake record", and Artifacts and Explorer show dashed inferred ticks.
  A cross-app view is where record continuity stops being a footnote.
- **Cross-app coincidences become visible.** The board shows that the
  Thursday window falls 3 days into the retention intent's last stretch. No
  single app would show that.
- **Missed and moved-early are different marks.** A deadline moved *after* it
  passed is a tide line (missed, stays for good). One moved *ahead* of time
  keeps a quieter hairline labelled "moved". Both stay; only one is a stain.

### What fails or risks
- **Light under water.** The overdue intent's overrun (green) and the needs-you
  bloom sit partly under the plane, which mutes exactly the thing that should
  call. The bloom survives because it lives on the name column, outside the
  plane. **Rule needed:** needs-you light is drawn above the water (on the name
  and readout columns, or above the plane's z-index), never inside it.
- **Seam vs. tide vs. scar at word size.** Three thin verticals with different
  dashes and colours. The key is essential, hover and Tab make each one answer,
  and in a bright room they will merge. The row is still readable because the
  big shapes (water, distance) carry the story.
- **The future is short on this axis.** Eight weeks ahead in about a third of
  the width. An intent due in March would clip. It needs either a range that
  grows to the latest deadline or a labelled scale break. That should not be a
  different curve for the future, or distances stop comparing.
- **Two apps, one sort order.** Intents sort by needs-you, then distance. Parts
  keep the Upgrade Centre's order. The list does not reshuffle after an edit
  (deliberate). A real "Ahead" view across six apps needs grouping rules,
  probably by app, as here.
- **The pier mixes scales.** Its vertical is error %, not time. It sits in the
  same panel as the staff gauge (time). They share the vocabulary (notch,
  high-water mark, forecast as a known tide) but not the axis. Say so in the
  label, as the panel does.
- **Permissions across apps.** The viewer sees intents (Mandate) and approves
  upgrades (Org admin). For a viewer with only one of those, the other section
  should stay visible as a shadow section that says who has access, not
  disappear. That is not drawn yet.

### Principles
- **Calm:** still at rest. Two blooms (overdue intent, approval before the
  window), within the cap of three.
- **Explain, never hide:** every mark is focusable and answers what, since
  when and who can change it. The shadow row says who to ask. The disabled
  Move button says what is missing. The record gap says it cannot be restored.
- **Focus stacking:** the selected row lifts and the panel reads it closer.
  There is no blur on this view.
- **Letterbox:** an approval missed before a window that blocks a security fix
  would escalate to the urgent path from the pier panel. That is not drawn
  here.

### Needs
- **Tokens (proposed):**
  - `--type-micro`, `--mark-now`, `--mark-tide`, `--mark-seam`,
    `--mark-scar`, `--mark-travel`, `--mark-stale-hatch`.
  - `--mark-tide-known` (a window ahead).
  - `--time-past-water-deep` / `-shallow` / `-surface` (the plane), which
    replaces `--time-past-dim` on any time-axis view.
  - Layout widths `--x-col-name`, `--x-col-read`, `--x-panel`.
  - Relies on `--font-mono`.
- **Kit parts:** `TimeScale` (shared with V3: one function, power from range),
  `NowLine` + `PastWater` drawn once by the board, `IntentLine`, `PartLine`,
  `StaffGauge`, `Pier`.
- **Data / events:**
  - `intent.deadline_moved` {old, new, by, **reason (required)**, agreed_by},
    with the rule's start date kept so older moves read as "no reason
    recorded".
  - Weekly effort per intent (an aggregate of existing events).
  - Updater: applied, halted, rolled back {servers reached}, missed window,
    bake peak per release.
  - **Preview bake peaks per release** (new upstream feed).
  - Window rule with an id.
  - Per-server heartbeat.
  - `record.gap` from the events service (same field as V3).
  - The viewer's actions per object (Extend, Approve).

### Questions for Harry
- **Should moving a deadline need the asker's agreement**, or only a reason?
  The prototype records "waiting for Lena Hart" and moves the date at once.
  That is a product rule.
- **Is "Ahead" a Home section or its own view?** It is a strong candidate for
  the shell's own screen (water language, one now line), with apps
  contributing rows through their manifests.

### Where I went beyond the ask
- I made the deadline reason a hard requirement with a migration rule for
  older moves (dashed seam).
- I split "missed" from "moved early".
- I tied the record gap to the intent that caused it.

### Score
Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

---

