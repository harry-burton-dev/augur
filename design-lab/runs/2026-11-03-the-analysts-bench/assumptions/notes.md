# Checking assumptions

The key assumptions check on a Mandate plan: **INT-208 option C, renew for 12 months with a break at 6 months**. Seven assumptions, each marked from the word of the fact it rests on, by one rule (`markOf()` in `_src/lib.js`):

| Mark | Rule |
|---|---|
| **Solid** (filled square) | Its fact is almost certain or very likely. |
| **Supported, with caveats** (half-filled) | Its fact is likely, or a technique leaves room for doubt. |
| **Unsupported** (dashed) | Its fact is only possible, or nobody has checked it. |
| **Not known yet** (corner ticks) | Nobody has said. It can't be marked until someone does. |
| **Not yours to see** (hatched) | Its fact is on a floor you can't open. |

A person may **lower** a mark with a reason (a5 is lowered from solid: 2 of 6 past tenders took 7 months). Nobody can raise one above its fact. Every assumption has a **sign** that would show it failing, and says whether AUGUR can see that sign (four of seven it can't: a letter, a phone call, a date passing, a report nobody has).

The result: 2 solid, 2 with caveats, 1 unsupported, 1 not known yet, 1 not yours to see. The load-bearing weak point: **Calder puts the two missing vehicles back in January**, resting on one ungraded phone note.

---

## V1: Under the plan
*Idea.* The plan's own text, then a table: what the plan assumes, its load (high, medium, low), the fact it rests on with its word, the mark (with why, or who lowered it and why), the sign it is failing, and who watches it or why AUGUR can't. Sorted weakest first; load-bearing and not solid get a lit edge. Counts of each mark at the top.

*Sources.* The Tradecraft Primer's key assumptions check (2009).

*What works.* It is the technique as written, made automatic where it can be: the mark is worked out, not typed, so two checkers get the same mark from the same fact. "Can't see" is a column, not a footnote. The footer's "load-bearing and not solid" is the actionable list.

*What fails or risks.* It is dense; at 1280 the table scrolls. "Load" is a judgement nothing checks. The lowered-mark reason sits in small type and is easy to miss.

*Principles.* Explain, never hide: very strong. Calm: marks stamp once. Confidence is worked out: marks follow the yardstick.

*Needs.* Assumptions as part of the plan record (the minute run's `assumptions[]`), each bound to a fact or a technique result; a "lowered by, because" field.

*Test.* Two checkers given the same plan and facts should produce the same marks for every assumption bound to a fact. Any difference means a mark was typed.

*Score.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4.

## V2: Load-bearing
*Idea.* The plan drawn as a **beam on seven columns**: width is how much of the plan rides on each assumption, fill is how sure it is (solid, half, dashed, corner ticks, hatched). Where a wide column is weak, the beam **cracks** and the column sinks a little.

*Sources.* James Dewar, *Assumption-Based Planning* (RAND, 1993): load-bearing and vulnerable assumptions; structural load paths.

*What works.* "Load-bearing and weak" is the one cross that matters, and the beam shows it without a legend. A manager sees two cracks and knows where to look. It is calm and memorable.

*What fails or risks.* A metaphor: it implies the plan "collapses" on one false assumption, which overstates. Crack positions are approximations, and widths compress at 1280. It hides the sign and the hedge; it's a picture for the top of V1, not a replacement.

*Principles.* Explain, never hide: good (hatched and ticked columns stay). Calm: one crack, once.

*Needs.* Load per assumption (the planner's call), maybe as three words only.

*Test.* Shown the beam for five seconds, a manager should name the two weak load-bearing assumptions. If they name the widest instead, fill isn't reading.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit 4.

## V3: Said in the plan
*Idea.* The plan's sentence in large type with the **phrases that assume something underlined in place**. The model points at them in pencil (dotted); a person inks each one (solid); its mark appears beside its words in a list. With the model off, the same phrases are underlined by hand and the marks are identical.

*Sources.* The Tradecraft Primer's first step (state the premises of the current line); decided versus said (minute run).

*What works.* Assumptions are found in the words people actually wrote, which is where they hide. The model widens (it points) and never marks. Clicking a phrase links words to assumption, which a later reader needs.

*What fails or risks.* Phrase spans are brittle when the plan is edited; they need the minute run's "words fixed once agreed". The model will over-point on long plans.

*Principles.* Pencil and ink: very clear. Explain, never hide: strong.

*Needs.* Span anchors in Mandate plan text; a model call that returns spans and nothing else.

*Test.* On ten plans, the model's pointed phrases should include at least 80% of the assumptions a checker inks by hand. If lower, pointing costs more than it saves.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4.

## V4: Signposts
*Idea.* Each assumption gets a **signpost** on one calendar: what you would see, and by when, if it were failing (a quote by 1 Dec, an audit report by 15 Jan, nine vehicles in the week of 18 Jan, February's count, a tender started by 30 April). Signposts AUGUR can see are solid; those it can't are hatched, and the footer lists why. "Any time" signposts span the row.

*Sources.* Dewar's signposts (RAND 1993); indicators and warnings practice.

*What works.* It answers "what next, and when?" for the whole plan at once, and it makes the clock gap concrete: two of the next three signposts can't fire because a date passing isn't an event. It is the bridge from the check to watches.

*What fails or risks.* Long labels truncate on the calendar. The calendar is a second time scale; it should share the run's one time rail (wear and time). "Any time" signposts are hard to draw usefully.

*Principles.* Watches say what they can't see: strong. Calm: still.

*Needs.* Signposts as watches (the events service's clock and silence). The shared time rail.

*Test.* Every assumption below solid has a signpost with a date or "any time"; a plan with one missing can't be marked checked.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4.

## V5: Turned over
*Idea.* Each assumption **turned over**: its opposite ("Calder doesn't put the vehicles back in January") and what we would do then. For anything below the decision's bar (a renew-or-end decision asks for very likely or better), the answer is a **hedge** written before the meeting: "Use the service credit from February and start the tender in January, not April." The footer counts: 5 of 5 below the bar have a hedge, so the plan can go to the meeting below its bar.

*Sources.* Munger's inversion ("invert, always invert"); Dewar's hedging actions; the briefing run's standard of proof.

*What works.* It answers the briefing run's open problem: what to do when a decision *must* be taken below its bar (notice is due on 31 Dec whatever we know). The rule is crisp: **below the bar, every weak point needs a written way out and a sign to trigger it**. Hedges are cheap to write and priceless on the day.

*What fails or risks.* Writing opposites for solid assumptions is busywork; they could be optional. A hedge can be vague ("review the position"); it needs a named action, a trigger and an owner, which the template should enforce.

*Principles.* Explain, never hide: strong. The decision sets the bar: extended with a hedge. Calm: one turn.

*Needs.* `--x-proposed-hedge`. A hedge field on each assumption (action, trigger, owner). Mandate's bar per decision kind.

*Test.* Of hedges written, the share used when their sign fired should be high; a hedge nobody uses when its sign fires was the wrong hedge.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 5.

## V6: The challenge
*Idea.* Two people: the planner states each assumption, a **challenger** asks one question, "how do you know?", and the planner answers. The answer either points at a fact (whose word sets the mark) or doesn't. A challenge may lower a mark, and the lowering is kept with its reason as a seam: a5 goes from solid to "with caveats" because two of six past tenders took seven months. The model may challenge too, in pencil, as questions only.

*Sources.* Military murder boards; the Tradecraft Primer's devil's advocacy.

*What works.* It is social, quick, and familiar from reviews. Asymmetry ("only lower") makes it safe to run with a junior challenger. The model's questions are good at the dull ones ("could the round be redrawn?").

*What fails or risks.* Depends on the challenger's nerve; a challenger who never lowers is a rubber stamp. It doubles the people cost of the check.

*Principles.* Explain, never hide: strong (lowering is a seam). Pencil and ink: model asks, people answer.

*Needs.* A challenger role on the check; a lowered-by record.

*Test.* If challenges lower no mark in five runs on a floor, the challenger isn't challenging; the bench suggests someone from another team.

*Score.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4.

---

## Ranked
1. **V5 Turned over.** The hedge rule is the run's most useful finding for real decisions.
2. **V1 Under the plan.** The working list, with marks worked out.
3. **V4 Signposts.** Assumptions become dated watches; the clock gap is visible.
4. **V2 Load-bearing.** The picture at the top of V1.
5. **V3 Said in the plan.** The way to find assumptions in the words.
6. **V6 The challenge.** An optional mode when there is a second person.

## What I'd build first
**V1's list with V5's hedge column**, on the plan record in Mandate, with the mark worked out from the fact's word and a sign per assumption. The plan can't be marked "checked" until every load-bearing assumption is marked and every one below the decision's bar has a hedge and a sign. V2's beam goes on top as the summary; V4's calendar is the same signs as watches. I went beyond the ask with **hedged below the bar**: a decision may go ahead below its standard of proof only with every weak point hedged. It needs Harry's decision.

## Needs token
- `--x-proposed-hedge` (new).
- Assumption marks reuse ink, light, the unseen hatch and the gap ticks; no new colour.
