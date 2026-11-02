# Combined V2: Reader with history (`v2-reader-with-history.html`)

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
