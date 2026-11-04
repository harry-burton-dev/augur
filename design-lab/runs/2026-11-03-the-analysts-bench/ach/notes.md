# Competing explanations

Heuer's analysis of competing hypotheses on a real question: **"Why have missed collections on the North round more than doubled since July?"** Ten Data Atlas facts, each with its yardstick word (worked out from source grades by the briefing run's rule), against six explanations: road closures (Calder's own, from its Q3 report), too few vehicles, more homes (Low Moor's 640), agency drivers, counting changed (the new online form), and one the model proposed in pencil, crews moved to Calder's county contract.

One mark per cell: **rules it out** (two bars, weight 2), **against** (one bar, weight 1), **fits** (a faint dot, not counted), or blank (says nothing). A fact that is only *possible* counts half and can't rule anything out alone. An explanation touched by fewer than three facts is **untested** and can't be "least against". Facts that fit everything are drawn grey: they can't tell explanations apart. All of this is in `_src/lib.js` (`against()`, `tested()`, `diagnostic()`, `matrixHTML()`).

The answer every variant reaches from the same marks: **too few vehicles and more homes**, nothing against either; road closures has 5 against and two facts rule it out; counting changed 4; agency drivers 2; crews moved untested. The fact that would split the two survivors: missed collections by weekday, July to October, from Marta Kowal.

---

## V1: The grid
*Idea.* Heuer's matrix on Data Atlas facts. Explanations across, facts down with their word, one mark per cell, a total row that counts only what is against. At the moment, the three facts that rule something out are lit. A side column gives the result (template), what has most against it (set aside, not deleted), the next fact that would split the survivors, and the model's untested explanation shown apart.

*Sources.* Richards Heuer, *Psychology of Intelligence Analysis* (1999), chapter 8.

*What works.* "Only what is against counts" is visible in the marks themselves: fits are faint dots, against is heavy ink. The grey rows teach Heuer's diagnosticity point without a word: a fact that fits everything tells you nothing. Two survivors is shown as a result, not a failure.

*What fails or risks.* A grid of 10 × 6 is a lot for an operator; it is an analyst's tool. Marking 60 cells is the 25 minutes; without a good default (blank) it would take longer. The total is a sum of judgements, and people will over-read a 5 versus a 4.

*Principles.* Explain, never hide: strong. Focus: lit rows. Calm: lights once.

*Needs.* `--x-proposed-against`, `--x-proposed-cell`. A table part in Quill with sticky headers. Data: facts with words, and a place to keep marks with who marked them.

*Test.* Two pairs marking the same grid independently should agree on which explanations are least against. If they don't, the marks need a "why" per cell.

*Score.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4.

## V2: Ruled out
*Idea.* No grid. Six explanation cards; facts arrive one at a time and **notch** the cards they are against. Four notches sets a card aside: struck through, kept, with the facts that did it. ← → steps through facts. What stands at the end is the answer.

*Sources.* Heuer's "work across the rows" (judge each fact against every explanation before moving on); differential diagnosis's "rule out".

*What works.* It is the clearest teaching form: one fact at a time is how Heuer says to work, and the notches make "judged by what is against" physical. An operator understands it on first sight.

*What fails or risks.* Order matters to the eye: early notches feel decisive. Four notches as a set-aside line is arbitrary (Heuer gives no threshold), and it hides how close the others are. With twenty facts the list scrolls away from the cards.

*Principles.* Explain, never hide: strong (set aside, kept). Calm: a short play on load, then still.

*Needs.* Nothing beyond V1's data. A notch animation that stops on reduced motion.

*Test.* Operators who mark with V2 should reach the same survivors as the same people using V1, in less time. If they differ, V2's order effect is real and the facts should be shuffled per person.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 4.

## V3: What to find next
*Idea.* A **differential diagnosis**: the presenting problem (the monthly chart with the April to June average dashed), the explanations still in play ranked by what is against them, and the **tests that would tell them apart**: each next fact with who could get it, from where, how long, and which explanations it would split. The best one (missed collections by weekday, a day's work for Marta) is lit with "Ask Marta". A test that can only add to what is already set aside is listed last and says so.

*Sources.* Clinical differential diagnosis; Heuer on diagnostic evidence; value of information.

*What works.* It turns the end of the technique into a job, which is what an operator needs: not "two survive" but "ask Marta for one export". Ranking tests by how many standing explanations they split is simple and honest.

*What fails or risks.* The "would tell apart" chips are a person's prediction; it could be wrong. It needs someone to write the tests. The chart is the only picture in the surface and could be mistaken for the evidence itself.

*Principles.* Explain, never hide: strong. Calm: one test lit.

*Needs.* A "fact to find" record (who, where from, how long, which explanations it splits), which becomes an Inbox ask.

*Test.* Over a quarter, the lit next fact should be fetched within a week in most runs. If not, the asks aren't reaching the right people.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5.

## V4: If a source is wrong
*Idea.* **Linchpin analysis.** The sources the grid rests on, most facts first. Take one out ("suppose the depot log is wrong"): facts that rested on it alone drop out (struck through), facts with another source stay, totals recompute, and the page says whether **the answer moves or holds**. Here no single source holds the answer up: without the depot log, counting changed falls from 4 to 2 against, but the survivors don't change.

*Sources.* Heuer's step 6 (sensitivity: what if a key piece of evidence is wrong?); CIA linchpin analysis (MacEachin).

*What works.* "The answer holds without any one source" is a strong, checkable claim, and it is exactly what a sceptical reader of a briefing wants to know. It reuses the grid and needs no extra marking. It also catches the opposite case cleanly.

*What fails or risks.* One source at a time misses pairs (two sources that fail together because they share an origin). Source independence isn't in Data Atlas yet (the briefing run's gap). The verdict sentence can feel like a guarantee.

*Principles.* Explain, never hide: very strong. Calm: one source out on load, then still.

*Needs.* Facts that list their sources; source independence ("derived from") to catch pairs.

*Test.* The page's verdict ("holds" or "moves") must be reproducible by hand from the marks. Any mismatch is a bug, not a judgement.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 4.

## V5: The shape it predicts
*Idea.* Each explanation predicts a **shape over time**, sketched month by month by the person who proposed it. Laid over the depot log's bars, a wrong shape is against it: road closures predicts misses falling after June (closures fell), counting changed predicts a step in August (the form started 4 August, but the rise began in July). A month off by more than a quarter of the peak is marked. Four explanations share the July step, and the page says the timeline can't split them; the weekday count can.

*Sources.* Heuer; process signatures in statistical quality control (a cause has a shape).

*What works.* It is the most persuasive single picture in the run: a manager sees why road closures fails without a grid. Sketching the shape *before* seeing the record is a good discipline, and it is the proposer's own. "Same shape, can't split" is said honestly.

*What fails or risks.* Only works for questions with a time series. The tolerance rule is crude. Sketching six lines is extra work for the operator, and a model could be tempted to draw them (it mustn't: the shape is a person's prediction).

*Principles.* Explain, never hide: strong. Calm: lines draw once.

*Needs.* A small "sketch a line" input; the shape stored with the explanation.

*Test.* The verdict by shape should agree with the grid's marks on the same facts. Where it doesn't, one of them is wrong and the page should show both.

*Score.* Clarity 5 · Distinctiveness 5 · Feasibility 3 · Fit 4.

## V6: The sparring partner
*Idea.* The model **argues the other side, in pencil**. It offers an explanation nobody listed (Calder started a county contract in July), a fact that leans on one supplier-written source (overtime stopping), and what the other side will say (Calder will claim we count differently). Taking the first adds a column that arrives **empty**: dotted cells, "untested", because only people mark. The tally reads "3 offered, 1 taken, 0 cells marked by the model". G removes the panel; nothing else moves.

*Sources.* Tradecraft Primer's devil's advocacy; pencil and ink.

*What works.* It is the prompt's "sparring partner" exactly, and it shows the rule (widen, never narrow) at the moment it matters. The empty column is the best single image of the model's place in the run. The facts-to-find it adds go to V3's list.

*What fails or risks.* A model that proposes plausible explanations can flood the grid; cap it at one per run. People may accept a pencil explanation and never test it; the "untested" state must block it from the result.

*Principles.* Pencil and ink: very strong. Explain, never hide: strong. Calm: one acceptance.

*Needs.* A model call that returns explanations and facts to find, never marks. An "untested" state that keeps an explanation out of the result.

*Test.* Across runs, the model's accepted explanations should end untested less than half the time. If more, its suggestions are noise.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5.

---

## Ranked
1. **V3 What to find next.** It ends in a job; the default view for operators.
2. **V1 The grid.** The working surface, behind V3, for whoever marks.
3. **V6 The sparring partner.** The model's place, as a panel on the grid.
4. **V5 The shape it predicts.** The best picture for a manager, where there is a time series.
5. **V4 If a source is wrong.** A one-line verdict on every result: "holds without any one source".
6. **V2 Ruled out.** The teaching form; use it as the bench's help page.

## What I'd build first
The **grid** as the marking surface with **V3's differential** as its front: still in play, ruled out by what, and the next fact to find. V4's "holds without any one source" is computed for free and printed on the result label. V6's pencil panel ships behind the model gateway, capped at one explanation per run. V5 waits for a sketch input and only appears when the question has a monthly series.

## Needs token
- `--x-proposed-against` and `--x-proposed-cell` (new, grammar list).
- The chart in V3 and the small multiples in V5 use `--ink` mixes only.
