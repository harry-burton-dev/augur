# Artifacts reader: critique

One document (a Finance department policy, 7 sections, 18 versions, 2
repairs, 1 stale section, 1 review due soon) is read six ways. Every name,
count and date comes from the `DATA` object at the top of each page. The
marks and their names come from `../grammar/v1-time-language.html`. Each
page shows its moment about 1.2 s after load; R replays it.

## V1: Scrollbar wear (`v1-scrollbar-wear.html`)
*Idea.* The scroll bar becomes the record. A wide rail maps the whole
document. Edit wear grows left of the spine, split by the editor's floor
colour; read wear grows right. Seams show as gold ticks, the stale section
as hatch, and "new since you read" as a bracket. Clicking the rail
navigates; `[` and `]` jump between worn passages. Hovering a mark answers
"edited 3 times, last 9 days ago by Sana Kader; read by 6 of 38 since".

*Sources.* Hill and Hollan, edit wear and read wear (1992). Code editors'
minimap and overview ruler.

*What works.* Navigation and history live in one control, as Hill and
Hollan intended. A glance shows where the document is contested (the
Approvals edit war is a wide multicoloured band) and where people actually
read (Daily allowances). The page itself stays nearly untouched: just a faint
wear line in the left margin. It is calm.

*What fails or risks.* Replacing the native scroll bar is costly for
accessibility. It needs `role="scrollbar"` semantics, keyboard support and
care with OS scroll settings. Floor colour bands by author floor, not by
person: that is a privacy choice, but it loses Hill and Hollan's "who". At
2–3 paragraphs per section the rail is chunky; long documents read better.
Read wear here exposes what colleagues read (see V6 for the rule).

*Principles.* Calm: yes, nothing moves at rest; "new since you read" flickers once. Explain, never hide: the rail foot says read wear starts in Jun 2025 (an unconformity). Focus stacking and letterbox: not used.

*Needs.* Tokens `--mark-wear`, `--mark-wear-read`, `--mark-seam`. Data:
section anchors on update events, aggregated read events per section, your
own last-read time.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V2: Margin ledger (`v2-margin-ledger.html`)
*Idea.* Each paragraph keeps its own ledger. The left margin holds a stack
of strata, one deposit per change, newest on top, coloured by floor and
fading with age, with the age in words. The right margin carries a worn
edge (how much it is read) and a dog-ear on passages people come back to.
Hovering a paragraph answers "written when, by whom, changed how often".
Hovering a repaired value (€54) answers **"why is this €54, and since
when?"** with the value's own strata: €42 for 1.6 years, €48 for 9 months,
€45 for 4 weeks (an error), €54 now.

*Sources.* Dog-eared and thumb-worn books, marginalia, geology (strata),
Hill and Hollan.

*What works.* The value-level card is the clearest form of "ask any value
why and since when" in this run. It answers in place, in one picture, and
names the error as an error. Ages in the margin let you skim freshness
without opening anything.

*What fails or risks.* Two margins of marks on every paragraph is busy over
a whole working day, even when quiet. The ledger should probably appear only
on hover, or only for paragraphs changed in the last 90 days. The value
history needs value-level diffs that Artifacts does not keep; this
prototype fakes them with a word diff. Dog-ears need "opened at this
paragraph" events (deep links, returns), which add to the privacy question.

*Principles.* Calm: mostly (static marks, no motion at rest). Explain, never hide: the strongest of the six for single values; the card says "history before May 2024 was not kept". Conflict: the value card could be the History direction of the cinematic radial menu rather than a hover; on touch-less desktop the hover is fine, but it should also be reachable from the radial menu.

*Needs.* Tokens as V1, plus `--time-past-dim`. Data: paragraph-level change
attribution, value diffs, return counts.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V3: Seams (`v3-seams.html`)
*Idea.* A repair is not an ordinary edit. When something was wrong and is
put right, the fixed words keep a fine gold double line, and the margin
says "repair · 9 days". Ordinary edits leave no mark. Opening a seam
brings in a parallel page on the right: the section as it stood before the
repair. Ribbons join the paragraphs that stayed the same, and a gold seam
runs from €54 to the struck €45. The repair card says who, when, why, how
long the wrong text stood, and how many have read it since. Undo is visible
but unavailable to you, with the reason ("only Priya Raman, policy owner").

*Sources.* Kintsugi; conservators' "visible and reversible" rule; Ted
Nelson and Xanadu (parallel documents, visible links between what stayed
the same).

*What works.* It is the most trustworthy idea here and the cheapest. It
needs one flag on an update (`kind = correction`) and a reason. It answers
the costly question in policy work: "was the old figure a rule that changed,
or a mistake?" It is calm (two documents of two repairs in hundreds of
edits), and the Xanadu view only appears when asked for.

*What fails or risks.* People must mark repairs honestly. A real rule change
filed as a "correction" hides a decision, so the repair reason should be
required and visible to all. Ribbons across the gap are lovely but fragile on
reflow and scroll; they need a robust layout (anchor ids and
ResizeObserver). The seam gold is close to the Team floor amber.

*Principles.* Explain, never hide: Undo shown as unavailable, with who can do it. Calm: nothing moves unless opened. Consistent with the cinematic radial menu: "Open seam" and "Undo repair" are natural verbs for it, with a consequence preview.

*Needs.* Token `--mark-seam` (its own hue, with a contrast check against
`--floor-team-high`). Data: `update.kind = correction`, `reason`, and the
before text (Artifacts versions already have it).

*Score.* Clarity 5 · Distinctiveness 5 · Feasibility 4 · Fit 5

## V4: Section almanac (`v4-section-almanac.html`)
*Idea.* Every section heading carries a word-sized tide table on the
shared time scale. It shows past changes as ticks, the last review, one now
line, and the next review as distance to travel. A missed review becomes a
tide line with stale hatch running from it to now. A stale section is
hatched and says how old it is, what is wrong ("still names the paper claim
form, retired in June"), and who can refresh it, with an "Ask Jonas Meyer"
button. The aside is the almanac: every section on the same scale,
overdue and due-soon on top.

*Sources.* Tide tables and almanacs, Open MCT stale-data marking and now
line, Tufte sparklines.

*What works.* "Stale is a state, not a mystery" made literal, and cheap. Freshness is a date comparison against a review interval, so the hatch is CSS only and fine in a library of 5,000. The shared scale makes sections comparable at a glance. It is the variant that most helps a reader decide whether to trust what they are reading.

*What fails or risks.* A strip on every heading repeats the almanac, so one
of the two could go. Review intervals have to exist per library, which is a
governance decision, not a UI one. If every section is overdue, the whole
document is hatched and the hatch stops meaning anything. That calls for a
document-level state ("this policy is out of date") rather than hatch everywhere.

*Principles.* Explain, never hide: the strongest on staleness (age, reason, who). Calm: yes. Light language: when you are the refresher, the stale card should bloom; that is not shown, because "you" are not.

*Needs.* Tokens `--mark-tide`, `--mark-now`, `--mark-stale-hatch`. Data:
`review.due` per section (or library default), `due.changed`, a refresher role per library, and a stale reason.

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V5: History flow (`v5-history-flow.html`)
*Idea.* The whole history as one picture. In the aside, every section is a
band flowing across 18 versions, coloured by the floor of its editor. The
Approvals edit war shows as alternating stripes; repairs as gold. A wavy
line at the left says nothing was kept before May 2024. A scrubber (or ←
and →) replays the page in place. The reader dims slightly (the past is
quieter), a sticky bar says "viewing version 10 as it stood on 1 May 2026",
and changed paragraphs are marked. **Y** jumps to "since my last visit"
(the green dashed line).

*Sources.* Viégas and Wattenberg, History Flow (2004); Bret Victor, "Up and
Down the Ladder of Abstraction" (scrub in place, then step up to all times).

*What works.* It is the only variant where the whole history is legible as
a shape: one long stable history, one contested section, a burst of change
in the last two months. Scrubbing in place, rather than opening a version
list, is the right model, and "since my last visit" leads straight into the
round-2 "returning after two weeks" screen.

*What fails or risks.* It is the heaviest to build. Section-level history
per version must be computed and cached. It is also the hardest to read
cold, because band thickness by text length is not obvious. As a reader
default it is too much; it belongs to an explicit "History" mode or to
Explorer. Floor colours for authors only work while there are about three
floors involved.

*Principles.* Focus stacking: the past state uses a desaturate and dim on the reader, a cousin of the cinematic far plane (no blur, so text stays readable). Calm: the flow is static unless scrubbed. Explain, never hide: the unconformity is drawn and labelled.

*Needs.* Tokens `--time-past-dim`; a kit `TimeScrubber`. Data: section-level
text per version (derivable from Artifacts versions), your last-read time.

*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V6: Read since it changed (`v6-read-since-changed.html`)
*Idea.* Each section heading carries a waterline: how many of the audience
have read it since it last changed, split by audience group. The panel
follows the section you are reading. It shows a big count, the groups, and
a tide chart: readers since the change climbing back towards the old
version's **high-water mark** (31), with the gap labelled "25 still to read
it". A change you have not read blooms (light language, because it needs
you), then dims when your reading counts. Owners can "Tell the 25 who read
the old version"; for you that action is visible, unavailable, and says
who can.

*Sources.* High-water marks on bridges, tide charts, k-anonymity (minimum
group sizes in statistical publishing).

*What works.* It turns "did people see the correction?" into a picture
with a goal that does not shame anyone: the old high water. Counts only, no
names, and the owner sees the same numbers as everyone. The bloom is the
one place in this run where time borrows light, and it is correct to.

*What fails or risks.* **Privacy is the whole design.** My first build
showed "fewer than 5" for a small group next to an exact total, so the small
group's number could be worked out by subtraction. The page now shows a
breakdown only when every group has at least the minimum
(`DATA.privacy.minGroup`). Otherwise it shows only the total and explains
why. Even counts can identify people in tiny audiences, so the total itself
probably needs the same floor. Read events per section are new, sensitive
data. This is a question for Harry, not a decision.

*Principles.* Explain, never hide: the hidden breakdown says why it is hidden. Calm: bloom only on "needs you", and it stops on read. Consistent with the cinematic light language (bloom then dim).

*Needs.* Data: aggregated `section.read` (with dwell), audience groups per
document, a privacy floor in config, and a notify action for owners.
Proposed rule for Harry: **counts only; a split by group only when every
group has at least *k* readers; no names unless a person opts in to share
their reading; *k* set per deployment**.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## Ranked
1. **V3 Seams**: most trust for the least data; distinct; calm.
2. **V4 Section almanac**: stale as a state, cheap enough for every library.
3. **V6 Read since it changed**: high value, but blocked on Harry's privacy rule.
4. **V1 Scrollbar wear**: the best navigator for long documents.
5. **V2 Margin ledger**: keep its value-level "since when?" card, drop the always-on margins.
6. **V5 History flow**: right for an explicit History mode or Explorer, not the default reader.

## What I'd build first
Build the seam from V3 and the stale state from V4 together in the default
reader. Each needs only one new field: `kind = correction` with a reason on
updates, and a review interval with a refresher per library. Both are CSS on
the page, and between them they answer the two questions readers of a
policy ask: "is this figure a mistake or a rule?" and "can I trust this
section?". Next, the V2 value card behind the radial menu's History
direction, so "why is this €54, since when?" works on any repaired value.
Then V6's read-since counts once Harry has decided the privacy rule. That
order also sets up round 2's "returning after two weeks". Seams and the
"since you read" bracket from V1 are what the shell should light, once, on
each object you return to.
