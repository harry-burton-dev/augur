# Surface 4: Choosing the picture

An operator on a Department or Team floor turns a set of records into the right picture. They are guided by the question they want answered ("is it getting worse?", "which is biggest?", "where?"), not by a chart picker. In every variant the picture's title is the finding, filled from a fixed sentence template (ink). A model may only write pencil, and pencil is never a title.

All six pages share one sample organisation (Wealden and Coast Services, Fleet and Depots department) and one `DATA` object at the top of each page's script: 10 sites, 18 months of incidents, 34 vehicles, contracts, one event (night rounds, 2 March 2026, a document in Artifacts), one intent in Mandate, and the sentence templates. The pages are built from `_src/` (`node _src/build.js`). `data.js`, `lib.js` and `common.css` are shared, and each page has its own `vN-*.src.html`. Every finding is computed, not written by hand: change point, before/after means, per-site agreement and a yardstick word.

Every page uses the agreed marks for missing data:
- **No record** (wavy break): Harbour Road's February log didn't sync, so the total line breaks there instead of dropping to zero, and the page names who can fix it.
- **Not yours to see** (135° hatch, lock and whom to ask): Ridgeway yard is kept by Estates. It appears as "some", never as a count.
- **Stale** (45° hatch on the age): Harbour Road's vehicles were "checked 41 days ago".
- **Not known yet** (corner ticks): one contract value is missing, and the page names who could fill it.
- **Doesn't apply**: sites that keep no vehicles.

## Which pictures are offered, and which never are

**Offered: six forms, each the answer to one plain question.** The list is fixed, and an operator never sees a chart-type menu.

| Question | Picture | Rule it carries |
|---|---|---|
| Is it getting worse? | A line over time | One line (or two labelled groups), starting at zero, labelled at the end of the line instead of in a legend, the event marked on it |
| Which is biggest? | Bars, longest first | Horizontal bars starting at zero, names written out, what you can't see shown last and hatched |
| Where is it happening? | One equal tile per site, placed roughly where it is | Same size for every site, so big places don't win |
| How many? / What share? | Count with symbols (Isotype) | One symbol per record, symbols repeat and never grow, only for counts under about a hundred |
| Did it change after something? | Before and after (slope) | Needs a known event from Artifacts or Mandate; the confidence word stays at "a realistic possibility" for cause |
| Is it the same everywhere? | Small pictures on the same scale | One per site, a shared scale, the verb written on each |

Also offered: **no picture**, when two numbers say it better (word-size only, V6), and **the records** (always one step away).

**Never offered.** Each still appears on screen, crossed out, with the reason (explain, never hide):
- Pie or doughnut charts.
- Anything in 3D.
- Two scales on one chart.
- Gauges and dials.
- Bigger symbols for bigger numbers, scaled icons or bubbles.
- Bars that don't start at zero.
- Stacked or layered areas.
- Shaded maps of raw counts.

**Not offered here, but not banned:** "does one thing go with another?" (scatter, correlation). Two things moving together invites a cause-and-effect reading, so operators are sent to the Data team in Explorer. Word clouds, radar charts and animated "race" charts are not in the list at all and need no screen time.

## Where a model may write, and where text must come from templates

- **Template (ink), always:** the finding/title, the second line, the confidence sentence, every number, the "why this picture" line, the never-offered reasons and the notes about missing data. Each says "Finding · ink: filled from a fixed sentence, from N records".
- **Model (pencil), allowed:** reading free words into the sentence's slots (V3, V5), a possible reason or a second picture to send (V1, V2, V4), and a linking sentence in a briefing draft (V6). Pencil has a dashed edge, is in italics, sits in its own lane, links to its records, and keeps its dashes after it is accepted ("Accepted by PS today · still marked as the model's words").
- **G (model gateway off):** pencil disappears and a note says nothing on the picture or in the finding changed. In V3 the slots have to be picked by hand, and in V6 the linking sentence is gone while every number stays.

---

## V1: Question first (`v1-question-first.html`)
*Idea.* Six plain questions on the left, each naming the picture it gives. Pick one and the centre draws that one picture with its finding as the title, a second line and a confidence word. On the right are the model's note (pencil), "why this picture" and the never-offered list, struck through with reasons. V opens the records under the same title.

*Sources.* BLUF; Rosling and Our World in Data (one claim per chart, the title is the finding); the FT Visual Vocabulary, turned around so that the question is the menu.

*What works.* There are no chart words anywhere unless you press T. The six findings read as a briefing on their own. The "no record" break and the hatched Ridgeway row show that the picture is honest about what's missing. The page is cheap to build: one function per question.

*What fails or risks.* It is still a menu of six, and the operator has to know which of their worries fits which question. "Is it getting worse?" and "Did it change after something?" overlap. The never list is a lot of crossed-out text to sit beside every picture all day; it should fold away after the first week.

*Principles.* Explain-never-hide: strong (never list, notes, records one step away). Calm: the page draws once and then nothing moves. Focus stacking and letterbox: not used.

*Needs.* `--x-proposed-data`, `--x-proposed-data-ctx`, `--x-proposed-pencil*`. From Data Atlas: monthly counts per site, a "no record" flag per period (not zero), and events from Artifacts with dates.

*New employee test.* **Pass** (my judgement, not tested with a person). A manager reads the title and the "Nearly all of the rise is at the North depots" line in well under a minute.

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4.

## V2: The transformer's table (`v2-transformer.html`)
*Idea.* Neurath's "transformer" as a role. The page has three columns: records, then four questions (who reads it, what should they take away, what one symbol stands for, the rules check), then an Isotype plate. Vehicles are counted one truck at a time, lit for off the road and half lit for in the workshop. S switches to incidents drawn by kind. B shows the forbidden version, one scaled-up truck per depot, struck through.

*Sources.* Otto and Marie Neurath, Isotype and the transformer; Gerd Arntz's symbol rules.

*What works.* "6 of 34 vehicles can't go out today; 3 of them are at Northgate" is something you can count with your finger. The reader question (Tom, the Monday briefing) makes the operator think about the audience before the chart. B teaches the scaled-symbol rule in one keypress. Stale, doesn't-apply and not-yours-to-see each sit in their own row.

*What fails or risks.* Counting with symbols only works under about 100 records. The page has to refuse (or switch to bars) above that, and the limit needs a rule. Four steps are too many for a quick look, so they should default to answers already filled in. The truck symbol for "in the workshop" is the same glyph at a different brightness, which relies on contrast.

*Principles.* Explain-never-hide: strong. Calm: yes. Focus stacking: no.

*Needs.* A symbol per kind of thing (from the ontology: kind → Lucide name) and a status order per kind. `--x-proposed-data*` tokens.

*New employee test.* **Pass**: counting needs no legend beyond the key.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4.

## V3: Say it, then see it (`v3-claim-first.html`)
*Idea.* The operator types what they believe ("Incidents at all the depots have gone up since March"). The model reads it into a sentence with four slots, shown as dashed pencil selects. AUGUR checks it per site and answers **True / Partly true / Not true**. The corrected sentence, with struck and inserted words, becomes the picture's title. The picture is drawn to test the claim: the depots that agree against the rest. C cycles through four claims; each slot can be changed and the check reruns.

*Sources.* A subeditor's fact check; IPCC and UK probability yardstick wording; claim-checking practice (Full Fact).

*What works.* It starts where operators actually are, with a hunch. "Partly true: only because of 3 of 9" is the most useful sentence in the run, because it stops a wrong briefing before it is written. The slots make the model's reading visible and correctable, and with G off the same check works by hand.

*What fails or risks.* A verdict word can feel like being marked wrong; the tone needs care. The slot grammar covers change and "the most", but not every claim. Free text the model can't place needs an honest "I can't check that" (not built). The verdict colours (success and warning) are the only colour-coded state on the page and may read as alarms.

*Principles.* Explain-never-hide: strong. Calm: one reveal, then still. Letterbox: a "Not true" on something urgent could earn the urgent frame (not built).

*Needs.* Per-site, per-kind, per-month counts; an agreement rule (what counts as "rose" for a small site: here at least 0.5 a month and at least 25%); templates for verdicts and corrections in the deployment's language.

*New employee test.* **Pass** for the verdict and the corrected sentence. **Risky** for the chart (two averaged lines "each" needs the legend line).

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4.

## V4: Contact sheet (`v4-contact-sheet.html`)
*Idea.* Like a photographer's proof sheet: every honest picture of the records, each already titled with its finding and ordered by how much it says. Three never-offered pictures sit on the sheet too, dashed and struck through, with the reason. Arrow keys look and Enter circles one with a lit loop. The loupe on the right shows it full size, with notes, pencil and actions.

*Sources.* Photographers' contact sheets and chinagraph pencil; Rosling; small multiples.

*What works.* The operator never has to name their question; they recognise their finding among six sentences. It shows that one set of records holds several true stories, and the pencil suggests sending two together.

*What fails or risks.* It is heavy: six charts drawn on every open, which costs too much on large record sets (the thumbnails would need caching). Thumbnails are too small to read without the loupe, so the titles do all the work. Showing the forbidden charts drawn, even crossed out, may teach them. Ordering by "how much it says" needs a defensible score (here: change found > place > count).

*Principles.* Explain-never-hide: strong. Calm: one deposit and a single loop. Focus stacking: the loupe is a natural near plane (not used).

*Needs.* A "strength" per finding; cached thumbnails per record set; `--x-proposed-lit` for the loop.

*New employee test.* **Pass** if they read the titles; **fail** if they look at the thumbnails.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 3.

## V5: Field key (`v5-field-key.html`)
*Idea.* A dichotomous key, like a wild-flower guide: numbered couplets of two or three lines, dotted leaders, "go to 4" or a plate. The records answer what they can in database-marked notes ("Artifacts holds one event in these months…"). Dead ends are printed and struck through ("Each part as a slice of a whole: not offered"). The demo keys out "Did the night rounds make things worse?" to Plate C, before and after. A, B and C pick a line; Backspace steps back.

*Sources.* Dichotomous keys in field guides; the FT Visual Vocabulary; library decision charts.

*What works.* The whole decision logic is on one page. It is printable, and it explains why a picture isn't offered at the exact point you would have reached it. It would make the best guide page in docs.

*What fails or risks.* It is slow: three choices to reach a chart that V1 gives in one. Operators don't think in couplets. For daily use it is a teaching page, not a tool.

*Principles.* Explain-never-hide: the strongest. Calm: yes. Focus: the lit path (light language) shows the route taken.

*Needs.* Nothing new beyond V1, plus the shape facts (date span, events, site places).

*New employee test.* **Pass** for reading the key. **Too slow** as the way to get a picture.

*Score.* Clarity 3 · Distinctiveness 4 · Feasibility 5 · Fit 4.

## V6: The picture is in the sentence (`v6-in-the-sentence.html`)
*Idea.* There is no chart step at all. In a briefing draft in Artifacts, each sentence gets the picture its own words ask for. "Doubled… since March 2026" gives a word-size sparkline. "At the North depots" gives a 5×5 tile glyph. "Had the most" gives nine hairline bars. "14 of them" and "6 of 34" give rows of tiny symbols. The selected sentence shows full size in the margin, with the words that chose it underlined ("doubled · since March 2026 → a change over time → A line over time"). The three heights are 1 word, 2 margin and 3 records under the sentence. Template sentences have a solid edge (ink); the model's linking sentence is dashed and italic (pencil), and with G off it disappears while every number stays.

*Sources.* Tufte's sparklines and sidenotes; Bret Victor's ladder of abstraction; newspaper sidebars.

*What works.* This is where the prompt points: one fact at three heights in one place, a picture at word size inside the sentence, and pencil and ink side by side, showing exactly where a model may write. The operator never chooses a chart, because the sentence does. The "not offered for this sentence" line sits under each margin figure.

*What fails or risks.* Matching words to pictures is a rule set that must cover the deployment's language (templates make it tractable, because ink sentences carry their form). Word-size pictures of 34 symbols get noisy, so cap them, or switch to "6 of 34" text only. The minis for tiles and slope are too small to read; they are glyphs, not charts. It needs a lot from Artifacts (a sentence-level model).

*Principles.* Explain-never-hide: strong. Calm: still at rest. Focus stacking: the margin is a natural second plane.

*Needs.* Sentence blocks in Artifacts that carry their template id and record query; the word→form rule table; `--x-proposed-pencil*`.

*New employee test.* **Pass**: it reads as a normal document, and the pictures are extra.

*Score.* Clarity 5 · Distinctiveness 5 · Feasibility 3 · Fit 5.

---

## Ranked
1. **V6 In the sentence**: the destination. Pictures live where findings are used.
2. **V1 Question first**: the engine everything else stands on (question → one form → template title), and the cheapest to build.
3. **V3 Say it, then see it**: the "Partly true" check is the best guard against a wrong briefing; fold it into V6 as a check on any typed sentence.
4. **V2 Transformer's table**: keep its count-with-symbols rules and the B "try the forbidden version" teaching move.
5. **V4 Contact sheet**: good for "what's in these records?" on first open, too heavy for every day.
6. **V5 Field key**: it belongs in docs and the operator's printed guide, not in the product.

## What I'd build first
I'd build the **V1 engine as a small kit part with six forms and their templates**. Each question maps to one renderer and one sentence template, and the never list ships as data with reasons. Every form honours the marks for missing data (the wavy break is a gap in the line, never a zero) and has a fixed confidence-word rule. Then I'd put that engine behind **V6's sentence blocks** in Artifacts: an ink sentence carries its template id and its record query, so its picture, word-size glyph and records come for free at three heights. A model's sentence stays pencil until accepted. Last, I'd add **V3's check** to any sentence a person types into a briefing ("Partly true: only 3 of 9"). Everything here runs without the model gateway; the model only proposes wording and a second picture.

## Where this goes beyond the ask, and pushes back
- **Cause is capped.** Any "after X" finding says at most "a realistic possibility", whatever the data shows, because a before/after picture can't test why. Harbour Road, Ridgeway and Ashby Cross are the cases that would mislead a reader if it didn't.
- **Isotype needs a ceiling.** Count with symbols only under about 100 records; above that the same question gets bars. This needs Harry's decision on the number.
- **Explain-never-hide versus showing forbidden charts.** V4 draws them crossed out; V1, V3 and V6 only name them. I recommend naming, not drawing.
- **"No record" is not zero.** A missed sync must break the line. That needs Data Atlas to keep "no record for this period" apart from "none".

## Needs token (all are mixes of kit tokens, listed at the top of `_src/common.css`)
- `--x-proposed-data`: the series a finding is about.
- `--x-proposed-data-ctx`: the context series.
- `--x-proposed-pencil`, `--x-proposed-pencil-wash`: model text.
- `--x-proposed-gap*`, `--x-proposed-stale`, `--x-proposed-unseen`, `--x-proposed-hatch`: the marks for missing data, from the catalogue.
- `--x-proposed-quiet`, `--x-proposed-here`, `--x-proposed-type-micro`, `--x-proposed-lit`, `--x-proposed-lit-wash`.
- `--font-mono` for numerals still needs an ADR.

## Data the shell doesn't have yet
- Per-period "no record" flags.
- Events with dates (from Artifacts and Mandate) for before/after.
- A symbol per kind of thing.
- Site places in a coarse grid for tile maps.
- Per-site, per-kind counts that are safe across floors ("some" for hidden ones).
- Sentence blocks in Artifacts that carry a template id and query.
- A word→form rule table per deployment language.
