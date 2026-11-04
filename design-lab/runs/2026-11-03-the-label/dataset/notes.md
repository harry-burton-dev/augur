# Surface 5 · A dataset's own label

**The moment:** the Data Atlas collection "Pilotage safety records, 2021–2026" (C-14, 312 records, kept by Kofi Mensah) says what it is made of, where it came from, how complete it is and what it may be used for, before anyone uses it. Five parts, each with its own label: duty roster entries (168, O-S PERSONAL, imported), near-miss reports (58, PERSONAL, confidential form), incident reports (41, OFFICIAL, 8 still on paper), fatigue diaries (29, PERSONAL, one consent each: 11 of 14 gave, 2 declined, 1 withdrew) and vessel tracks (16, COMMERCIAL, licensed from Coastal AIS Ltd). Per-year counts and their gaps are in `DATA.dataset.byYear`. The collection's label is **worked out** by combining its parts' labels, never set by hand.

**Keys:** R, T, S as everywhere; each page lists its own.

---

## V1: Dataset facts
*Idea.* The US Nutrition Facts panel, rule for rule: heavy and medium bars, a fixed order, records as "servings", **% of expected** where food has % daily value (92% of roster entries; near misses "n/a: nobody knows how many went unreported"), then Contains and Not for in bold, the marking, the keeper and the date checked. Known issues and the why behind "not for appraisal" sit beside it.

*Sources.* FDA Nutrition Facts panel; the Dataset Nutrition Label (Data Nutrition Project, 2018).

*What works.* Instantly recognisable as "the label", dense and calm. "% of expected" is the most useful number a collection can carry, and "n/a" with a reason is honest.

*What fails or risks.* Black-and-white heavy rules are a quotation of another visual language; they need tokens and may look borrowed. Only says how much, not where it is thin (V4 does).

*Principles.* Explain, never hide: good. Calm: very.

*Needs.* `--x-proposed-rule-heavy`, `--x-proposed-rule-mid` (needs token). Expected counts per source (Data Atlas doesn't hold them).

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 3

## V2: Datasheet
*Idea.* The datasheet's seven sections (motivation, composition, collection, preparation, uses, distribution, maintenance) as questions with answers from the collection. An unanswered question is a gap with the person who could answer ("Who paid for or asked for it? Kofi Mensah could answer"). The section list counts gaps.

*Sources.* Datasheets for Datasets (Gebru and others, 2018).

*What works.* Complete, and the gap count gives a keeper a to-do list. "Did people agree?" answered with real numbers is the consent receipt at collection level.

*What fails or risks.* Long; nobody reads it before every use. Questions like "who paid for it?" fit research data better than operational data and should be per-deployment.

*Principles.* Explain, never hide: strong. Calm: yes.

*Needs.* Question set per deployment; gaps as tasks for the keeper.

*Scores.* Clarity 4 · Distinctiveness 2 · Feasibility 5 · Fit 3

## V3: Origin to use
*Idea.* A flow diagram: where each part came from (the roster system, the confidential form, the pilots by consent, Coastal AIS Ltd), through the part, to the uses its label allows. Width is records. Counts-only flows are blue; picking a part (1–5) draws its forbidden uses as dashed stops.

*Sources.* Sankey diagrams; Minard; provenance graphs.

*What works.* The only picture that puts origin and permitted use on one page, which is the whole argument of a dataset label: what it is fit for depends on where it came from.

*What fails or risks.* Six uses times five parts is a tangle; the middle of the diagram is unreadable. Sankeys suggest a quantity flows, but a record can serve many uses at once. Coordinates are computed in the page, so spacing doesn't come from tokens.

*Principles.* Explain, never hide: the dashed stops help. Calm: moderate.

*Needs.* Origin as a first-class field on each part.

*Scores.* Clarity 2 · Distinctiveness 4 · Feasibility 3 · Fit 3

## V4: Coverage
*Idea.* Completeness as a picture: part by year, each cell's ink by records, and each kind of empty with its own mark and sentence: **no record** (roster 2023: the system change, can't be recovered), **a gap** (incidents 2021: 8 on paper, Kofi could enter them), **doesn't apply** (diaries before 2026), **read with care** (near misses from 2024: reporting fell after the rota change).

*Sources.* Six ways to be empty (catalogue run); Bertin's reorderable matrix.

*What works.* Where the collection is thin, at a glance, with the reason. "A drop in reporting, not known to be a drop in near misses" is exactly the warning a manager needs before drawing a trend.

*What fails or risks.* Year columns hide sub-year gaps (the roster gap is three weeks). The caution mark needs someone to write it; AUGUR can't detect a change in what is measured.

*Principles.* Explain, never hide: strong. Calm: yes.

*Needs.* Gap and caution notes on collections, with authors.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V5: Fit for this use?
*Idea.* Say what you mean to do ("publish fatigue figures in the annual safety report"), and every part answers yes, as counts only, or no with why; the collection then says what you can take (283 of 312, most as counts) and **what you'd be missing** ("without the diaries, 'fatigue' means hours on duty only, not sleep").

*Sources.* Creative Commons licence chooser; Data Nutrition Project's "intended use" panel.

*What works.* Reads the label for you against your purpose, and the "you'd be missing" line catches the error a lay user would make. "Take what fits" makes a working copy with the right label and the purpose in its custody.

*What fails or risks.* Six purposes are the policy's uses, not the operator's words; matching free text to a use is guesswork. A whole-collection answer can hide that "yes" for one part means "yes, but only these years".

*Principles.* Explain, never hide: strong. Reach before act: for use, not sharing. Calm: yes.

*Needs.* Declared purpose on taking a copy; a working-copy label computed from what was taken.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V6: Ingredients by weight
*Idea.* The ingredients list in descending order of weight, with its share (duty roster entries 54%, near-miss reports 19% …), what each contains in bold, and the part made of consent counted person by person: 11 gave, 1 withdrew, 2 declined, with "those who said no aren't missing at random: tired pilots may be the ones who declined".

*Sources.* Food ingredient lists in descending weight and QUID (quantitative ingredient declaration); allergen emphasis; Isotype; consent receipts.

*What works.* "The part that dominates the answers is the one you read first" is a real insight: most fatigue findings are roster findings. The consent figures make selection bias visible to a non-statistician.

*What fails or risks.* The sentence form breaks past six or seven parts. One figure per person doesn't scale beyond a few dozen people.

*Principles.* Explain, never hide: good. Calm: yes. Mine versus ours: counts of people, never names.

*Needs.* Consent counts per part (ask, gave, declined, withdrew).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

---

## Ranking
1. **V5 Fit for this use?**: the label read against your purpose.
2. **V4 Coverage**: where it's thin and why.
3. **V1 Dataset facts**: the panel, with % of expected.
4. **V6 Ingredients by weight**: order by weight; consent counted.
5. **V2 Datasheet**: as the long form behind the panel.
6. **V3 Origin to use**.

**What I'd build first.** The panel (V1) as the collection's face, ordered by weight (V6), with coverage (V4) one step down, and V5's "I want to…" as the way in whenever someone takes data from it. The datasheet (V2) is the long form, with gaps as the keeper's tasks.
