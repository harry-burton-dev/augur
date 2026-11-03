# Combined V1: Three ways to read (`v1-three-ways-to-read.html`)

The required comparison. The same five things, of three kinds, are shown as a
**table**, as **cards** (statements, from card V2) and as a **facet browser**
(a sentence of facets, from facets V3). Keys 1, 2 and 3 switch views, and A, B
and C pick one of three operator tasks. Each task plays as a path of numbered
rings on the view (the eye's path, drawn with the light language's lit
navigation path), with a step counter under the stage. A scoreboard and a
verdict sit beside it.

**The five** (from one shared sample, Vale Regional Services, Facilities
floor): Halden Road depot (site), Greenbin Recycling Ltd and Meadow Grounds Ltd
(suppliers), Kerbside collection · North lot and Grounds maintenance · Halden
(contracts). Between them they show all six ways to be empty, and one
disagreement: the Grounds contract's end date, 31 Dec 2026 (signed copy) or
30 Jun 2027 (the contract manager says an extension was agreed).

**The tasks:** A "Which contract ends soonest?" (comparing), B "What don't we
know about Halden Road depot?" (one thing), C "Which supplier has an open
incident?" (finding by a combination).

Built from `_src/a/` (`data.js`, `common.css`, `common.js`, `v1.src.html`; run
`python3 _src/a/build.py`). `_src/a/check.js` plays all nine paths at a window
size and reports any look that lands out of view, plus console errors. It is
clean at 1600 × 900 and 1280 × 800.

## How the counting stays honest

- A path lists only **looks** (reading a cell, a sentence or a list) and
  **clicks**. **Scrolls are never written into a path.** On load, and on
  resize, the page walks every path silently and adds a scroll wherever the
  next target is out of view *at this window size*. So the scoreboard says
  "Steps at 1600 × 900", and at 1280 × 800 the numbers change: the table
  needs a scroll for A, and cards need one for C. Nothing is rigged by
  layout.
- Every view is built at its best: the table has a summarised "Linked to"
  column and a "What we don't know" column, and the cards put their summary
  at the head. The first render had the cards' summary at the foot, under
  the fold. The check caught it, and it moved to the head: a real design
  finding, not a tweak for the count.
- Steps are counted, not timed. A look at a sentence costs more than a look
  at a cell, and a click more than a look. The page says so beside the
  numbers.

## Results at 1600 × 900 (1280 × 800 in brackets)

| Task | Table | Cards | Facets |
|---|---|---|---|
| A ends soonest | **3** (4, with a scroll) | 4 (4) | 6 (6) |
| B what we don't know about Halden | 4 (4) | **2** (2) | 5 (5) |
| C supplier with an open incident | **3** (3) | **3** (4, with a scroll) | 6 (6) |
| At scale (worked out, S) | A 3 · B 6 · C ~62 | A ~140 · B 12 · C ~70 | A 13 · B 8 · C 6 |

## Verdict (as the page states it)

- **About one thing: cards win.** Everything about Halden Road is in one
  place, and each blank says who could fill it. The table can count the gaps
  in a cell but not name them, or say who could fill them, without a click.
- **Comparing: the table, while it fits.** The dates sit in one column and
  the disagreement fits in the cell (two dates, two warning edges). Cards
  make you hold one date in mind. On a short screen the table needs a scroll
  too, and they tie.
- **Finding: a tie at five, facets at scale.** At five things facets are the
  *slowest* (6 steps). They are the only view whose cost doesn't grow with
  the number of records: at 58 suppliers the table needs about 60 looks.
- **Mixed kinds hurt the table.** 3 of 5 Ends cells say "doesn't apply", and
  details only one kind has (opening hours, notice to end) can't be columns.
- **Recommended default:** open a kind as a **table with the sentence of
  facets as its header** (finding narrows the table you are reading). Open
  one thing as **statements**. Don't ship facets as a third, separate view.
  V2 builds exactly that.

---

**V1: Three ways to read**

*Idea.* One honest experiment: the same five things, three readings, three
tasks, and every step counted on the page by a path of numbered rings. The
scoreboard is computed from those paths at the current window size, and the
verdict names the winner per kind of question, not overall.

*Sources.* Card V2 (Wikidata statements, cloze blanks), facets V3 (OpenRefine
counts, a query as a sentence), grammar V6 (two registers, `T`), the light
language's lit navigation path for the eye's rings, GOMS / keystroke-level
modelling (count the operator's actions before you time them), Tufte's "show
the comparison".

*What works.* It turns "which view is best?" into "best for which question?",
which is the real answer. The auto-added scrolls make the count resistant to
layout tricks, and the check script proves it. The six empty marks work at
three sizes: inline in a sentence, as a row in the card summary, and as a
16 px glyph in a table cell. The disagreement survives all three views (two
dates in a cell, a fork in a sentence, "1 of them with a disputed date" in a
facet count). `T` puts the technical names one step down in every view
(column property, class, facet property, per-statement property).

*What fails or risks.* Five things is a toy: it flatters the table and cards
and makes facets look slow. The "at scale" numbers say so but are worked out,
not measured. Equal weight for a look and a click is wrong; only a timed test
with operators can weigh them. The mixed-kind table needs a hand-chosen
column set (`DATA.table.cols`), which no real Atlas list would have.
Popovers in the facet view cover part of the results. The side column
scrolls at 1280 × 800 (the verdict is below the fold there).

*Principles.* Explain, never hide: every empty state is drawn and says why,
in all three views; "not yours to see" names whom to ask. Calm: the path
plays once on load and on request; at rest nothing moves. Focus: the rings
light the eye's path; earlier rings fade back, no scrim. Letterbox: not
relevant.

*Needs.* Tokens (all mixes of kit tokens, as `--x-proposed-*`): `gap-ink`,
`gap-tick`, `gap` (the corner recipe, declared on `.mk-gap` too so a smaller
tick resolves locally), `hatch`, `stale`, `unseen`, `disagree`,
`disagree-wash`, `quiet`, `here`, `type-micro`, `lit`, `lit-wash`, `side-w`.
Layout breakpoints at 1400 px wide and 820 px high, and the wavy break's
`stroke-dasharray: 2 2`, are raw. Relies on `--font-mono` (IBM Plex Mono,
needs an ADR). Kit parts: `Blank` (six kinds), `Statement`, `Term` (two
registers), `FacetSentence`.

*New employee test.* **Pass.** Each view reads on its own; the step rings
and counts need no teaching. "At scale" needs its note.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4.

## What Data Atlas would need to serve it

1. **Expected details per kind** ("should have", a minCount flag in the
   profile). Without it a card can't draw "not known yet", and the table
   can't count it.
2. **Stated absence** ("None", who checked and when) as a fact value,
   distinct from no fact. Today a missing value and a checked "none" look
   the same.
3. **"Doesn't apply"** from the ontology: which details are outside a kind's
   domain, so a mixed list and a facet can say so instead of showing blank.
4. **Review age per detail** (how old is too old) to draw "out of date".
5. **Declared gaps in a record's history** (`record.gap`, from wear and time)
   to draw "no record".
6. **The 403 reason with whom to ask** per detail, not only per entity
   (Atlas says where an entity is kept; here single details are restricted).
7. **Who could fill a gap**: a keeper per kind, plus a person from links
   (site manager, contract manager) where one exists.
8. **A sentence template (`say`) per detail**, for statements.
9. **Facet definitions**: which details are facets, their question and
   phrase ("ending this year"), and counts per value for the current
   selection, **including disputed values counted under each reading** and
   the "not known yet" value.
10. **Link summaries for lists** ("1 incident, open"): counts of linked
    things by a detail of the far end. Atlas has links, not summaries.
11. **A per-kind table default**: which details are columns for a list of
    one kind. This is the recommended default view, and Atlas has no list
    shape today.

## Open questions for Harry

- Can a default **list of one kind** (a table with the sentence on top)
  replace a cross-kind browse in Data Atlas? Cross-kind lists are where the
  table breaks.
- How heavy should a click count against a look? It decides the C verdict
  at scale.
