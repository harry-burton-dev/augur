# Grammar: the briefing sheet

Six reference sheets for the run's vocabulary: **bottom line, picture, workings, height (headline, picture, records), confidence word**. Each says how a part is drawn, gives its recipe from kit tokens, and says what it must never claim. All six use the same briefing as their specimen, "Missed collections, North district", for Marta Kowal (North depot lead). The data is one `DATA` object (`_src/data.js`): 285 incident records generated from a fixed seed, weekly counts with one week that has no record, three sources with Data Atlas grades that disagree, the six ways to be empty, one Mandate intent and three ways to act. `_src/build.js` inlines the kit-independent common CSS, the data and common JS into each page. Every number on every sheet is computed from the records, so the sheets can check that the heights agree.

Keys on every sheet: **R** replays, **T** shows technical words one step down, and **G** (except V4) turns the assistant (model gateway) off. Each sheet plays its moment about 1.2 s after load. Checked at 1600×900 and 1280×800, with T and G on, and with reduced motion. No console errors. The "new employee test" verdicts are my own judgement of a first read, not tests with people.

## The vocabulary (what all six agree on)

| Part | Drawn as | Recipe | Never claims |
|---|---|---|---|
| **Bottom line** | Two sentences at most, first. Sentence 1: what changed and by how much (template, ink). Sentence 2: what it means, with the confidence word inline | `--type-heading`/300/`--light`, max `--measure-read`, 2px rule in the colour of the floor it is kept on (`--x-proposed-here`) | A number the records don't hold, a word stronger than its claim allows, a sentence with no claim behind it |
| **Picture** | One picture, one claim; the title is the finding, worded by rule from the numbers ("more than doubled"); from zero; the event as a dashed rule; a week with no record as a wavy break | data `--x-proposed-data-ink`, the finding `--light`, event `--x-proposed-event` dashed; Isotype symbols are Lucide icons, one per N records, the last one cut | An axis that starts above zero, a gap drawn as a dip, a symbol scaled up, colour as the only difference |
| **Workings** | Numbered steps in plain words with the count each step left; the left-out step stays, in `--ink-muted`, with its empty mark | `--font-mono` numbers in a `--space-5` column, counts right-aligned | Being complete beyond its sources; hiding a step that changed the answer |
| **Height** | Headline, picture, records. The number stays where it is while the height changes; the three must add up to the same digits | rungs in a `--measure-rail` column; current rung `--light` with a glow; moves over `--motion-slow` | Different numbers at different heights |
| **Confidence word** | One of seven fixed words (the UK probability yardstick), with a seven-cell yardstick at word size. Chosen **by rule** from grades × agreement (the IPCC's evidence × agreement grid). A person may lower it; raising it takes another source. **Counts take no word**: they are "recorded", and what they need instead is their coverage | word in `--ink`, never italic (italic is pencil); cells `--space-1`, on `--x-proposed-yard-on`, off `--x-proposed-yard-off`; "recorded" chip | A percentage, a word on a count, a word stronger than its grid cell, a word a model chose |

**Pencil** (from the reference desk) runs across all five: a model may write only a *suggested wording* of the bottom line for a named reader, in its own lane, dotted and italic. It adds no number, no word and no claim, and links to the ink claims it rewords. When a person accepts it, it becomes ink with a "drafted by the assistant, accepted by …" line. G removes it, and no number on any sheet changes.

**Where a model may write, and where text must come from templates** (the same on all six sheets):

| Text | Who writes it |
|---|---|
| Sentence 1 of the bottom line, picture titles, workings steps, empty sentences, tallies, counts | Templates, filled from Data Atlas. Never a model |
| The confidence word | A rule over grades and agreement. A person may lower it |
| Sentence 2 (what it means) | A template with the word slot; a person may rewrite it within the same claims |
| A wording for one reader ("Marta, …") | The model, in pencil, until a person accepts it |
| The records | Data Atlas |

---

## V1: Annotated specimen
*Idea.* The grammar as a type specimen: one real briefing in the middle, its six parts called out with leader lines (name, how it's drawn, token recipe, never claims), and the sixth callout is "what a model may write". Keys 1-6 pull focus to one part and blur the rest back (rack focus). H changes height in place.

*Sources.* Type foundry specimen sheets; Our World in Data chart anatomy; engineering drawing callouts; BLUF.

*What works.* It is the one sheet a developer and an operator can both use: the briefing reads as a briefing, and the callouts are the kit documentation. Rack focus makes "this part, and only this" obvious. The tally chip after "32" (126 records) shows "how do you know?" at word size.

*What fails or risks.* The leader lines get busy, and at 1280 the callouts lose their recipes. The "never claims" lines are read once and then ignored. It documents the grammar but doesn't argue for anything: it has no idea of its own.

*Principles.* Explain-never-hide: strong (the not-yours-to-see and out-of-date lines stay on the card). Focus stacking: yes. Calm: the leaders draw once. Letterbox: not used.

*Needs.* `--x-proposed-here`, `--x-proposed-data-ink/-finding`, `--x-proposed-event`, the tally chip as a kit part.

*New employee test.* **Pass**: a manager reads the briefing in the middle without looking at the callouts.

*Model vs template.* The pencil callout states the boundary. Everything else is a template.

*Score.* Clarity 4 · Distinctiveness 2 · Feasibility 5 · Fit 4.

## V2: The yardstick
*Idea.* The confidence word as a ruler: seven bands, with the gaps between them left empty on purpose. Under it is the grid that picks the word (evidence, from the grades, against agreement). Next to that, a claim gathers its sources one by one. The moment: the round maps (A) give "likely", the crew notes (B) raise it to "highly likely", and Greenway's report (C, disagrees) drops it back to "likely". A pencilled guess from the assistant appears and moves nothing. A box on the left says **counts take no word**.

*Sources.* UK Defence Intelligence probability yardstick (PHIA 2019); IPCC calibrated language (evidence × agreement); Admiralty source grading.

*What works.* The strongest single idea of the six. The word is computed, not chosen, so it can't drift, and a person can only lower it. "Counts take no word" settles a confusion every other sheet had: "likely" on a recorded count is wrong, and what a count needs is its coverage (week 41 has no record). The deliberate gaps ("no one argues 74 against 76") explain themselves.

*What fails or risks.* The grid is a policy decision dressed as design. The cell values (for example "strong evidence, one disagrees, so likely") need Harry's sign-off and maybe a statistician's. Seven words may be too many for operators; the ruler shows them, but briefings will mostly use three. "We can't say yet" must not become a way to dodge every judgement.

*Principles.* Explain-never-hide: the grid explains every word. Calm: one sweep, then still. Focus stacking and letterbox: not used.

*Needs.* Source grades on every observation in Data Atlas (A/B/C plus "guess"); a stored agreement per claim; the grid as deployment configuration; `--x-proposed-yard-on/off`.

*New employee test.* **Pass** for the words ("likely" needs no legend). **Borderline** for the grid, which a manager won't read; it is for the person writing the briefing.

*Model vs template.* The model never picks the word. A model's "source" is pencil and is never counted.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4.

## V3: The ladder of heights
*Idea.* A real ladder (two rails, three rungs). The number "32 missed collections a week" is pinned at the top of the stage while the height changes underneath: a sentence with a sparkline, then a **unit chart where every cell is a record** (filled when on a narrow street), then the 126 rows grouped as the picture grouped them. A strip at the foot checks the sums: headline 32 = 126 cells ÷ 4 weeks = 126 rows ÷ 4, they agree.

*Sources.* Bret Victor, "Up and Down the Ladder of Abstraction"; unit charts / Isotype; the overview rung; focal planes (the far height blurs out).

*What works.* The pinned number is the clearest answer to "moving between a summary and its cases without losing your place". The unit chart makes the picture and the records the same marks at two sizes, so stepping down never changes what you're counting. The sum check is a rule the software can enforce.

*What fails or risks.* A unit chart stops working above a few hundred records per column; at org scale the picture rung needs the Isotype rule (one symbol = N). Sitting between the rungs, workings are less visible here than on any other sheet. The sum check reads as debugging to an operator.

*Principles.* Focus stacking: strong. Explain-never-hide: the week with no record is drawn at every height. Calm: one move.

*Needs.* A "height" for every Data Atlas answer (a headline template, a picture spec, a records query) that share one query, so they can't differ.

*New employee test.* **Pass** at the headline and picture heights; the records height is for whoever asks.

*Model vs template.* A model may pencil the headline's wording only; nothing it writes appears below the headline.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5.

## V4: The transformer's sheet
*Idea.* The picture grammar. On the left, 285 records start as dots, one row per week, and are counted into Isotype symbols (one symbol = 5, the last one cut). On the right, the pictures an operator is **offered by the question they ask** (how many, has it changed, which is most, what share, in a sentence), each with its "never" twin crossed out (a scaled icon, an axis from 9, a pie, a line through a missing week, a sparkline with no sentence).

*Sources.* Otto and Marie Neurath and Gerd Arntz (Isotype, the transformer); Rosling and Our World in Data (the title is the finding); Tufte (sparklines).

*What works.* It answers the shortlist question "which charts, and which never" in one view: five question-led pictures, plus a list never offered (two scales, stacked areas, maps shaded by totals, gauges, unlabelled forecasts). Counting dots into symbols teaches "a symbol is a fixed number of records" without words.

*What fails or risks.* The crossed-out twins add noise: showing the bad chart, even struck through, teaches it a little. Isotype symbols take more space than bars and don't scale past about 10 per row. The "transformer's checks" can't be a separate step in practice: they must run before a picture is ever offered.

*Principles.* Explain-never-hide: the missing week says "not drawn as a short row". Calm: one transformation. Focus stacking and letterbox: not used.

*Needs.* A picture picker in Data Atlas keyed by question, not chart type; a symbol per kind of thing (Lucide name in the ontology); a fixed unit per picture.

*New employee test.* **Pass** for the Isotype rows ("one bin = 5" is read at once). **Fail** for the never column, which a manager doesn't need.

*Model vs template.* The model has no role. Pictures and titles are rules.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 3.

## V5: The appreciation
*Idea.* A staff appreciation with paragraphs in a fixed order: bottom line, what we know, what we judge, what we don't know, what it means for you. On the right, three **lanes** say who wrote each line: the records (ink, template), a person by rule (ink, signed), the assistant (pencil). The moment: the assistant's suggested wording for Marta waits in the pencil lane with a lit Accept; once accepted it moves to the person lane with "drafted by the assistant, accepted by Sam Okafor". G empties the pencil lane, and the counter "numbers on this paper: 10" doesn't move.

*Sources.* The military appreciation and BLUF; Admiralty source grading; pencil and ink (the reference desk).

*What works.* It answers "where may a model write?" by showing it: one lane, visible on every line. The fixed order puts knowledge before judgement, and judgement before gaps, so a reader always knows where a kind of sentence lives. "What we judge" shows a claim with **no** word ("we can't say yet") and what would settle it, which no other sheet does.

*What fails or risks.* Lanes are a reviewer's tool; a manager reading the final briefing doesn't need them (hide them on publish, keep them one step down). The paper scrolls at 1280. A fixed order may feel bureaucratic for a two-line briefing.

*Principles.* Explain-never-hide: strong. Calm: one acceptance. Letterbox: not used.

*Needs.* Line-level provenance on Artifacts briefings (template, person, model, accepted by), and a "numbers on this page" check the editor runs.

*New employee test.* **Pass**: the order is how a manager already reads a staff paper.

*Model vs template.* Shown line by line: records lane = template, person lane = rule or a person, pencil lane = model.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4.

## V6: The reader's minute
*Idea.* A manager gives a briefing a minute. A time ruler beside the sheet gives each part its start time and length, **measured from its own words** at the deployment's reading speed (200 a minute) plus a fixed time for the picture. The budget panel compares each part with its share. The moment: a read-through at ten times speed, with focus following the playhead. It found that **the run's own specimen takes 68 s**: workings and gaps run long. C cuts to the minute (58 s), and the cut lines wait one step away; nothing is deleted.

*Sources.* The newspaper inverted pyramid; BLUF; reading-time estimates (Medium and others); eye-tracking studies of how far readers get.

*What works.* The only sheet that measures the briefing rather than describing it, and it caught a real fault in the template every other sheet uses. The budget turns "keep it short" into a rule with a number, configurable per deployment.

*What fails or risks.* Word counts are a crude stand-in for reading time; a dense number costs more than a word. A budget invites gaming (cutting the gaps paragraph first is exactly wrong: explain-never-hide must outrank the minute). The ruler's lengths follow the layout, not time.

*Principles.* Explain-never-hide: at risk, since the cut must never remove an empty that touches the bottom line (the cut keeps "not yours to see"). Calm: the read-through plays once. Focus stacking: yes.

*Needs.* Per-deployment budgets (`DATA.minute`); a rule that some lines can't be cut.

*New employee test.* **Pass**: "58 s to read" is self-explanatory.

*Model vs template.* Pencil text doesn't count towards the minute until a person accepts it. The model could *propose* cuts (pencil), but never make them.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4.

---

## Scores

| Variant | Clarity | Distinct. | Feasibility | Fit | Total |
|---|---|---|---|---|---|
| V2 Yardstick | 5 | 4 | 4 | 4 | 17 |
| V5 Appreciation | 5 | 4 | 4 | 4 | 17 |
| V3 Ladder | 4 | 4 | 4 | 5 | 17 |
| V6 Reader's minute | 4 | 5 | 3 | 4 | 16 |
| V4 Transformer | 4 | 4 | 4 | 3 | 15 |
| V1 Annotated specimen | 4 | 2 | 5 | 4 | 15 |

## Ranked
1. **V2 Yardstick**: the confidence word chosen by rule, and "counts take no word". Every other surface depends on it.
2. **V5 Appreciation**: fixed order plus the lanes; the clearest answer to where a model may write.
3. **V3 Ladder**: the pinned number and the sum check across heights.
4. **V6 Reader's minute**: budgets measured from words; it caught the specimen running 68 s.
5. **V4 Transformer**: the question-led picture offer (feeds the "choosing the picture" surface).
6. **V1 Annotated specimen**: the right format for the kit reference, but no idea of its own.

## What I'd build first
The **confidence word as one kit part**: the word, its seven-cell yardstick, and the "recorded" chip for counts. Behind it sits a Data Atlas rule that picks the strongest word allowed from source grades × agreement, which a person can lower and never raise. It is small (one component, two tokens, one configuration table), it removes the most dangerous freedom in a briefing (a model or a hurried person writing "almost certain"), and every other part refers to it. Next, the **tally chip** (the count of records behind a claim, opening them) and the **same-digits check** from V3, so that a headline can't be published if its records don't add up to it. Use V1's annotated-specimen layout for the kit documentation of all three.

## Needs token (proposed, all mixes of kit tokens)
`--x-proposed-type-micro`, `--x-proposed-quiet`, `--x-proposed-here` (floor of the briefing), `--x-proposed-pencil-ink`, `--x-proposed-pencil-edge`, `--x-proposed-data-ink`, `--x-proposed-data-finding`, `--x-proposed-event`, `--x-proposed-yard-on`, `--x-proposed-yard-off`, `--x-proposed-tally-edge`, `--x-proposed-disagree(-wash)`, `--x-proposed-lit(-wash)`, the six empty marks from the catalogue run (`--x-proposed-gap*`, `--x-proposed-stale`, `--x-proposed-unseen`, `--x-proposed-hatch`), and V5's `--x-proposed-lane-w`. Every sheet relies on `--font-mono` (still needs an ADR).

## Data the shell and apps don't have yet
- A grade on every observation (A kept record, B checked, C reported), and "guess" for model proposals, which never count.
- Agreement per claim (all agree / one disagrees / split), computed from observations.
- The word grid and the yardstick as deployment configuration.
- Declared gaps in a record series ("no record, 5 to 11 Oct") as events, so pictures can draw them.
- Line-level provenance in Artifacts briefings (template, person, model, accepted by).
- A shared query behind the three heights, so headline, picture and records can't differ.
- Reading budgets per deployment.

## Where this pushes back
- The prompt's example "likely" was for any finding. On these sheets **a count never takes a yardstick word**; it is recorded, and it says its coverage. Only judgements (cause, forecast) take a word.
- The yardstick's seven words are more than operators need. Show all seven on the ruler, but expect briefings to use mostly "likely", "highly likely" and "we can't say yet".
