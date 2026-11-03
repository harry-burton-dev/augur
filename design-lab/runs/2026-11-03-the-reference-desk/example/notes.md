# Ask by example: critique

Surface 3 of the reference desk. The person points at a record ("more like this one") or fills in a sketch of the row they want (Zloof's Query by Example), and the answer moves while the example is shaped (Shneiderman's dynamic queries).

All six share one sample data object (`_src/data.js`: Vale Regional Services, Facilities department floor, 17 suppliers, one example, Greenway Haulage), the operator's question *"which suppliers have we not heard from since spring?"*, and the same frame. Each page has:
- the clarification *"spring from 1 March (the season) or 1 April (your financial year)?"*, with the count each reading would give;
- a workings strip whose steps say whether they came from the record (`database`, solid) or from the model gateway (`bot`, dashed, italic);
- **M** to turn the gateway off: the steps that need it stay visible, look unavailable and say who can turn it on;
- **T** for technical words;
- the catalogue's empty marks: *not known yet* (corner ticks, with who could fill it), *stale* (45° hatch), *none* (underlined) and *not yours to see* (135° hatch, a lock and whom to ask, with the count shown as "some").

Built with `_src/build.py`, which inlines `common.css`, `data.js` and `common.js` into each page. Pages link the kit exactly as the brief says.

**How a guess looks, everywhere.** A guess is never upright and never solid. It is italic, in `--x-proposed-guess` (an info-blue mixed with ink), with a dotted underline or a dashed edge, and tagged `MODEL'S GUESS`. A fact is upright ink with a solid rule. When a person accepts a guess it turns solid, and the workings then say "your choice", not "the model".

---

## V1: Sketch a row
*Idea.* Zloof's skeleton table, kept literal. A dashed first row sits above the supplier table, and you write the row you want into it (blank means any). Rows that are left out stay in the table, dimmed, and the side panel groups them by the cell that excluded them. The sketch reads back as a sentence above the table.
*Sources.* Query by Example (1975), the spreadsheet filter row, dynamic queries.
*What works.* It is the most familiar of the six: operators already filter spreadsheets. Typing "before spring" raises the clarification right under that cell, with both counts. Typing "bin lorries" into *what they do* shows the model's reading ("reads like *waste*. Use waste") in guess style, and kept rows matched through a guess are coloured as guesses too. The guess becomes solid only after "Use waste". With the gateway off, the same words fall back to matching by spelling, and the page says so. "Left out, and by which cell" answers *why isn't X here?* without a trip anywhere.
*What fails or risks.* The cells need a small grammar ("before 1 Mar", "not North", "over 100") that operators have to guess at. A typed cell is still a query language, only a friendlier one. It is also the least distinctive: it is a filter row. At 1280 wide the six cells get tight.
*Principles.* Explain-never-hide: strong (nothing vanishes; the "can't tell" group names Sam Ortiz). Calm: yes. Letterbox and focus stacking: not used.
*Needs.* A cell parser for each detail type, and the model gateway's "word to kind" mapping (sample: `modelWords`).
*New employee test.* **Passes.** "It's a filter row" in under ten seconds. Would stall on what to type in a date cell.
*Gateway.* Needs it: reading free words ("bin lorries") as a kind. Works without it: everything else (exact values, comparisons, matching by spelling, the clarification, the left-out reasons).
*Score.* Clarity 4 · Distinctiveness 2 · Feasibility 5 · Fit 4

## V2: Pin what matters
*Idea.* You point at Greenway Haulage, and its card lists every detail with a pin (same / about this / also quiet). Pinning a detail makes it part of the example. The answer is ranked into bands: *alike in every pinned way*, *can't tell*, *differ in one way*, then a folded line for two or more. Each row has a dot per pinned detail and says in words where it differs.
*Sources.* Zloof's example elements, the reference interview (you say which part of the example is the need), HomeFinder.
*What works.* Near misses are the useful part: "Riverbank Compost differs in what they do (grounds)", but its own words read alike to the model. The pins are a neutral question: the system never assumes which details matter. The sentence reads back with the model's clause in guess style. With the gateway off, the *in their own words* pin goes unavailable on the card and says who turns it on, and its dot column hatches. The Mandate intent on the card ("Re-tender waste collection before April") explains why the person is asking.
*What fails or risks.* With six pins the dot grid gets wide. "About this" (half to double) is a hidden rule; it shows in the workings, but should be editable. Ranking by number of misses treats every detail as equally important.
*Principles.* Explain-never-hide: strong. Calm: one pulse on the count, then still. Focus: the example card carries the beacon glow, the list stays in the near plane.
*Needs.* A "same / near" rule for each detail type, set by admins (a band for money, a window for dates). Meaning similarity from the gateway (pgvector over `rdfs:comment`).
*New employee test.* **Passes, best of the six.** "Find ones like this; pin what has to match."
*Gateway.* Needs it: the *in their own words* pin (alike by meaning). Works without it: every other pin, the bands, the reasons and the clarification.
*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 5

## V3: Like these, not that
*Idea.* Drop two or three suppliers into *like these* and one into *not like this*. Data Atlas writes out, a line at a time, what your examples share. Each line is tagged *shared*, *tells them apart* or *left out*, with its evidence ("yours went quiet by 12 Feb; Fenwick was heard from on 14 Sep"). Where the examples can't decide, it asks: "Does the amount matter?", and "Your examples can't say where the line is: 1 March or 1 April?"
*Sources.* Identification keys and Twenty Questions (the counter-example does the narrowing), QBE, neutral questioning.
*What works.* It is the only variant where the clarification comes *out of the examples*: the gap between 12 Feb and 14 Sep is exactly where "spring" is ambiguous. The rule is found without a model, from the record. The model offers one dashed, optional extra line ("maybe also anyone whose own words sound like waste collection", which would add Riverbank Compost) that you add marked as a guess. The answer separates *your example* from *new* (Northfield Recycling, the one the person hadn't named).
*What fails or risks.* It needs two or more examples and a counter-example before it says anything useful, so cold start is slow. With many details, finding the rule gets combinatorial and a lucky split can look meaningful. The person must trust lines they didn't write. The yes/no prompts could feel like an exam if there are more than two.
*Principles.* Explain-never-hide: very strong (the working is the rule). Calm: yes.
*Needs.* A rule-induction step over details, with a limit on clauses. A "tells them apart" explanation for each clause type.
*New employee test.* **Passes with a nudge.** People get "like these, not that" at once; the trays need a first hint.
*Gateway.* Needs it: the optional "sounds alike" line only. Works without it: finding the rule, the questions and the answer.
*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V4: Stretch the example
*Idea.* The example is a bright point on a chart of *last heard from* against *worth a year*. You stretch a net round it, wider in time and in money, and turn on more kinds. Dots light as they fall inside the net. The two readings of spring are dashed lines you can snap to. Suppliers with no date can't be placed on the time axis, so they wait in a dashed *not known yet* gutter beside the chart.
*Sources.* HomeFinder and FilmFinder (dynamic queries), a fishing net.
*What works.* The gutter is the most honest picture of a gap in the run: the record can't place them, so the chart doesn't. Anchoring the sliders to a known record answers the catalogue's finding that bare live sliders are lost on operators: here you stretch from *something you know*. Every chip shows what it would add (+1). No step needs the model, and the workings say so.
*What fails or risks.* A scatter of two axes is still an analyst's picture. Operators read "up and right" as better, not as *recent and expensive*. Only two details fit on axes; the rest become chips. The labels are small at 1280. It doesn't scale past a few hundred dots without binning.
*Principles.* Explain-never-hide: good (dimmed, not removed). Calm: the net moves only when you move it. Focus: the beacon point.
*Needs.* Value and date range rules for each detail; a log scale for money. Binning for large kinds.
*New employee test.* **Partial.** They get the net; they don't get the axes without a sentence.
*Gateway.* Needs it: nothing. Works without it: all of it.
*Score.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 3

## V5: Rings of difference
*Idea.* The example sits at the centre, and every other supplier sits as many rings out as it has differences. Its direction shows *which* detail differs: up = does something else, right = works elsewhere, down = different money, left = heard from lately. Choosing the other spring visibly moves Coastline Waste Services and Holm Road Salt a ring inward, and the panel says beforehand what the other reading would move. Any dot can become the new centre, so you walk from example to example.
*Sources.* A colour-matching swatch fan, a compass rose, QBE.
*What works.* It is the clearest picture of *how close* something is, and the clarification's consequence is shown as movement. A supplier whose missing date might count as one more difference sits *between* rings with corner ticks. The model's opinion is a dotted halo that never moves a dot, which is exactly the rule "a guess never moves a fact".
*What fails or risks.* The direction meaning is hard to learn, and averaging two directions puts different combinations in the same place. Labels collide as rings fill. The hidden-floor arc is easy to miss. It looks like a constellation more than a tool, so it risks being a gimmick over a working day.
*Principles.* Focus stacking: natural (centre in focus, outer rings could rack-blur). Explain-never-hide: the hidden arc and the between-rings dots. Calm: moves only on change.
*Needs.* A layout that resolves collisions. A comparable rule for each detail.
*New employee test.* **Fails without a guide.** "Closer is more alike" is fine; "up-left means…" isn't.
*Gateway.* Needs it: the halos only. Works without it: rings, directions, re-centring, the clarification.
*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 2 · Fit 4

## V6: Loosen the sentence
*Idea.* The example is said as one large sentence: "Greenway Haulage does waste in the North, worth £140k a year, and we last heard from them on 12 Feb." Click any word to loosen it (to *any supplier*, *any region*, *any amount*, *before 1 Mar*), and each choice shows how many suppliers it would bring in. The answers come back **in the same sentence**. Values that differ from the example are dotted. A missing value is a corner-ticked blank inside the sentence that names who could fill it.
*Sources.* QBE (the example is the row), the catalogue's statements and "said in a sentence", the reference interview (sharpen by loosening, never lead).
*What works.* Question, example and answer share one shape, so there is nothing new to learn. *How you got here* lists each loosening with its count (1 → 1 → 1 → 1 → 3), which also gives a saved question a natural record. **T** shows the generated query under the sentence ("explain the SQL", in reverse). Writing your own word ("rubbish") goes through the gateway as a guess; with it off, that option says "needs model" and everything else works.
*What fails or risks.* Sentences take room: six or seven answers fill the screen, so long answers need a table toggle (catalogue: table plus sentence header). A sentence template is needed for each kind. Loosening can't easily express "North *or* Coast" without a second blank.
*Principles.* Explain-never-hide: strong (gaps are in the sentence). Calm: yes. Two registers: the T line under the sentence.
*Needs.* A sentence template for each kind (the catalogue asked for this too). Loosening steps for each detail type. A trail that a saved question keeps.
*New employee test.* **Passes.** "Make the sentence say what you want."
*Gateway.* Needs it: your own words in a blank. Works without it: every loosening, the counts, the trail and the T query.
*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

---

## Ranked
1. **V6 Loosen the sentence**: one shape for question, example and answer; continues the catalogue's statements.
2. **V2 Pin what matters**: the best "more like this one" from a record card; near misses are the real value.
3. **V3 Like these, not that**: the most original; the rule *is* the workings, and it is the only one where the clarification comes from the examples.
4. **V1 Sketch a row**: the safe fallback for people who think in spreadsheets.
5. **V4 Stretch the example**: keep its *not known yet* gutter; drop the scatter for operators.
6. **V5 Rings of difference**: keep its halo rule and "this reading would move X"; the map is too costly to read.

## What I'd build first
**"More like this" on every record card, as V2's pins, with V6's sentence as the answer.** Pinning a detail loosens that word of the sentence, so a pinned card and a sentence with blanks are one object seen two ways. Near misses come back as sentences with the differing words dotted. It all runs on keys, names and the detail rules, with no model; the gateway adds exactly two things, each marked as a guess: *alike in their own words* and *your own word for a blank*. The thing to decide first is **what a saved example remembers**. "More like Greenway Haulage", rerun next week after someone logs a call to Greenway, silently changes its meaning. The saved question should keep the pinned values as they were ("like Greenway Haulage as it was on 3 Nov: waste, quiet since 1 March") and offer "use Greenway as it is now", with the difference shown, as a separate choice.

## Needs token (all `--x-proposed-*`, in `_src/common.css`)
- `type-micro` (.6875rem, also proposed by wear-and-time and the catalogue)
- `quiet` (.62 opacity for left-out and unavailable things)
- `here`, `here-soft` (the floor accent)
- `lit`, `lit-wash` (a kept record)
- `beacon`, `beacon-glow` (the example itself; the light language's beacon)
- **`guess`, `guess-wash` (new): the model's mark.** Proposed as `--mark-guess` beside the six empty marks. It needs a decision, because Artifacts and Mandate will show model output too.
- `gap-ink`, `gap-tick`, `gap`, `hatch`, `stale`, `unseen`: the catalogue's empty marks, unchanged

`--font-mono` is used for counts, workings and the T query, so it still needs its ADR.

## Data the shell and Data Atlas don't have yet
- A "same or near" rule for each detail (money band, date window, region list), owned by admins.
- When we last heard from someone, as a computed detail: the latest observation's date and its source.
- Meaning similarity over the *in their own words* text (pgvector), only through the gateway.
- A sentence template for each kind.
- Saved questions that keep the example's pinned values, the clarifications chosen ("spring = 1 March") and the time the question was asked.
