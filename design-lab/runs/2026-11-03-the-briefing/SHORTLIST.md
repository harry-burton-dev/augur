# Shortlist: the briefing

Ranked by what I'd build first. The headline: **a briefing can be trusted if its digits are the same at every height and every confidence word is worked out by rule, never typed.** The model gets one pencil slot, the bottom line, and every phrase in it must point at a fact on the page.

| # | Build | Look at | Why it ranks here |
|---|---|---|---|
| 1 | **Same digits at every height**: one query feeds the headline, the picture and the records. A check strip counts the marks each copy draws, and a headline whose heights disagree can't go out | [Three readers](combined/v1-three-readers.html), [Ladder](grammar/v3-ladder.html), [Stretchtext](heights/v3-stretchtext.html) | Sam's records, Priya's one-minute briefing and the Org headline all say 6. Last week's Org copy says 5, and the check names why ("a date passed"). |
| 2 | **Confidence is worked out**: a fixed yardstick of seven words, from source grades and agreement; a person may only lower one, with a reason. Counts take no word (they say how much of the period they cover); a dispute is two answers lifted off the scale, a gap is an empty mark; a summary is no surer than its weakest claim | [Yardstick](grammar/v2-yardstick.html), [The bar](confidence/v4-the-bar.html), [The decision sets the bar](combined/v4-the-decision-sets-the-bar.html) | It is the only way a lay reader gets the same "likely" every time, in every deployment. |
| 3 | **Question, not chart**: the operator picks the question ("getting worse?", "which is biggest?", "where?"), each with one picture and one sentence template; the picture sits in the sentence at word size; the never list ships with its reasons | [From question to briefing](combined/v2-from-question-to-briefing.html), [In the sentence](picture/v6-in-the-sentence.html), [Question first](picture/v1-question-first.html) | Answering the lead's six questions in order builds the briefing itself. |
| 4 | **The reader's minute**: each part has a reading-time budget measured from its words; cuts drop into "if asked", never deleted | [If asked](minute/v5-if-asked.html), [Minute meter](minute/v3-minute-meter.html), [The minute](grammar/v6-the-minute.html) | The grammar sheet found its own specimen took 68 seconds to read. A budget catches that. |
| 5 | **Reach before act**: "Publish to the Department library, feed intent M-42, watch for change", with each choice showing its reach before it is picked; proofs show each reader's own copy; a pencil bottom line blocks Send | [Finding to action](combined/v3-finding-to-action.html), [Order in a sentence](action/v4-sentence.html), [Proofs](action/v3-proofs.html) | It is the same rule as the reference desk's "share the question, not the answer", applied to publishing. |
| 6 | **Watches say what they can't see**: a watch lists what would move it and marks what AUGUR can't notice yet; when it fires it names one of the five reasons an answer moves, and the briefing shows a seam | [Finding to action](combined/v3-finding-to-action.html), [Flood marks](action/v5-flood-marks.html) | Today, a due date passing makes no event. So two passed dates reached the watcher only two days late. |

**Worth keeping as options:**
- [The lead's questions](heights/v6-the-leads-questions.html): fixed follow-up questions per kind of fact as the way between heights.
- [Appreciation](grammar/v5-appreciation.html): lanes for who wrote each line (records, a person, the assistant).
- [Counted sources](confidence/v3-counted-sources.html): an Isotype figure per source, for and against.
- [A claim over time](confidence/v6-a-claim-over-time.html).

**Not worth pursuing:**
- [Rack focus](heights/v5-rack-focus.html).
- [Say, show, know](minute/v4-say-show-know.html): a reviewer's view, and it fails the one-minute test.
- [Field key](picture/v5-field-key.html).
- [Radial with reach](action/v6-radial.html).
- The IPCC [two-questions grid](confidence/v2-two-questions.html): right for experts, too much for operators.

**Answers to the prompt's questions:**
- *Which charts should an operator be offered?* Six, each the answer to one plain question:
  - a line over time;
  - bars, longest first;
  - one equal tile per site;
  - a count with symbols;
  - before and after;
  - small pictures on the same scale.

  Two other choices are always offered: no picture at all, and the records. Never offered, but shown with the reason when someone might expect them: pie or doughnut, 3D, two scales on one chart, gauges, bigger symbols for bigger numbers, bars that don't start at zero, stacked areas, and shaded maps of raw counts. "Does one thing go with another?" goes to the Data team in Explorer.
- *Where may a model write the bottom line?* In one pencil slot only. Each phrase carries a numbered pointer to a fact on the page. A phrase that points at nothing is struck out and blocks inking: in V4, "saves money" pointed at an unknown cost. The confidence word in the bottom line is filled by rule from its weakest claim, so the model can't choose it. The model may suggest what a reader will ask, but never answer it. Everything else is built from records by template. G removes the draft, and no number changes.
- *What does "watch for change" need from Data Atlas and the events service?*
  - Data Atlas must save the query, not the number, and rerun it with only the watcher's access.
  - The events service needs a clock, so that a due date passing becomes an event.
  - It also needs to detect silence ("no reply in 30 days").
  - Every notice needs one of the five reasons an answer moves.
  - The watch must list what it can't notice yet.

**Where these push back:**
- A standard of proof on Mandate decisions is new, and it changes Mandate.
- When most departments show only "some", the Org picture may mislead. It may be better for it to refuse to draw and say why.

**Decisions for Harry** (none taken):
1. Mandate decisions carry a standard of proof? If yes, who sets it, and is it per kind of decision or per decision? I recommend per kind, set by that kind's owner.
2. Does a published briefing show a seam where a number changed until the author republishes, rather than updating in place? I recommend the seam.
3. Should a clock in the events service (due dates and silence as events) go on the roadmap now? Watches depend on it.
4. Should the Org picture refuse to draw when most of it is "some"?
5. The seven yardstick words, as one fixed list for every deployment, or set per organisation?

**Gaps:**
- A yardstick table, from grades and agreement to words.
- Sentence templates per question.
- A reading-time measure.
- A briefing object in Artifacts that keeps its query, not its numbers.
- Watch storage.
- The clock and silence events.
