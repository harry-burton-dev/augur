# Surface 5 · Facets for finding

Browse Data Atlas by combining facets instead of typing into a search box.
Every count says what a choice **would leave before you pick it**, and no
choice that leaves nothing is ever shown without saying why.

All six share one sample deployment (a regional services organisation:
sites, suppliers, contracts, people, vehicles, incidents; 162 things on the
Department floor, 7 kept on Team floors below, 3 waiting in Triage) and one
facet engine. The data is one `DATA` object at the top of each page;
`_src/gen_data.py` makes it, `_src/build.py` inlines `data.js`, `engine.js`
and `common.css` into each `v*.html`. Swap `DATA` and every label, count,
keeper and reason follows.

## The finding that runs under all six: five kinds of empty

Making every zero explain itself forced a taxonomy. An empty facet value is
always one (or more) of these, and each has its own mark, used the same way
in all six variants:

| Mark | Plain words | What it means | Who can change it |
|---|---|---|---|
| dashed outline, `search-x` | **none** ("checked 5 contracts") | Looked, and nothing is there. Says how many it checked and the nearest values that do have something. | Nobody: it's a true answer |
| ruled lines (`--x-proposed-na`) | **does not apply** ("people have no key date") | That kind of thing has no such detail in this deployment's ontology. | An admin, in the studio |
| 45° hatch (`--x-proposed-gap`) | **not recorded yet** | The kind expects this detail, the record lacks it. Any of them *could* be the value you picked. | The kind's keeper (from data: "Contracts team") |
| team amber, `lock` | **kept on a floor below** ("1 kept on Coast works crew, ask Dee Harper") | It matches, but lives on a floor you can't open. | The person named |
| info blue, `inbox` | **waiting in Triage** | A source proposed it; nobody has accepted it. | Whoever triages |

"Not recorded" uses the same hatch ink as wear and time's stale hatch, at the
other angle family. It is **not** the same mark as wear and time's "no record"
(a declared gap in time): that one says *no observation was made in this
period*; this one says *this record lacks this detail*. Same hatch family, so
an operator learns "hatched = something is missing here", but the label always
names which.

## V1: Five questions

*Idea.* Ranganathan's five facets (PMEST) as five columns of plain questions:
What kind, About, Status, Where, When. Each answer row carries a bar for what
it leaves now and a faint bar for what's kept in all; pointing at an answer
fills a side panel with "Would leave 7 of 23" or, for a zero, the full list of
reasons. Demo: contracts, roads, coast, then points at "This year": none,
checked 2 contracts; 1 kept on Coast works crew (ask Dee Harper); 1 waiting in
Triage.

*Sources.* Ranganathan's Colon Classification (PMEST) for the five axes;
OpenRefine's facet panels for counts-per-value with a "(blank)" row; Endeca /
library OPAC facet columns.

*What works.* The most legible: every question is visible at once, so an
operator sees what *kinds* of question can be asked before asking one.
Counts-before-picking is a plain number beside each word. The "Not recorded"
row at the foot of a column makes gaps first-class without a special mode.
PMEST letters sit quietly in the column heads; the technical names (rdf:type,
cco:located_in) appear only with `T`.

*What fails or risks.* Five columns is the ceiling: a deployment whose
ontology wants eight facets breaks the layout (needs a "more questions"
overflow). Within a column, picking two values widens (OR) while across
columns narrows (AND); the side panel says so, but it is the classic faceted
search confusion. Per-row "why" text only appears in the side panel, so
scanning many zeros means pointing at each.

*Principles.* Explain-never-hide: strong (every zero clickable to a reason,
n/a rows shown, locked counts shown). Calm: nothing moves unless you point.
Focus stacking: not used. Letterbox: not relevant.

*Needs.* Per-kind facet applicability and keeper; counts of out-of-reach
matches per floor; Triage counts by facet.

*New employee test.* **Pass.** Reads like a form with answers already
counted. The one stumble is the OR-within-a-column rule.

*Words.* kinds of thing / class (rdf:type) · about / matter (part of service) ·
status / energy (has status) · where / space (located in) · when / time (key
date, per kind) · not recorded / missing property value · does not apply /
property not in the class's domain.

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4.

## V2: Card drawers

*Idea.* A library card cabinet: one drawer per kind of thing, each front
showing how many cards it holds now (and a locked count for cards kept below).
Pull a drawer and **guide cards** divide it by a second facet you choose; the
tops of the cards behind each guide are readable. **Clips** hold back cards by
the other facets. Lift a guide and the front card shows as a catalogue card in
the fixed 5×3 shape, with a shelf mark in Ranganathan's colon notation
(`CON;WA:ACT.NOR'26`) and gaps hatched with who fills them. An empty guide
card stays in the drawer, with its reason written on it.

*Sources.* Library card catalogues (drawer labels, guide cards, the 3×5
card); Ranganathan's colon notation for the shelf mark; Dewey cabinet labels.

*What works.* The most memorable, and it keeps "kinds of thing" physically
separate: you can't ask an incident-shaped question of a person by accident.
Guide cards make the second facet feel like dividers, not filters, which
reads naturally. The card-in-hand doubles as a compact record card (surface 3).

*What fails or risks.* Three controls with three metaphors (drawer, guide,
clip) is a lot to learn; clips are native selects, so "what it would leave"
is buried inside option text. Cross-kind questions ("everything in the
Coast") are impossible by design. The shelf mark is lovely for admins and
noise for operators. Skeuomorphism risk over a full day.

*Principles.* Explain-never-hide: good (empty guides keep their place and
reason). Calm: drawer motion only on demand. Fits hierarchy-without-containers
poorly: it is all containers.

*Needs.* A kind-level "key date" and "keeper" per kind (both used here);
a short code per value for shelf marks (or drop them).

*New employee test.* **Mixed.** Drawers and the card read instantly; clips
and "guide cards by" need a first explanation.

*Words.* drawer / class · guide card / facet value grouping · clip / filter ·
card / entity record · shelf mark / colon notation (PMEST) · not recorded /
missing value.

*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 3.

## V3: A sentence of facets

*Idea.* The query is a sentence: "Show me **contracts** **about waste** **in
the North** in any state **that end this year**." Every blank is a facet;
unfilled blanks read in grey as "anywhere", "at any time". Opening a blank
lists each possible phrase with the count it would leave; phrases that leave
none show their reasons right under them. The key-date verb comes from the
kind ("end" for contracts, "happened" for incidents), and the blank turns into
a ruled "(people have no key date)" when it can't apply. Demo: the sentence
fills in four words, the count rolls 162 → 3, then the "where" blank opens:
North 3, the other four "none, checked 3 contracts", each with its nearest.

*Sources.* OpenRefine and Endeca facets for counts; library subject headings
and Isotype captions for the "say it as a sentence" reading; Ranganathan's
order of facets for the order of the clauses.

*What works.* The question is its own breadcrumb, its own caption and its
own shareable summary: an operator can read it aloud, paste it into a
message or an intent in Mandate. Nobody needs to know what a facet is.
"Empty a blank to get back: about +8, where +1" tells you which word cost
most. Strongest fit with plain words first.

*What fails or risks.* One value per blank (OR within a facet would need "or"
phrasing, which gets long fast). Sentence grammar is per language and per
kind: the verb per kind (`verb` in `DATA.kinds`) is new ontology metadata
someone must write. Popovers cover the results. Long sentences wrap at
1280 (still legible).

*Principles.* Explain-never-hide: strong and inline. Calm: one rolling count,
then still. Plain words first: the best of the six.

*Needs.* Per-kind date verb and plain plural; phrase templates per facet
(admin-editable); "nearest" values.

*New employee test.* **Pass, best of six.** Read right on day one without
explanation.

*Words.* show me … / query · about X / matter facet · in the X / space facet ·
that end this year / time facet on the kind's key date · none, checked N /
zero hits with denominator · has no key date / property not in domain.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5.

## V4: Live sliders

*Idea.* Shneiderman's dynamic queries: a starfield of every record (x = key
date, y = how complete it is), with sliders for key date, how complete and
how much it's used, each over a histogram of everything kept (faint) and what
the *other* sliders leave (lit). Pointing along a slider shows a **ghost
handle** with "Jun 2027 → leaves 49" before you drag. Records with no date
recorded sit in a hatched strip; kinds with no key date in a ruled strip;
narrowing the date sets them aside with a note that says how many and how to
bring them back.

*Sources.* Shneiderman's HomeFinder and FilmFinder (dynamic queries,
starfield); Spotfire; Bertin (position for the two quantities, lightness for
in/out).

*What works.* The only variant that handles continuous details (dates, scores)
and shows **distribution**, not just counts. Gap and n/a strips are the
honest-blank idea drawn as space on the chart: the undated are visibly there.
"How complete" makes data quality a facet operators can filter by ("show me
the ones with gaps") without saying "data quality".

*What fails or risks.* A scatter is not an operator's tool; most will not
read the axes. Dots overlap (100% complete clusters at the top). The
"how complete" and "how much it's used" scores are derived and need explaining.
Pointer-heavy; keyboard works but the ghost handle is hover-only.

*Principles.* Explain-never-hide: good for the undated, weaker for zeros (one
"nearest match" message). Calm: still at rest. Hierarchy without containers:
good.

*Needs.* Expected-detail lists per kind (for completeness); Mandate and
Artifacts link counts per entity; a numeric/date type on details.

*New employee test.* **Fail on the chart, pass on the sliders.** The sliders
and their counts read; the field needs a minute.

*Words.* key date / per-kind time property · how complete / share of expected
properties present · how much it's used / bindings + source documents ·
no date yet / missing value · no key date / not in domain.

*Score.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 4.

## V5: Facet map

*Idea.* Cross any two facets (rows × columns, swap with `X`) into a grid of
squares sized by count (Bertin's size variable), with margins showing what
each answer alone would leave. Every empty square is drawn as one of the five
kinds of empty, so the map's gaps predict things, as Mendeleev's did: a
locked square says "1 below", an inbox square "1 waiting", a ruled row says
people can't have a key date. Demo: kinds × when, only Coast; the map lights
"Contracts × This year: 1 below" and the side panel explains.

*Sources.* Mendeleev's table (layout predicts the gaps); Bertin's size
variable; contingency tables; Tufte's small multiples (for the margins).

*What works.* The clearest picture of **why** a combination is empty, across
the whole space at once; it's also the closest to "the shape of what we keep"
(surface 2), so it could be the same component. The key reads in seconds.
Clicking a heading pins it as a filter and brings the next facet in as an
axis, so it can walk through all five.

*What fails or risks.* Two facets at a time; the third and later are hidden in
selects. Squares-by-area undercount small numbers. 30+ cells of reasons is
dense; the empty kinds rely on colour plus a word, but the words are tiny.
Leaks the most about floors below (a locked count per cell).

*Principles.* Explain-never-hide: the strongest drawing of it. Calm: static
grid. Focus stacking: picked cell glows, the rest step back.

*Needs.* Facet applicability per kind (for whole n/a rows); counts of
locked matches per floor *per combination* (a permission question; see below).

*New employee test.* **Mostly pass.** A table of numbers is familiar; the
five empties need the key once.

*Words.* square / facet intersection count · none / zero · n/a / outside the
class's domain · not recorded / null · below / out-of-reach on a lower floor ·
waiting / pending in Triage.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4.

## V6: A trail you can rewind

*Idea.* Each choice is a step on a trail drawn as a band whose width is the
count (162 → 46 → 11 → 4 → 3), Sankey-style. Point at any step to **rewind**
to it or **drop just that step** ("drop: +7"); rewinding keeps the undone
steps as a dashed branch you can redo, until you choose differently. Under the
trail, "Choose next" lists every facet's remaining answers with counts, and
every zero carries a short tag ("none", "1 below", "n/a") that opens its
reasons. Demo: four choices, then rewind to "North" with "This year" waiting as
a branch, and "Under review: none, checked 4 contracts" open.

*Sources.* Undo trees (Emacs undo-tree, Photoshop history); Sankey's width as
quantity; breadcrumbs; OpenRefine's facet removal.

*What works.* Makes the **order** of narrowing visible, and which step cost
most, which the other five hide. Rewind without losing work removes the fear
of trying a facet. Zero tags inline with the chips mean no dead end is ever
silent.

*What fails or risks.* Order matters here but not in the result (AND is
commutative), which may mislead: the band says "Waste took 35" only because
it came second. Steps are one value each. The trail eats a fixed band of
height. Branch idea is subtle; most people will only rewind.

*Principles.* Explain-never-hide: strong. Calm: still unless you choose.
History as a material: yes, the search keeps its own history.

*Needs.* Nothing beyond V1; a session store for the trail if it should
survive a reload.

*New employee test.* **Pass.** Breadcrumbs plus big numbers; branch is a
bonus they can ignore.

*Words.* step / filter clause · rewind / undo to · drop / remove one clause ·
branch / redo stack · choose next / remaining facet values.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4.

## Ranked

1. **V3 A sentence of facets** (18): reads right on day one; the question is
   its own summary.
2. **V1 Five questions** (17): every question visible, cheapest to build.
3. **V5 Facet map** (16): the best picture of why things are empty.
4. **V6 A trail you can rewind** (16): the best history and undo.
5. **V2 Card drawers** (14): most memorable, too many metaphors.
6. **V4 Live sliders** (14): the right tool for dates and scores, the wrong
   front door.

## What I'd build first

The sentence (V3) as the head of the Find page, with V1's five columns as its
"show me every answer" view under it: both are the same state, so clicking a
column answer fills the matching blank and the sentence rewrites itself. Ship
the **five kinds of empty** as one kit part (mark + reason line) from day one,
because every other surface in this run needs it too (record card gaps, shape
counts, structure changes). V6's rewind belongs to the sentence as plain undo
(`⌫`) and "empty a blank to get back +N"; V5 is better spent as the
"shape of what we keep" grid than as a finder. V4's date slider is worth
keeping as the control inside the "When" blank once dates need ranges.

## Pushback and open questions

- **Counting what's below can leak.** Atlas says out-of-reach things say
  where they're kept and who to ask. A count per facet combination ("1
  incident in the Coast this year, kept on Coast care team") tells someone a
  fact about a record they may not read. Needs a decision: exact counts,
  "some" without a number, or only at the whole-kind level. V5 leaks most,
  V3/V6 least.
- **OR within a facet** confuses everyone; V3 and V6 avoid it with one value
  per facet. Recommend single-value facets by default, "or" as an explicit
  second step.
- **Order of narrowing** (V6) is a display artifact: say so, or sort steps by
  how much they cut.

## Needs (all variants)

Tokens, all combinations of kit tokens:

- `--x-proposed-gap`: 45° hatch for "not recorded", same ink as
  wear and time's stale hatch.
- `--x-proposed-na`: vertical ruling for "does not apply".
- `--x-proposed-bar` / `--x-proposed-bar-ghost`: count bar now / count kept in all.
- `--x-proposed-floor`, `--x-proposed-floor-soft`: the page's floor accent (Department).
- `--x-proposed-type-micro`: 0.6875rem for mono numerals in data (also wanted by
  wear and time).
- V2: `--x-proposed-card`, `--x-proposed-card-edge`, `--x-proposed-card-ratio` (5×3 card stock).
- V6: `--x-proposed-trail-h`.
- Relies on `--font-mono` (IBM Plex Mono, still needs an ADR) for counts.

Data Atlas doesn't give these today:

- **Facet definitions** in the ontology: which details are facets, their
  plain question ("Where is it?"), their order, and value labels.
- **Applicability per kind** (which kinds can have a key date) and **which
  detail is each kind's key date**, with a plain verb ("end", "happened").
- **Expected details per kind** (to tell a gap from n/a and to compute
  "how complete").
- **A keeper per kind** (who fills gaps).
- **Counts by facet** for visible entities, for out-of-reach entities per
  floor (see pushback), and for Triage proposals.
- **Link counts** from Mandate and Artifacts per entity (V4's "how much it's
  used").
