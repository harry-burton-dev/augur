# Combined V2: An operator's first day (`v2-operators-first-day.html`)

One continuous walk for a new operator, Sam Okafor, on the Facilities floor
(a Department) of Vale Regional Services. There are five stops, listed on the
left as a route with a lit "you are here" dot, and a breadcrumb at the top
that reads the path as a sentence:

> Data Atlas: what we keep › Contracts › **about grounds maintenance, at
> Halden Road depot, ending this year** › Grounds maintenance · Halden ›
> is with Meadow Grounds Ltd

1. **What we keep** (shape V4, with shape V2's floors-as-rows idea). The
   front page is a contents page. Part One is the Org floor (kept once, for
   everyone), Part Two is Facilities (kept here). Entries are kinds of thing:
   leader dots to the count, a one-line description, who looks after them,
   how much is known, how many wait in Triage, details run in with thin
   ones in italics with the not-known-yet mark, and "See:" lines for links.
   The third column lists **other volumes** (Invoices on Finance, Inspections
   on Depot operations: locked, "some records", whom to ask), **not yet
   written** (predicted kinds as dashed placeholders: Routes or areas, asked
   for 3 times; Permits, in the ontology but kept by nobody), **waiting**
   (3 things in Triage that nobody could place; Jo Reyes decides) and the
   key of six ways to be empty. The demo lights Contracts as the next step.
2. **Open a kind.** Contracts: the kind card on the left (what a contract is,
   132 kept here, every detail it should say with how many are known,
   not-known-yet counts with who could fill them, links as sentences, "some
   more on Depot operations", 2 in Triage). On the right is the table of all
   132, with **the sentence of facets as its header**, the default V1
   recommends.
3. **Find one.** The sentence fills in by itself: each blank opens to show
   what every word would leave (Grounds maintenance 14 → Halden Road depot
   2 → this year 1). Zero values say "none: checked 14 contracts", the
   unknown value is offered as a choice with the gap mark, the disputed date
   is counted under both readings and says so, and every list ends with
   "and some on Depot operations, a floor you can't open · ask Marta
   Kowal". All counts are computed from 132 generated contracts.
4. **Read it.** Grounds maintenance · Halden as plain statements (card V2):
   a gap (renewal decision: Tomasz Wilk could fill it), the disagreement as
   a forked sentence across the full width (31 Dec 2026 or 30 Jun 2027,
   neither accepted, Facilities leads decide), out of date (insurance seen
   3 Jan 2024, hatch on the age), none (penalty clauses: Procurement
   checked), not yours to see (supplier risk: restricted, ask the Commercial
   risk office) and no record (change history, Mar to Jun 2024, lost when
   the register moved). The side holds "What we don't know", where it came
   from and the key. The link to the supplier is lit as the next step.
5. **Follow a link.** Meadow Grounds Ltd, with "You came from Grounds
   maintenance · Halden". It adds the sixth state in context: "Ends: doesn't
   apply. Suppliers don't end; their contracts do."

Keys: → or Enter next, ← back, 1 to 5 jump, P plays the whole walk, T
technical words, R replays. `#1` to `#5` in the URL open a stop (for
screenshots). No console errors at 1600 × 900 or 1280 × 800.

---

**V2: An operator's first day**

*Idea.* The catalogue run's winners joined as one route through Data Atlas:
contents page, kind, sentence of facets over a table, statements, a link.
The breadcrumb is the sentence the operator has built, so the path explains
itself and could be pasted into a message or a Mandate intent.

*Sources.* Shape V4 (encyclopaedia contents page, back-of-book "see"), shape
V2 (Mendeleev's predicted gaps, as dashed "not yet written" entries), facets
V3 (OpenRefine counts, query as a sentence), card V2 (Wikidata statements,
cloze blanks), grammar V6 (two registers), placing (Triage's "waiting,
named person decides"), the light language (lit next step, "you are here").

*What works.* Each stop answers one question, in order: what do we keep,
what is a contract, which one, what do we know about it, what is it linked
to. The shape is seen before any record (the brief's direction). The sentence
on top of the table makes finding and comparing one thing, which V1 found to
be the right default. The empty states appear where an operator meets them,
not on a legend page: "thin" details on the contents page, "not known yet"
as a facet value, "some" for hidden counts, and "doesn't apply" on the second
record. Locked volumes and predicted kinds stay visible and say why.

*What fails or risks.* The walk is scripted: one happy path with a single
result. A real find often ends with 9 rows, not 1. The contents page is
dense at 1280 × 800 and scrolls. Three columns of text may read as
documentation to people expecting an app (shape V4's risk, still true).
Statements in two columns break the reading order on a long record. "Some"
for hidden counts is the safe default but can mislead ("some" may be 1 or
400); it needs Harry's decision. Detail bars use the corner-tick gap on a
thin bar, which is only just legible.

*Principles.* Explain, never hide: strongest of the run's combined screens
(locked volumes, predicted kinds, "none: checked 14", hidden "some", Triage
with its decider). Calm: the find plays once on arrival at stop 3; at rest
nothing moves; the lit next step is the only light. Focus: the lit next step
and the walk's "you are here", no blur. Letterbox: not used, rightly.

*Needs.* The same `--x-proposed-*` tokens as V1 (gap, stale, unseen,
disagree, quiet, here, type-micro, lit). Kit parts: a `ContentsEntry`
(leader, count, run-in details, See line), the `FacetSentence` over a table,
`Statement`, `Blank`, and a `Walk` rail (that may stay a teaching page only).
Relies on `--font-mono` (needs an ADR).

*New employee test.* **Pass.** Every stop reads in plain words; the only
words that need a beat are "Triage" and "volume", and both carry a sentence.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5.

## What Data Atlas would need to serve it

1. **Counts per kind per floor**, and a rule for kinds on floors you can't
   open (this screen says "some", the safe default; exact counts are a
   decision for Harry).
2. **A plain plural, a one-line description and a keeper per kind**
   (`skos:prefLabel`, `rdfs:comment` rewritten for operators, plus who
   looks after them).
3. **Known share per detail per kind** ("Notice to end 61% known") and the
   count of records lacking it, which needs "should have" per detail.
4. **Link verbs in both directions** ("is with" / "holds") for "See:" lines
   and the "you came from" line; Atlas asks for the inverse when a pack term
   is adopted, so this is close.
5. **Predicted kinds**: profile classes not adopted, and words sources asked
   for, with ask counts, grouped by kind (`/ontology/candidates` lists them
   most-asked first today).
6. **An "unplaced" Triage state with a named decider**, and a count.
7. **Facet counts over a kind** for the current selection, including the
   not-known-yet value, disputed values under both readings, and "some"
   from floors you can't open.
8. **Everything V1 lists for statements**: `say` templates, stated
   absence, review age, declared history gaps, per-detail 403 reasons and
   whom to ask.

## Open questions for Harry

- For records on floors you can't open, may a count ever be exact ("3 on
  Depot operations"), or is it always "some"? The screen uses "some".
- Should the contents page be Data Atlas's front page for everyone, or only
  until someone has opened a kind (then land on their last kind)?
