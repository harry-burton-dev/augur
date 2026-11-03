# Surface 6: When the structure changes

An admin, in the studio, adds a detail to a kind, adds a kind, splits one or
renames one. How do operators find out (on the records, not in a changelog),
what happens to records that don't have the new detail yet, and what does the
admin see before committing?

All six share one sample (`_src/data.js`, inlined at the top of each page as
`DATA`): a regional services org, Northfold, with sites, suppliers, contracts,
people, vehicles, jobs and incidents, and four changes, newest first:

1. **Add a detail**: Sites gain "Fire-safety check due" (3 Nov). 142 sites:
   1 filled, 38 readable from fire risk assessments in Artifacts, 88 a keeper
   can fill, 15 nobody can fill yet (no manager on record).
2. **Add a kind**: "Depot", inside Sites (28 Oct). 9 match, 2 to confirm.
3. **Split**: Vehicles into Owned and Hired by the detail "How held" (14 Oct).
   61 / 31, 4 can't tell.
4. **Rename**: Job to Work order (30 Sep). 3,120 records.

Built from `_src/*.src.html` by `python3 _src/build.py` (inlines the shared
CSS, data and helpers). `_src/shoot.sh v1-notice-slip` renders both sizes;
`_src/act.js` renders after key presses.

## One decision across all six: three marks, not one

| Mark | Means | Drawn as |
|---|---|---|
| **Nothing expected** | this kind doesn't keep this detail | a quiet dot, no edge (V2) |
| **Gap** | expected, not filled yet, and **who can fill it** | dashed edge, faint fill, a person or source named |
| **No record** (wear and time) | nobody can know; the record itself has a hole | hatch |

The gap is **not** wear and time's "no record". A gap is a held place with a
named filler; it can close. "No record" is a declared absence that can't. A
gap with nobody to fill it ("nobody yet") gets the warning edge and names who
has been asked to find someone, so it is still never blank.

---

## V1: Notice slip (`v1-notice-slip.html`)

*Idea.* A library reclassification slip, tucked into the record beside the row
it changed: "Sites now keep one more detail: Fire-safety check due". It says
why, who can fill this site's gap, who asked for it (the Mandate intent), who
changed it and what was lost (nothing). "Got it" folds the slip to a small
paper tab on the card's edge, for that person only; the gap stays. A shelf of
the sites you look at shows a paper corner on each unread one.

*Sources.* Library reclassification and "this item has moved" slips; catalogue
cards; errata slips tipped into books.

*What works.* Reads right on day one: it is a note on the thing, in plain
words, with one action. It answers all four questions (what, why, who fills,
what I lost) in one glance. The gap row under it is the same mark everywhere
else. The corner on the shelf is a calm "unread" with no badge or count.

*What fails or risks.* The paper slip is the one light surface in a dark shell:
striking once, glaring if four slips stack after a busy week (needs a rule:
one slip per record, newest on top, "and 2 earlier changes"). Read state is
per person, which Data Atlas doesn't store. The tilt is decoration; drop it
if it looks playful.

*Principles.* Explain, never hide: yes. Calm: the slip only appears for
changes since your last visit, and folds away. Letterbox: not used, rightly.
Focus stacking: not used; could rack-focus the card behind the slip.

*Needs.* `--x-paper` / `--x-paper-ink` (a slip surface); per-viewer read state
for structure changes; "last visit" per person; the change's reason and its
Mandate intent stored on the change.

*New employee test.* **Pass.** A slip on a card that says what changed is
understood without training.

*Words.* kind of thing / class (shown only with T); detail / property; gap /
missing expected value; keeper / steward; "looks after the kinds of thing" /
ontology admin.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 3.

---

## V2: The table gains a column (`v2-new-column.html`)

*Idea.* "What we keep" as a periodic table: rows are kinds of thing, columns
are plain groups of detail (Where, When, Who, Number or state, Linked to),
each cell a detail with a fill bar. A change arrives as a **new column**,
"Checks", that slides in. Sites' cell is the dashed gap with its breakdown
(1 filled, 38 from documents, 88 keepers, 15 nobody); two other kinds show a
faint "similar?" cell (Vehicles' "MOT due", Suppliers' "Insurance until").
That is Mendeleev's point: the layout predicts what's missing in the
*structure*, and an operator can suggest it to the admin.

*Sources.* Mendeleev's table and its predicted gaps; Ranganathan's facets
(PMEST) for the plain column groups.

*What works.* The shape of the whole ontology is visible at once, and a change
is a change of shape. "Nothing expected" (dot) and "expected, not filled"
(dashed) sit side by side, which teaches the difference. The "similar?" cells
are the only variant where operators feed back into the structure.

*What fails or risks.* The column groups are a layer Data Atlas doesn't have
(every detail needs a group); the admin must keep it, and a bad grouping makes
the table lie. It shows the change at kind level, not on the operator's own
records, so it misses half the brief. Seven kinds fit; forty won't (needs
collapsing by family). Cells are small type.

*Principles.* Explain, never hide: the dot vs dashed distinction does it.
Calm: one column moves, once. Focus: the far cells dim while one is chosen.

*Needs.* A `group` per detail (or derive it from the property's range: dates
to When, links to Linked to); fill share per detail per kind; a "suggest"
channel to the studio.

*New employee test.* **Mixed.** The table reads on day one; the "similar?"
cells need the drawer to make sense.

*Words.* kind of thing / class; detail / property; group of detail / facet
(not shown to operators); nothing expected / no axiom; gap / missing expected
value.

*Score.* Clarity 3 · Distinctiveness 4 · Feasibility 4 · Fit 4.

---

## V3: Seams (`v3-seams.html`)

*Idea.* Every structural change leaves a stitched seam across the records it
touched, exactly where it touched them: above a new detail's row, under the
title of a record filed into a new kind, across the header of a renamed or
split one (with the old name struck through beside the new). Seams since your
last visit are bright; older ones are quieter and never disappear. Tab to a
seam to ask why. A vehicle the split couldn't place shows "Owned or Hired?"
as a *kind* gap.

*Sources.* Conservators' visible repair, kintsugi (the concept
`visible-repair` from wear and time).

*What works.* One mark covers all four kinds of change and sits on the record
itself. History of the record's *shape* is kept, not just of its values. The
struck-through old name keeps search and memory working after a rename. The
"kind gap" is a new, useful idea: a record can be missing its kind, not just a
detail.

*What fails or risks.* A seam doesn't say what happened until you ask: the
label helps, but "filed as depot · 28 Oct" still needs the hover. After a busy
year a record could carry many seams (needs: show the last three, fold the
rest). Stitches in the warning-mixed seam colour risk reading as "something is
wrong".

*Principles.* Explain, never hide: strong, every seam answers why. Calm: seams
draw once, then sit still. Conflicts a little with "dark when normal": a seam
is permanent visual noise unless aged hard.

*Needs.* `--x-stitch`, `--x-seam-old` (and wear and time's `--mark-seam`);
which change touched which record, by record (the change log joined to
records); the viewer's last visit.

*New employee test.* **Mixed.** The struck-through rename reads at once; the
seam itself needs the legend.

*Words.* kind of thing / class; "filed as" / rdf:type added; split / class
partition; renamed / rdfs:label changed; kind gap / untyped individual.

*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 4.

---

## V4: Consequence preview in the studio (`v4-consequence.html`)

*Idea.* The admin's side. The draft change (plain words first, technical line
under each) on the left; on the right, counted from today's records before
anything is saved: how many records, on which floors, who will be asked
(31 keepers get 88 small jobs; Dana Okafor is asked to name managers for 15
sites; 38 proposals go to Triage), what records will show (the gap breakdown),
which apps' views it touches (Data Atlas lists, a Mandate intent, an Artifacts
collection, Explorer saved views; a warning when a view's meaning shifts, e.g.
an intent that counts vehicles), and what won't change. The preview develops
like a print, then "Make the change" lights. 1 to 4 switch between the four
kinds of change.

*Sources.* The cinematic run's consequence preview; darkroom proof prints;
planning-application consultation maps (who is notified).

*What works.* It is the strongest answer to "before they commit". The
"which apps' views" block catches the real harm: a split silently changing
what an intent counts. The "who will be asked" block makes the cost of a
change visible to the person causing it. Technical names sit one step down,
always present here because this is the studio.

*What fails or risks.* Least distinctive: it is a well-made form and summary.
Counting across apps needs Mandate and Explorer to declare what they bind to.
Big ontologies may make counts slow (needs a background preview).

*Principles.* Consequence preview: yes, applied to structure. Explain, never
hide: "what won't change" is explicit. Calm: nothing moves after it develops.

*Needs.* Counts per kind per floor; expected details per kind; which Mandate
intents and Explorer views bind to which kind or detail (Data Atlas has
Mandate bindings per entity, not per kind or detail); the fillers estimate
(which documents could answer, who manages what).

*New employee test.* **Pass** for an admin. Operators never see it.

*Words.* add a detail / add a data property; expected / minCardinality 1
(advisory); add a kind inside / rdfs:subClassOf; rename / rdfs:label, with
skos:altLabel keeping the old word; split / partition by a property value.

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 5.

---

## V5: Before and after shelf (`v5-shelf.html`)

*Idea.* Records are book spines on a shelf, coloured by the floor they're kept
on; the records you look at are lit and labelled. A change re-shelves them in
front of you (FLIP animation): the split moves Vehicles into Owned and Hired
with a dashed held space between for the 4 nobody could place; a new kind
gets a bookend inside Sites; a new detail puts a band at the head of every
spine (filled, from a document, keeper, nobody); a rename re-labels the shelf
with the old name struck. A small "before" shelf stays above.

*Sources.* Library re-shelving and stack maps; shelf-reading.

*What works.* The most physical explanation of a split or a new kind: you
*see* where your vehicle went. The held space makes "not placed yet" a place,
not an error. The banded spines show the gap distribution of a whole kind at
a glance, by floor colour.

*What fails or risks.* Doesn't scale past a few hundred records without "one
spine is N records" (shown), which breaks "your record is a spine". A FLIP of
hundreds of nodes is fine; thousands isn't. Heights are decorative (a reader
will ask what they mean). It is a separate page operators must visit, so it
doesn't meet "on the records themselves".

*Principles.* Explain, never hide: the held space is a strong example. Calm:
the move plays once on arrival. Focus: lit spines are the beacon from the
light language.

*Needs.* `--x-spine-max`, `--x-shelf-h`, `--x-ghost-h` (layout); per-record
floor; per-viewer "records I look at".

*New employee test.* **Pass** for split and new kind; **mixed** for the
detail band (needs the legend).

*Words.* shelf / class extent; spine / individual; held space / unclassified
individuals; band / new property value.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 2 · Fit 4.

---

## V6: A round of small jobs (`v6-round.html`)

*Idea.* A new detail doesn't arrive as a backlog of 141 empty cells. It
arrives as **rounds**: one small job per site, each asking one question, given
to a named person. Amira (Estates keepers) works through hers: "A document
says 'Review due 2 December 2026'. Is the next check due 2 Dec 2026?" Yes,
No it's…, Can't tell (goes to the lead with a note), Not mine. Beside it, the
record her answer changes (the gap becomes her value, with its source), and
everyone's rounds: each manager's count, the team's 38 confirmations, and
Dana Okafor's 15 "nobody yet" to name managers for.

*Sources.* Postal rounds; field survey cards; Wikidata's and OpenStreetMap's
"missing statement" quests (StreetComplete).

*What works.* Turns "who can fill it" from a label into work that gets done,
and makes it visible who holds which part. Answers are one tap with the
evidence in front of you; nothing is filled without a person confirming.
"Can't tell" and "Not mine" are first-class, so the gap stays honest.

*What fails or risks.* Needs a jobs model (who holds which job, reassignment,
expiry) that Data Atlas doesn't have; overlaps with Triage (a suggested value
from a document *is* a Triage proposal; the round is a person-shaped view of
Triage). Rounds could feel like a chore queue if a big change creates
hundreds per person: needs a cap per round and a "later" pile.

*Principles.* Explain, never hide: everyone's rounds are public. Calm: no
counters pulse; progress dots fill quietly.

*Needs.* Assignment of gaps to people (from "manager" links or a keepers
team); reading suggested values from Artifacts documents into Triage; a
round-level view of Triage per person.

*New employee test.* **Pass.** One question, one site, three buttons.

*Words.* round / batch of triage proposals; small job / proposal; keeper /
steward; "can't tell" / abstain; lead / steward of stewards.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 3 · Fit 5.

---

## Scores

| Variant | Clarity | Distinct. | Feasibility | Fit | Total |
|---|---|---|---|---|---|
| V4 Consequence preview | 5 | 3 | 5 | 5 | 18 |
| V6 Round of small jobs | 5 | 4 | 3 | 5 | 17 |
| V1 Notice slip | 5 | 4 | 4 | 3 | 16 |
| V3 Seams | 3 | 5 | 3 | 4 | 15 |
| V5 Shelf | 4 | 5 | 2 | 4 | 15 |
| V2 Table gains a column | 3 | 4 | 4 | 4 | 15 |

## Ranked

1. **V4 Consequence preview**: the admin's half, and the cheapest to build.
2. **V6 Round of small jobs**: what happens to the gaps.
3. **V1 Notice slip**: how operators find out, on the record.
4. **V3 Seams**: what the slip leaves behind once read.
5. **V5 Shelf**: the best explainer of a split; a "what changed" page, not a daily view.
6. **V2 Table gains a column**: keep the "similar?" prediction; the table belongs to the Shape surface.

## What I'd build first

One pipeline, not one screen: **V4 → V1 → V3 → V6.** The admin previews (V4),
and the preview's "who will be asked" block *is* the set of rounds V6 creates,
so the admin sees the cost before paying it. On commit, every touched record
carries a V1 slip for each operator who hasn't seen it; reading it folds the
slip into a V3 seam that stays, quiet, as the record's shape history. The gaps
the slip names are worked off as V6 rounds, which are a person-shaped view of
Triage, not a new queue. Start with V4 and the gap mark, because both are
cheap, need only counts Data Atlas almost has, and make every later step
honest. **Beyond the ask:** V2's "similar?" cells show that a structure change
should also ask *which other kinds need this too*; I'd put that line into V4's
preview ("2 other kinds have a similar detail") rather than build the table.

## Answers for the shortlist

- **Shown to operators:** kind of thing, detail, link, gap, keeper, "filed
  as", "split into", "renamed". **Studio only:** class, property,
  subClassOf, cardinality, range, label/altLabel, partition. Operators see the
  technical line only with T, never by default.
- **Gap vs no record:** different marks (table above). Gap = dashed, closable,
  names a filler. No record = hatch, final.
- **What Data Atlas needs that it doesn't give today:** counts per kind per
  floor; expected details per kind with fill share; the change log joined to
  the records each change touched; per-viewer last visit and read state;
  Mandate and Explorer bindings per kind and per detail (today they bind to
  entities); assignment of gaps to people (rounds); a reason and the asking
  intent stored on each change.

## Proposed tokens (needs token)

| Token | Value (kit only) | Used for |
|---|---|---|
| `--x-type-micro` | .6875rem | mono eyebrows in data (already proposed by wear and time) |
| `--x-gap-ink` | ink-muted 70% | dashed edge of a gap |
| `--x-gap-fill` | ink 3% | faint fill of a gap |
| `--x-new` / `--x-new-wash` | green 70% into ink / green 10% | "the structure changed here" |
| `--x-seam` | warning 55% into ink | seam (wear and time's `--mark-seam`) |
| `--x-seam-old` | seam 45% into ink-muted | aged seam (V3) |
| `--x-stitch` | gradient of `--x-seam` | cross-stitches (V3) |
| `--x-paper` / `--x-paper-ink` | ink 92% into warning / slate-deep | the notice slip, the one light surface (V1) |
| `--x-near-dim` | .55 | far plane while one thing is chosen |
| `--x-spine-max`, `--x-shelf-h`, `--x-ghost-h`, `--x-cell-h` | space combinations | layout only (V2, V5) |

Relies on `--font-mono` (IBM Plex Mono, still needs an ADR) for numbers,
quoted document text and technical names.
