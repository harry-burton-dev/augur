# Confidence for everyone

Six ways to put one fixed set of confidence words on every claim in a briefing, worked out from Data Atlas source grades and agreement, and never left to a footnote. All six use the same briefing ("North waste round: renew Calder Waste?", Vale Regional Services, Facilities on the Department floor, for Jo Reyes). They share one `DATA` object and one rule in `_src/common.js`, which `_src/build.py` inlines into each page. Every page plays its moment about 1.2 s after load. **R** replays, **T** shows the technical register one step down, and **G** turns the assistant (the model gateway) off. Each page was checked at 1600×900 and 1280×800, and with T and G on, with no console errors (`_src/keys.js` presses keys and takes the screenshots).

New employee test verdicts are my own judgement of a first read, not tests with people.

## The yardstick (all six agree)

Five words in a fixed order. Each word is the result of **one rule** over the claim's observations. Nobody types the word: not the writer, not a model.

| Word | Rule (plain) | One step down (T) |
|---|---|---|
| Almost certain | Two or more sources agree, one of them a source we usually trust. None disagree. | ≥2 independent · best strong · 0 against |
| Very likely | One source we usually trust, or two fair ones that agree. None disagree. | 1 strong, or ≥2 with best fair |
| Likely | One fair source, or two weak ones that agree. | 1 fair, or ≥2 weak |
| Possible | One weak or ungraded source, and nothing to check it against. | 1 weak or ungraded |
| Unlikely | Better sources say otherwise, with at least twice the weight against it. | weight against ≥ 2 × weight for |

*Source strength* comes from the NATO grade Data Atlas already stores (`B2`). **Strong** is A or B with credibility 1 or 2, **fair** is up to C with credibility 3 or better, and anything else (including no grade) is **weak**. Weights are 3, 2 and 1. When two sides weigh within 2× of each other, the claim is a **dispute**. When one side outweighs the other by 2× or more, the winning side drops one word and the losing side is **unlikely**.

**Four states that are not on the yardstick.** They get no word, and each has its own mark from the catalogue's six ways to be empty:

| State | Why no word | Mark | What the reader does |
|---|---|---|---|
| Sources disagree | Nothing is settled; each side alone would get its own word | warning-tinted edge, both answers printed | don't pick one; a named lead decides |
| Not known yet | Nothing to weigh | four corner ticks, the shape of the answer | don't guess, never say "unlikely"; a named person could fill it |
| Out of date | Its word was true then, not now | 45° hatch; the old word in the past tense | say what it was and when; ask for a fresh copy |
| Not yours to see | You can't weigh what you can't open | 135° hatch and a lock | ask the named person |

**How a dispute and a gap read differently from a weak fact** (the surface's main question). A weak fact is *on* the scale, low, and still usable if you say the word with it ("it is possible that…"). A dispute is *lifted off* the scale: two answers joined by a bracket, each placed where it would sit alone, and the briefing prints both. A gap sits *below* the scale ("below weak, not beside it"): it has no value to print, only a shaped blank. Each states a different next step: find one more source, ask a lead to decide, or ask someone to fill it in. V2 shows this most clearly as places on a grid, and V6 as one claim moving through all of them over time.

**Pencil and ink, carried from the reference desk.** A model may write prose: the bottom line, or the clause after a key judgement's word. That prose is pencil (dotted edge, italic, cooler ink, its own lane) until a person accepts it. The word, counts, sources, the "why" sentence and the "what would change it" sentence are always ink, made from templates. A pencil summary carries a line saying it is "no surer than its weakest claim", and it names that claim. Pressing G removes the pencil and puts template sentences in its place, and no word, count or position changes.

---

## V1: The yardstick beside the page
*Idea.* The briefing reads as normal prose, but every claim **starts with its word** in a fixed left column. A fixed vertical ruler beside the page holds the five rungs with their rules, and each claim is a numbered dot on its rung. Disputes are drawn as a bracket in their own "disagree" lane next to the ruler, joining the two rungs the sides would reach alone. A gap and "not yours to see" sit in boxes under the ruler, off the scale. Selecting a claim lights its dot and fills a "How we know" panel with the sources, their grades in plain words, why the word follows, and what would change it.

*Sources.* The UK PHIA probability yardstick (printed on the page of every assessment); Sherman Kent's "Words of estimative probability" (1964).

*What works.* It is an ordinary briefing first: the word column adds almost no reading cost and a manager reads straight down it. The ruler teaches the yardstick without a legend, because the rules sit next to the words. "What would change it" turns a low word into a job for someone. The pencil bottom line with "no surer than its weakest: depot audit, not known yet" is the strongest single line on any page here.

*What fails or risks.* Two places say the same thing (the word column and the dot), which could look redundant once people know the scale. The ruler needs about 520 px, and at 1280 the "What is open" section scrolls below the fold. The dispute bracket is drawn from layout measurements (`getBoundingClientRect`), which is fragile in React and needs a resize observer. The old word of an out-of-date fact sits as a hatched dot on its rung, which could read as "still very likely" at a glance.

*Principles.* Explain-never-hide: strong (each word's rule is on screen; open items get their own section, not a footnote). Calm: dots drop once, then nothing moves. Focus stacking: the lit row and dot are the lit path. Letterbox: not used.

*Needs.* `--x-proposed-rung-0…4`, `--x-proposed-stick-cell`, the six-empties tokens, the pencil tokens. Data: a `derive()` service in Data Atlas that returns `{kind, rung, why, next}` per claim, and claims in Artifacts that link to facts.

*New employee test.* **Pass.** The word comes before the sentence, so it can't be missed.

*Model vs template.* Model: the bottom line only, in pencil. Template: every word, the "why", "what would change it", the ruler.

*Score.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4.

## V2: Two questions, one place
*Idea.* The IPCC's confidence matrix in plain words. Rows ask how good the best source is (usually trusted, fair, weak or ungraded) and columns ask whether the sources agree (one source, two or more agree). Each cell is printed with its word, and each claim is a chip in a cell, so **the place gives the word**. A separate "They disagree" column sits to the left. A "No sources yet" strip sits *below* the grid with corner ticks, and a hatched "Can't see the sources" strip sits under that. The moment draws three dashed arrows for how each kind of doubt moves: the weak fact gets one more source, the dispute gets a lead's decision, the gap gets someone's answer.

*Sources.* The IPCC AR5 guidance note on consistent treatment of uncertainties (Mastrandrea et al. 2010): evidence × agreement → confidence.

*What works.* It is the only variant that shows *why* a dispute and a gap are not low confidence: they sit on different axes. The arrows make "what would make it surer" visible as a direction. Leads and admins would use it to check the rule itself. The side panel's "three ways to be unsure" is clear and could stand alone.

*What fails or risks.* It is a chart about the briefing, not the briefing itself, so a manager has to learn two axes before reading anything. Several chips crowd one cell when a briefing has many strong claims. The arrows and labels are positioned by measurement and collide at 1280 (I kept the labels short so they fit). Unlikely and disputes share a column, which blurs the split between "outweighed" and "balanced".

*Principles.* Explain-never-hide: very strong. Calm: chips settle once and the arrows stay drawn. Focus stacking: not really. Letterbox: no.

*Needs.* The same tokens. Data: the strength of each observation exposed per claim. A matrix part with layout-safe arrows (CSS anchor positioning or SVG in grid coordinates).

*New employee test.* **Partial.** An operator gets it after one look, a manager probably not in a minute. Better as the "How sure is this briefing?" page one step down than as the front.

*Model vs template.* Nothing here is written by a model. G says so and changes nothing.

*Score.* Clarity 3 · Distinctiveness 4 · Feasibility 4 · Fit 3.

## V3: Counted sources
*Idea.* An Isotype table. Each claim row shows **one figure per source**: sources for grow left from a central spine, sources against grow right. Fill encodes strength (solid for a source we usually trust, outline for fair, dashed for weak or ungraded), and the Lucide glyph says what kind of source it is (document, record, person). The word is read off the count in the last column. A dispute shows figures on both sides and turns the spine warning-coloured. A gap shows one corner-ticked "?" slot labelled with who could say. Not yours to see is a hatched block across the spine. Selecting a row opens its records underneath.

*Sources.* Otto and Marie Neurath's Isotype (counting with repeated symbols, the transformer's key); diverging bar charts.

*What works.* People can count. "Two solid figures, nothing against" needs no teaching, and the key is four items. A weak fact (one dashed figure), a dispute (figures on both sides) and a gap (an empty slot) look different at a glance, and that difference is the brief of this surface. The one-sentence summary at the top ("4 of 10 claims rest on sources that agree…") is a template and reads as a bottom line.

*What fails or risks.* Weight is only implied by the fill, so the 2× rule can't be checked by eye. Five sources versus two would look decisive even when the five are weak. Long claims squeeze the figure columns at 1280. The figures are icons inside circles, so at 24 px "record" and "document" are hard to tell apart.

*Principles.* Explain-never-hide: strong. Calm: figures count in once. Focus stacking: the lit row. Letterbox: no.

*Needs.* `--x-proposed-unit` (one counted source, a fixed size across briefings). Data: source kind (document, record, person) on observations, and independence (two records copied from one origin must count as one figure, which Data Atlas can't tell yet).

*New employee test.* **Pass.** I think this is the fastest read of the six for a sceptical manager ("how many sources?").

*Model vs template.* All template, G changes nothing (it says so).

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4.

## V4: The bar this decision sets
*Idea.* The briefing feeds a Mandate intent ("Decide on the North waste contract", due 15 Dec), and each decision kind carries a **standard of proof**: "Renew or end a contract" asks for *very likely or better*. Claims sort into three columns: **Clear the bar** (rely on these), **Below the bar** (use them, and say the word), and **Needs someone first**, where disputes, gaps, out-of-date facts and hidden facts sit with a named person and an "Ask" or "Ask to decide" button. A vertical lit line marks the bar. The verdict is a template: "Not ready to decide. 4 things need someone before 15 Dec; 3 claims are below the bar." Keys 1-4 preview another bar and the cards slide between columns.

*Sources.* Standards of proof in law (balance of probabilities, beyond reasonable doubt); military decision points; Mandate's own intents.

*What works.* Confidence becomes a decision, not a decoration, so a manager reads the verdict in two seconds. It answers "how does a dispute differ from a weak fact" in the most practical way: a weak fact can be used below the bar with its word, while a dispute or gap blocks the decision whatever the bar. An outweighed claim is restated as what the better sources say ("the depot log and complaints show only 4 of 124") with Calder's version marked unlikely, which is how a staff officer would brief it. The "Needs someone first" column is a ready-made task list.

*What fails or risks.* Who sets the bar is a governance question: if anyone can lower it, it means nothing (here the preview says "the briefing still asks for very likely"). Three columns hide the order of the argument, because the prose of the briefing is gone. Out of date and not yours to see are grouped with disputes and gaps as "needs someone"; that is right for this decision, but they differ in kind (V1 and V5 keep them apart). The FLIP animation on bar change is not free on large briefings, but it is fine for 10-30 claims.

*Principles.* Explain-never-hide: strong (nothing below the bar is hidden; it is said with its word). Calm: one sort on load. Letterbox: a candidate: "Not ready to decide" with a deadline close is a PDR-009 moment, and the verdict sentence is the urgent sentence. Focus stacking: no.

*Needs.* A **standard per decision kind** in Mandate (new data). "Ask" and "Ask to decide" create requests to named people, which Mandate or the shell's approvals would carry. The lit bar line (`--x-proposed-lit`).

*New employee test.* **Pass**, and the strongest of the six: "not ready, 4 things need someone" needs no legend.

*Model vs template.* The verdict and sorting are templates. A model could draft the bottom line above the columns, in pencil, but it must never move a card.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4.

## V5: The assessment sheet
*Idea.* A landscape briefing sheet laid out like a JIC assessment, with the yardstick **printed on the sheet**: a five-cell key above the text, not a footnote. Key judgements are listed surest first, and each opens with a **stamped phrase in ink**: "IT IS VERY LIKELY THAT". The stamp is set by the rule, and the rest of the sentence may be pencil (drafted by the model, dotted underline, italic) until the writer accepts it. The right column holds "Where sources disagree" as a boxed alternative view with both answers equal and the person who decides, and "What we don't know" as lines left to fill: corner-ticked for a gap, hatched for out of date, hatched with a lock for not yours to see. The moment stamps the words in one by one.

*Sources.* UK Joint Intelligence Committee assessments (key judgements, alternative views, intelligence gaps); the PHIA yardstick key; Kent's estimative language.

*What works.* It is a format managers already trust, and it prints. The ink stamp plus pencil clause is the clearest split of "rule" and "writer" in the run: you can see within one sentence which part a model wrote. The "≠ unsure" line in the dispute box ("each side alone would be very likely and likely") says plainly that a dispute is not low confidence. Gaps as blank lines to fill read as work, not failure.

*What fails or risks.* The stamped all-caps phrase is heavy across many judgements, and fourteen boxes would shout. A lighter treatment (small caps, no box) may be needed. Model prose can quietly overstate a claim: "missed collections have more than doubled" is true here, but a draft could drift beyond its claim. The pencil must be checked against the claim, not just accepted. It also lists "surest first", which is not always the order the argument needs.

*Principles.* Explain-never-hide: very strong. Calm: stamps land once. Focus stacking and letterbox: no.

*Needs.* Per-claim model drafts with a check that the draft says no more than its claim (an entailment test, or a person). An "accepted by" record for each pencil clause. The stamp style as a kit part.

*New employee test.* **Pass.** It looks like a document a manager has seen before.

*Model vs template.* Model: the clause after each stamp, in pencil. Template: stamps, key, dispute box, the blanks, the footer counts. With G off, each clause becomes the claim's own sentence.

*Score.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4.

## V6: A claim over time
*Idea.* One detail (vehicles on the North round) followed through six dated events. Its marker moves along a big horizontal yardstick as it goes from **not known yet** (in a corner-ticked zone left of the scale), to **possible** (one ungraded phone note), to **almost certain** (the contract schedule agrees), to **sources disagree** (the depot log and a site count say 7; both pills lift into the disagree lane above the scale, joined by a bracket), to **almost certain** again once Jo Reyes decides (the 9 stays visible, struck through, "set aside, kept"), to **out of date** a year later (the marker keeps its old place, hatched). Under the track, the briefing's own sentence and "what the reader does" change with each step. A filmstrip of the six steps runs along the bottom.

*Sources.* Intelligence indicators and warnings (what would change our mind); the yardstick; Bret Victor's explorable explanations.

*What works.* It is the best explainer of the six: it shows that a dispute is not a lower rung but a different state, and that new evidence can make you *less* settled. The "set aside, kept" pill shows a lead's decision without deleting the losing side. It would make a strong first-run tour or help page. It would also suit a claim's "History" tab in Data Atlas.

*What fails or risks.* It shows one claim, not a briefing, so it is not the daily surface. Real histories are messier (sources retracted, grades changed), and the track would need to show both. The two pills in the dispute lane are positioned by JS. At step 3 both sides would be "almost certain" alone, which is true to the rule but may confuse: two sure sources disagreeing *should* worry people more than two weak ones.

*Principles.* Explain-never-hide: strong. Calm: plays once to the dispute, then stops; P plays the rest. Focus stacking: the lit step. Letterbox: no.

*Needs.* The observation history per detail with dates (Data Atlas has it: observations are never changed). A lead's decision as an event that keeps the set-aside side. A review age per detail, for out of date.

*New employee test.* **Pass as teaching**, not as a briefing.

*Model vs template.* Nothing model-written.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4.

---

## Ranked

1. **V4 The bar this decision sets.** It turns confidence into "ready or not", and blockers into named jobs.
2. **V1 The yardstick beside the page.** The everyday briefing: word first, one ruler, how we know.
3. **V5 The assessment sheet.** The print and export form, with the clearest pencil and ink split inside a sentence.
4. **V3 Counted sources.** The fastest "how do you know?" for a sceptic; worth keeping as the records view.
5. **V6 A claim over time.** The teaching page, and a claim's History tab.
6. **V2 Two questions, one place.** The rule made visible; for leads and admins, one step down.

## What I'd build first

The **rule and the word**, before any layout. That means a `derive()` in Data Atlas returning `{kind, rung, why, next}` for a fact or a set of observations. The rule stays fixed org-wide and versioned like the ontology, and it is never stored on the claim. It also means one kit part, the confidence word (plain word, word-size yardstick, a title with its rule, the T line). Then I'd build V1's briefing layout as the default reading view in Artifacts, with V4's bar strip as its header whenever the briefing feeds a Mandate intent: the verdict sentence and "needs someone first" list sit on top, and the word-first prose reads below. V5's stamp-plus-pencil becomes the export format. V3's figures replace the "How we know" source list. V6 becomes the help page. I went beyond the ask in one place: V4's **standard per decision kind** is a new idea for Mandate, not something the prompt asked for, and it needs Harry's decision.

## Needs token (all mixes of kit tokens)
- `--x-proposed-rung-0…4`: ink by rung. Brightness only steps down; it never turns into a traffic light.
- `--x-proposed-stick-cell`: one cell of the word-size yardstick.
- `--x-proposed-unit`: one counted source (V3).
- From earlier runs, reused: `--x-proposed-gap*`, `--x-proposed-stale`, `--x-proposed-unseen`, `--x-proposed-disagree*`, `--x-proposed-pencil*`, `--x-proposed-quiet`, `--x-proposed-lit*`, `--x-proposed-here`, `--x-proposed-type-micro`.
- `--font-mono` is used for numbers and eyebrows and still needs an ADR.
- JS uses a few pixel offsets to place arrows, pills and brackets (V1, V2, V6). A React build should use grid coordinates instead.

## Data the shell and apps don't have yet
- **Source independence.** Two records copied from one origin must count once. Observations need "derived from".
- **A grade on every observation.** Ungraded counts as weak, so triage should ask for one.
- **A review age per detail**, for out of date.
- **Expected details**, for not known yet (the same need as the catalogue).
- **Who decides a dispute** and **who could fill a gap**, per floor and detail.
- **A lead's decision on a dispute as an event**, which keeps the set-aside side visible.
- **A standard of proof per decision kind** in Mandate (V4).
- **Claims in Artifacts briefings bound to Data Atlas facts**, so a word can be computed and recomputed when a source is withdrawn.

## Where this pushes back
- **No percentages for operators.** The words come from grades and agreement, not from probabilities, so showing PHIA's ranges (80-90%) would be false precision. I show them only under T, and would drop them altogether.
- **"Unlikely" is dangerous.** Readers hear it as "false". Here it only comes from an outweighed claim, and V4 restates such a claim as what the better sources say. I'd keep "unlikely" for other people's claims ("Calder says…"), never for our own facts.
- **A model never picks a word.** It may draft prose in pencil, and the summary must name its weakest claim. This limits what a "generated briefing" can be.

## Decisions for Harry (none taken)
1. Fix the five words org-wide, or let a deployment rename them? I recommend fixed, translated per locale, because the point is that everyone learns them once.
2. Does Mandate get a standard of proof per decision kind, and who may set it?
3. Should a summary always carry its weakest claim ("no surer than…")?
4. Show the PHIA percentages under T, or never?

## Candidate concepts
- **the-word-is-a-rule**: confidence words are computed from grades and agreement by one fixed rule, never typed by a writer or a model, and a summary is no surer than its weakest claim (V1, V5).
- **three-ways-to-be-unsure**: a weak fact sits low on the scale, a dispute is lifted off it as two joined answers, and a gap sits below it with nothing to weigh, each with its own next step (V2, V3, V6).
- **the-decision-sets-the-bar**: a decision carries its own standard of proof, and a briefing sorts itself against that standard into ready, below the bar, and needs someone first (V4).
