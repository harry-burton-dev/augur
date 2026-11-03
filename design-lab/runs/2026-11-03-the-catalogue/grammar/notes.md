# Grammar: the catalogue sheet

Six reference sheets for the run's vocabulary: kind, detail, link, filter
(facet), card, gap, plus where it came from (source), kept on (floor) and
should have (expected). For each one the sheets give the plain word, the word
admins use one step down, the mark and its token recipe, and what it must
never mean. Every sheet also carries the **six things that look empty**
strip, which separates the new gap mark from wear and time's "no record" and
"stale" and from the light language's "shadow".

All six share one sample-data object (`DATA` at the top of each script),
built in `_src/` (`common.css`, `data.js`, `common.js`, one template per
variant, then `python3 _src/build.py`). The sample deployment is a regional
services organisation: sites, suppliers, contracts, people, vehicles and
incidents, plus documents in Artifacts and intents in Mandate. Nothing is
drawn for ships and ports. The pack terms (`cco:Facility` and so on) are
illustrative, and two kinds are marked "own term" on purpose.

## The shared marks

| Plain word | One step down (admins) | Studio only | Mark and recipe | Never means |
|---|---|---|---|---|
| Kind of thing | class | pack term by IRI, parent class | Lucide icon in a `--radius-key` square, `--hairline-strong` edge, count in mono, **no hue** | a folder, a floor, a team, a tag |
| Detail | property | range, identity-key flag | name `--type-small --ink-muted`, value `--ink` | a note or a column you add for yourself; if the value is another thing, it is a link |
| Link | relation | domain, range, `owl:inverseOf` | 1px `--x-link` line, verb at mid-line, arrow for the reading direction, the backward reading in words | a web link, ownership, "related to" |
| Filter | facet | facet order per kind | chip: value and the count it leaves, in mono | a saved search, a tag, a sort; a count is never a total |
| Card | entity / individual | `owl:NamedIndividual`, the `ent_` id | fixed zones (kind, name, key, details, links, where it came from), 2px floor edge | a document (that is Artifacts), a copy; retiring never deletes |
| **Not known yet** (gap) | missing value | `sh:minCount 1` not met | **`--x-gap`: four 1px corner ticks, `--space-2` long, empty inside**, then the words and who could fill it | none, zero, hidden, old, broken; never red, never blocks saving |
| Where it came from | observation, provenance, grade | `prov:wasDerivedFrom`, Admiralty letters | numbered note in mono, file or person icon, how sure **in words** (letters one step down) | who typed it, or proof |
| Kept on | workspace | floor fence, raise | 2px left edge in `--floor-*-high` plus the floor name | a kind, a category, importance |
| Should have / can have | cardinality, min 1 / min 0 | `sh:minCount`, `owl:minCardinality` | `--x-expected`: a 2px tick before the detail name; "can have" has none | compulsory, a rule that stops work, a score |

### Is the gap the same as "no record"? No.

They answer different questions, so they get different shapes:

| State | Question it answers | Mark | Comes from |
|---|---|---|---|
| **Not known yet** (gap) | *Space:* should this card hold it? Yes, and nobody has recorded it | corner ticks around the empty slot, plus who could fill it | the kind's "should have" list compared with the card's accepted facts |
| **None** | Someone checked, and there is none | the word "None" as a value, with its source note | a fact whose value is "none" (data Atlas doesn't hold yet) |
| **Out of date** (stale) | *Age:* the value is held, but how old is it? | 45° hatch on the **age text**, never on the value (wear and time) | review age per detail or floor policy |
| **No record** | *Time:* what happened between two dates? We don't know | a wavy dashed break in the history band (wear and time's unconformity) | the events service declaring its own gaps (`record.gap`) |
| **Not yours to see** (shadow) | *Access:* it exists, so who can see it? | 135° hatch and a lock, with the floor and who to ask (light language) | the 403 `reason` (`kept` / `elsewhere`) |
| **Could also hold** | *Shape:* not expected for this kind | none: listed once, quietly, in words | "can have" details with no value |

In short: **the gap is about space, stale is about age, no record is about
time, and shadow is about access.** The gap is the only one drawn with
corners. Corners show the shape of what is missing without making it look
old (hatch) or broken (a wavy break). V2 adds a seventh, structural state,
**asked for** (a dotted outline), for a detail the ontology doesn't have
yet. It lives only on the kinds table, never on a card.

---

## V1: Parts of a card (`v1-field-guide.html`)
*Idea.* A field guide's topography plate (the "parts of a bird" spread) for
one record. A specimen card sits in the middle, and nine numbered callouts
with leader lines name each part: the plain word large, the admin word in
grey mono under it, and "Never means" below that. A reading line at the top
gives the full sentence for whichever part has focus. The demo draws the
leaders in order, then racks focus onto the gap (the other callouts
desaturate and soften, with no scrim).

*Sources.* Sibley and Peterson front matter (topography plates and "how to
use this guide"), Wikidata item pages (statement, reference), the cinematic
focal planes.

*What works.* It teaches by pointing at the real thing, so nothing is
abstract. The six empty-looking states sit under the plate, all drawn from
the same card, so the differences are concrete (Opening hours, Fuel store,
Fire inspection). "Found under" chips put filters on the card, which shows
that a filter is just a detail you can narrow by.

*What fails or risks.* Leader lines are measured from the page layout and
must be redrawn on resize, which is fine for a help page and wrong for a
working screen. At 1280 the "Never means" lines fold until a part has focus.
The leader to the gap crosses the links column of the card.

*Principles.* Focus stacking (rack focus on one part); explain, never hide
(every part answers in place); calm (it draws once, then stays still).

*Needs.* `--mark-gap`, `--mark-expected`, `--mark-link`, the stale hatch and
shadow from earlier runs. A kit `Callout` with a leader is optional.

*New employee test.* **Pass.** An operator on day one reads "Not known yet:
Operations leads can add it · Mara Okafor would know" correctly without the
plate. The plate is for the second question, "what is this bit called?".

*Pairs used.* Kind of thing / class · Detail / property · Link / relation ·
Filter / facet · Card / entity · Not known yet / missing value · Where it
came from / observation · Kept on / workspace · Should have / cardinality.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V2: The table of what we keep (`v2-periodic.html`)
*Idea.* Mendeleev for the ontology: one row per kind, one column per family
of detail (name and key, where, when, who, condition, money, paperwork).
Each cell is a detail: a two-letter symbol, the name, "known / all", a
lightness bar for how many cards hold it, and the gap mark on the unfilled
rest. **Where five or more kinds fill a column and one kind does not, the
empty cell becomes a dotted "?"**, carrying the words that sources asked for
(Atlas's candidates): "Usual driver, asked 11×". Arrow keys read any cell
as a sentence.

*Sources.* Mendeleev's 1869 table (gaps that predict), the periodic table's
key box, Bertin's value variable, Data Atlas's `GET /ontology/candidates`.

*What works.* The shape comes before the content: a newcomer sees what is
kept, how complete it is, and where it is thin, without opening one card.
The prediction rule is honest and tunable (`predictAt` in the data). It
splits the **gap on a card** from the **question in the structure**, which
the other sheets can't show. The rows for documents in Artifacts and intents
in Mandate make the edges of Data Atlas visible.

*What fails or risks.* The two-letter symbols are a gimmick: "Cn" means both
Company number and Contract number. Drop them for real use. Seven columns
of 60px cells are dense, and at 1280 the names truncate. "Families" are a
new idea the ontology doesn't carry; someone has to assign each detail to
one, and the grouping is arguable (is Fuel a condition?).

*Principles.* Explain, never hide (the empty cell says why it is empty:
nothing here, or asked for). Calm: the bars grow once.

*Needs.* `--mark-asked` (dotted), `--mark-coverage`. Data: known counts per
detail per kind, a family per detail, and candidates grouped by the kind
they were asked for.

*New employee test.* **Partial.** An operator reads the rows and the bars,
but "asked for" and the symbols need the key. It is a page for leads and
admins first, operators second.

*Pairs used.* Kind of thing / class · Detail / property · Link (an arrow and
the kind it points to) / relation · Should have / min 1 · How many cards
hold it / coverage · Not known yet / missing value · **Asked for / candidate
term** · Nothing here / not in the ontology.

*Scores.* Clarity 3 · Distinctiveness 5 · Feasibility 4 · Fit 4

## V3: Anatomy of a card (`v3-catalogue-card.html`)
*Idea.* A 5 × 3 library card. Every zone a cataloguer knows maps to one of
our words: the call number is the kind and key, the main entry is the card's
name, the body is the details (written as an ISBD paragraph with " — "
between them), "[ ] to be supplied" is the gap, the notes are the sources,
the subject tracings (1, 2, 3) are filters, the added entries (I, II, III)
are links, and the location stamp is the floor. **T** cycles four kinds:
the content changes and the shape stays.

*Sources.* Library of Congress printed cards, ISBD areas and punctuation,
Dewey call numbers, AACR "required elements".

*What works.* "The shape is fixed, whatever the kind" is the strongest
single idea for operators, and T proves it in one key. The library mapping
is unusually exact: tracings really are links and facets.

*What fails or risks.* The run-on ISBD paragraph is slower to scan than a
list of details; it is charming but not for work. It is skeuomorphic (a
stamp, ruled lines, a rod hole) and sits apart from the water language. The
library words (call number, tracings) need explaining themselves, so they
belong on a teaching sheet only.

*Principles.* Explain, never hide (the hidden lease is named in the notes,
with a lock). Calm.

*Needs.* Nothing beyond the shared marks.

*New employee test.* **Pass for the shape, fail for the words.** An operator
sees that every card has the same zones. "Subject tracings" means nothing
to them, which is why the plain word leads each rule.

*Pairs used.* Library → ours → admin: call number → kind of thing → class ·
main entry → card → entity · body → detail → property · required elements
→ should have → cardinality · [ ] to be supplied → not known yet → missing
value · notes → where it came from → observation · subject tracings →
filter → facet · added entries → link → relation · location stamp → kept
on → workspace.

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 4 · Fit 3

## V4: Five questions (`v4-pmest.html`)
*Idea.* Ranganathan's PMEST as five plain questions: **What is it?** (P, the
kind), **What is it like?** (M, details), **What happened to it?** (E, links
to incidents and intents), **Where?** (S) and **When?** (T). The values
under each question show what they would leave. The demo answers four of
them, and a sentence builds itself ("Diesel vehicles in an incident at
Kestrel Road Depot serviced later: 6") with Colon notation one step down.
**"Not known yet" is a value in every column, with its count and the gap
mark, so a missing answer is never silently dropped.** "Kept on" stands
apart, behind a dashed rule: you can narrow by it, but it says who keeps a
card, not what the thing is.

*Sources.* S. R. Ranganathan, Colon Classification (1933) and PMEST, faceted
search; 87 sample vehicles are generated from weights in the data object, so
every count is real.

*What works.* The counts are honest (computed, with zero values dimmed, not
hidden). It shows the gap in the place operators meet it most: filtering.
Treating the floor as "not a sixth question" settles a confusion that
otherwise creeps in. The sentence is a plain-language query that people
can read back.

*What fails or risks.* PMEST is a stretch for some kinds (what is the
"energy" of a supplier?), and the columns would differ per kind. The Colon
notation is a curiosity for admins only. The other kinds are hatched (only
vehicles have sample rows), which reads as unavailable, even though the
note explains it.

*Principles.* Explain, never hide (zero counts stay visible, and unknown is
choosable). Calm: four steps, once.

*Needs.* Data: counts per facet value from Data Atlas, including a count
for unknown. Mapping each detail to a PMEST question per kind would be an
ontology field.

*New employee test.* **Pass.** Five questions and a sentence are the most
operator-native form on this page.

*Pairs used.* What is it? / Personality / class · What is it like? / Matter
/ property · What happened to it? / Energy / relation · Where? / Space /
property · When? / Time / property · Not known yet / missing value · Kept on
/ workspace. The glossary strip carries all nine pairs.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V5: A diagram for readers (`v5-readers-diagram.html`)
*Idea.* An entity-relationship diagram redrawn for readers. Kinds are
circles sized by how many cards they have, filled lighter as more of their
"should haves" are known, and ringed in their floor's hue. Links are lines
with Chen's diamond at the middle, and every verb is written out. Picking a
link reads it both ways in sentences ("Each vehicle is based at one site. A
site is the base for any number of vehicles."), with no crow's feet. Beside
it, a Bertin table gives **one visual variable per job**: size is count,
lightness is completeness, hue is the floor only, the icon is the kind,
texture is the empty-looking six, the arrow is reading direction, and
position means **nothing**.

*Sources.* Peter Chen (1976), Jacques Bertin's *Semiology of Graphics*,
Isotype's rule of one sign per meaning.

*What works.* The Bertin table is the most reusable rule set in this
folder; it should become a rule in `docs/app-patterns.md`. "Position means
nothing" deliberately blocks the "up is senior" misreading. The cardinality
in words is far better than crow's feet for operators.

*What fails or risks.* The node-link diagram itself is ordinary, and with 30
kinds it becomes a hairball. It needs a fixed layout per deployment, or
small multiples (one kind and its neighbours). Completeness as fill
lightness is subtle on a dark ground, so the percentage must stay in text.
Raw SVG stroke widths are used.

*Principles.* Focus stacking (the picked link lifts and the rest recedes).
Explain, never hide (documents and intents shown dashed as "kept by other
apps").

*Needs.* `--x-fill-lo/hi` (completeness lightness range). Data: per-link
min/max in plain words ("one", "any number of") and the inverse verb, which
Atlas already asks for when adopting a pack term.

*New employee test.* **Partial.** The sentences pass. The diagram needs a
minute, and the Bertin table is for designers and admins.

*Pairs used.* Kind of thing / class · Link / relation (domain, range, max 1
or many) · How many cards / count · How complete / should-haves known · Kept
on / workspace · plus the nine-term glossary.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 3 · Fit 4

## V6: Two registers (`v6-two-registers.html`)
*Idea.* The same card said twice. A switch, **Admin words (A)**, adds a mono
line *under* every plain word on the card ("Opening hours → missing value ·
min 1, 0 facts") and unfolds the "One step down" column of the ledger.
Folded, the column stays visible as a narrow strip that says how to open it.
A third column, **Studio only**, lists the words that never reach an
operator's view, with or without the switch (IRIs, OWL and SHACL terms, raw
ids, grade letters on their own). Four rules sit under the ledger: plain on
top, anyone may switch, studio words stay in the studio, and search
understands both registers.

*Sources.* Isotype's "transformer" (the person between the expert and the
public), Wikidata (label first, Q-id beside it), field-guide keys.

*What works.* It is the clearest answer to "which ontology terms can be
shown to operators at all": a three-tier ledger. The switch is honest: the
words are not secret, so everyone can turn it on, and the folded column
explains itself. It costs little to build: one `Term` part with an optional
second line.

*What fails or risks.* It is the least visually distinctive sheet. Two lines
per row make an admin's card about 30% taller. A per-person setting needs a
place to live (shell preferences).

*Principles.* Explain, never hide (the folded column stays as a strip that
names itself). Calm: the lines unroll once.

*Needs.* `--x-admin-w`, `--x-fold-w` (layout only). A shell-level
preference "show admin words", and a search index carrying both
vocabularies.

*New employee test.* **Pass.** The switch is off for operators, and the card
reads entirely in plain words.

*Pairs used.* All nine, plus card-level pairs: Name / label, altLabel · Site
code / identity key · Not known yet / missing value, min 1, 0 facts · Out of
date / stale, review age · None / stated absence · Links / relations · Kept
on / workspace, department.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

---

## Needs token (all are mixes of kit tokens)
- `--mark-gap` (`--x-gap-ink` = `--ink-muted` 78%, `--x-gap-tick` =
  `--space-2`, the eight-gradient corner recipe `--x-gap`).
- `--mark-expected` (`--ink`), `--mark-link` (`--hairline-strong`),
  `--mark-asked` (`--ink-muted` 70%, dotted), `--mark-coverage` (`--ink` 55%).
- Carried, still owed: `--mark-stale-hatch` (45°), the shadow hatch (135°),
  `--time-past-dim` (used here as `--x-quiet`, .62).
- Layout: `--x-callout-w`, `--x-cell-h`, `--x-side`, `--x-card-ratio`,
  `--x-rule`, `--x-admin-w`, `--x-fold-w`, `--x-fill-lo/hi`.
- Raw hairline numbers left in SVG: stroke widths, dash arrays, the 2.5px
  leader dot, the stamp's −4° rotation. The kit should name two or three.
- All sheets rely on `--font-mono` (IBM Plex Mono, still needs an ADR).

## Data Data Atlas doesn't give today
- **"Should have" per kind** (min 1 / min 0 per detail). Without it there is
  no gap, only absence. It is the one field every sheet depends on.
- **Counts:** cards per kind from this floor, and cards holding each detail.
- **Who could fill a gap:** the floor's leads by default, plus a suggested
  person (from links such as "site manager", or the last source).
- **Stated absence** ("None"), as a fact value distinct from no fact.
- A **family per detail** (V2) and a **PMEST question per detail** (V4);
  both are optional and both are ontology fields.
- **Candidates grouped by kind** (V2's "asked for"); today they are listed
  most asked first.
- Link cardinality in words, and the inverse verb (V5); Atlas already asks
  for the inverse when a pack term is adopted.

## Ranked
1. **V6 Two registers.** It answers the shortlist's first question and costs
   one kit part.
2. **V1 Parts of a card.** The best day-one teaching page and the clearest
   home for the six empty-looking states.
3. **V2 The table of what we keep.** The most distinctive idea, and a
   candidate front page for "the shape of what we keep" (without the
   symbols).
4. **V5 A diagram for readers.** Keep the Bertin table and the link
   sentences; the diagram is optional.
5. **V4 Five questions.** Keep "not known yet as a filter value" and "kept on
   is not a sixth question"; PMEST itself is too rigid across kinds.
6. **V3 Anatomy of a card.** Keep the T demo (same shape, any kind); drop
   the library styling.

## What I'd build first
The **blank family as one kit part**: a `Blank` part in Quill with
`kind = gap | none | stale | noRecord | unseen | could`. Each kind gets the
mark from this sheet and a required sentence (who can fill it, how old, why,
which floor), and the `--mark-gap` corner recipe goes into the token files.
Alongside it, a `Term` part that renders the plain word with an optional
admin line, driven by the ontology and one shell preference ("Admin words").
Those two parts let every other surface in this run (record card, facets,
shape page) draw honest gaps and both registers the same way. They also need
just one change in Data Atlas: "should have" per detail per kind.

**Where I went beyond the ask.** I added "None" (stated absence) and "Could
also hold" to the family, because without them the gap gets used for both.
V2 also adds "Asked for" as a structural gap, kept apart from the card-level
gap. And I recommend that anyone can turn on admin words (V6), instead of
admins only, because words aren't secret.
