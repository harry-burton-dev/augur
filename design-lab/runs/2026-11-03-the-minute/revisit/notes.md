# Surface 5 · Revisiting

**The moment:** D-118 from the day a line is crossed to the day after it is reversed. On 6 October the overdue count reaches 5, over the line of 4 the meeting set in May; a watch marks the decision and asks the chair once (V1). On 13 October the meeting brings its review forward to 3 November (D-130). On 3 November, before the vote, the meeting sees everything that rests on D-118 and what reversing it would do (V2), and the verbs it could choose instead (V4). It reverses it with D-131 (V3), and exactly the people it changes something for are told (V6). V5 steps back and shows the whole line of decisions on the question.

**Shared data:** as in the grammar notes. `DATA.wake` lists everything in AUGUR that points at D-118, with its effect if D-118 is reversed. Today the pillar apps don't publish these links; ADR 0025's bound events would.

**Keys:** arrows choose (V1, V4), Space steps (V2, V5, V6), S toggles the seams (V3), T shows the record fields, R replays.

---

## V1: The line is crossed
*Idea.* The watch on a revisit line, on the day it fires. A chart of overdue vans by month, with the line the meeting set ("revisit if more than 4 · set at the table, 12 May") as a dashed warning rule. October's count arrives at 5, above it. The decision's mark turns to "worth revisiting · still in force, only the meeting can change it", and **one** item reaches the chair's Inbox with three choices: put it on the next agenda, bring the review forward (itself a decision), or note it and keep it, with a reason. The watch lists what it sees and what it can't (bookings not yet done, vans off the road for repair, the Org floor's incident register).

*Sources.* Tripwires and trigger points in contingency planning; watches say what they can't see (briefing run); track-and-trigger charts in hospital wards (NEWS2).

*What works.* **A watch never reverses anything.** It marks and asks, and the decision stays in force until the people who made it decide. "Nobody else is told" is calm by design: owners of the decision's actions see the mark change on their items, with no notice. If the count falls back under the line, the item says so instead of quietly disappearing. The can't-see list is honest about Kestrel's own report counting bookings as done.

*What fails or risks.* Lines are only as good as the meeting that set them; most decisions won't have one. The month granularity means a spike mid-month waits for the next reading. "Note it and keep it" can become a habit; the mark stays until the next reading so it can't be dismissed for good.

*Principles.* Calm: one item, one person. Explain, never hide: the can't-see list. Question and answer: the item stays open until the chair chooses. No letterbox.

*Needs.* Watches bound to a decision's revisit lines (Data Atlas saved questions, the reference desk's "the question is the record"); the events service's clock (nightly due dates passing), the briefing run's gap again.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 3 · Fit 5

## V2: The wake
*Idea.* Before the vote, the meeting sees everything that rests on D-118 and what the motion would do to each: three actions (one already done whose effect is undone by a new action, one open that is withdrawn, one done that is kept), two documents that cite it and need updating, one intent whose forecast falls from 8.1% to 6.9%, and one decision that ends with the trial. Each line says the job it turns into and whose it is. The summary counts: 3 new jobs, 2 documents, 1 open action withdrawn, the forecast change. "Nothing is undone silently."

*Sources.* Consequence preview (cinematic run); reach before act (briefing run); the change impact analysis of engineering change orders.

*What works.* It is the find of this surface: **a decision has a wake**, and AUGUR can know it because every action, citation and forecast that rests on a decision holds a `Ref` to it. Seeing the wake before the vote changes the vote: the room sees that reversing costs two document editions and a forecast, and that keeping the bay is free. It turns "what does this change?" from a question someone asks in the meeting into a list on the screen.

*What fails or risks.* The wake is only as complete as the links: a spreadsheet outside AUGUR that counts the saving won't appear, and the page should say "only what AUGUR can see" (it doesn't yet). Seven items fit; seventy wouldn't, and they'd need grouping by kind with counts. The consequence texts here are written per item; in a real build they come from per-kind templates.

*Principles.* Explain, never hide: strong. Calm: the wake lights once. Reach before act. No letterbox.

*Needs.* `Ref`s from actions, documents and intents to decisions, published as bound events (ADR 0025), and a "what points at this decision" query; per-kind consequence templates.

*Scores.* Clarity 5 · Distinctiveness 5 · Feasibility 3 · Fit 5

## V3: Kept, with seams
*Idea.* After the reversal. D-118 keeps its whole record, hatched and quieter but complete ("in force 175 days · its words, reasons, actions and history are all still here"), and the two records point at each other. Elsewhere in AUGUR, each place that cited it gets a **seam**: a thin blue edge and one line on the procedures (the text isn't changed until Jo issues a new edition), on Jo's withdrawn action (it no longer counts as late, and its history stays), and on intent M-42's forecast (old figure struck, new figure, date). The moment opens the seams.

*Sources.* Visible repair (wear and time); legal citators; editions and errata (the edition prompt, S).

*What works.* "Reversal is visible" is answered in two directions: the old record points forward and every citation points at the change. The seam is the right weight: one line, never a banner, gone into history once the thing is updated. "Thank you note attached" on the withdrawn action is a small human touch that matters when someone's work is undone by a decision.

*What fails or risks.* Three cards fit; a decision cited by forty documents needs the seams to be counted on the decision ("seams open in 40 places, 12 closed") rather than shown. The thank-you note is suggested, not automatic; automating it would be hollow.

*Principles.* Explain, never hide: strong. Calm: seams are static. No letterbox.

*Needs.* A seam mark in the kit (wear and time asked for it too); "until updated" state on citations; Artifacts editions.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 5

## V4: Five ways to revisit
*Idea.* The verbs a meeting has when it revisits a decision: keep it, amend it, suspend it, reverse it, let it lapse. Each previews the record it would make, what it leaves behind (open actions, citing documents, the forecast, the revisit lines) and what the body's rules ask ("a contract change reversed within six months needs notice on the agenda: met, by D-130"). The moment walks down the verbs and stops at reverse. **Letting it lapse** is the warning case: the trial ends, Kestrel is on breakdown cover only, and from 11 November no decision says who inspects the vans.

*Sources.* Robert's Rules (rescind, amend something previously adopted, reconsider); the five-verb choice is from company secretary practice; the decision sets the bar.

*What works.* It shows that reversal is one choice among five, and that amend or suspend may be kinder. **"Let it lapse leaves a gap"** is a real finding: a decision that changed a contract doesn't put the old contract back when it ends. AUGUR can see that because the decision says what it replaced (D-097) and its successor doesn't exist. The rules line puts governance (notice, standard of proof) where it bites.

*What fails or risks.* The previews for amend and suspend are written by hand; generating the "about 7.6%" forecast for an amendment needs a model of the decision's effects that AUGUR won't have. Five verbs is too many for routine decisions; most bodies only need keep, change and reverse.

*Principles.* Explain, never hide: the lapse gap. Calm. No letterbox.

*Needs.* Body rules per kind ("notice required to reverse within N months"); a "replaces" link (D-118 amends D-097) so a lapse can say what it leaves.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V5: The line of a question
*Idea.* Every decision on one matter, in order: D-097 (renew Kestrel, Nov 2025) amended by D-118 (in-house trial), followed up by D-125, kept by D-128, review brought forward by D-130, reversed by D-131. Edges are labelled with how each treated the last, computed from links. Under it, **the answer on each date** to the question "who inspects the North depot's vans?": Kestrel under D-097 until 1 July, our own fitters under D-118 until 1 December, an outside contractor under D-131 after.

*Sources.* Precedent (lines of authority); legislation.gov.uk's point-in-time versions; time as an address.

*What works.* Read as a line, **a reversal is the next answer, not a failure**, which is the tone AUGUR should take. The answer strip is the most useful single thing for a newcomer ("who inspects the vans, and since when?") and for an audit ("what was in force on 1 August?"). It needs the decisions to share a question, which is a strong argument for catchwords or a "question" field on decisions.

*What fails or risks.* Laying out a graph by date with readable labels is fiddly; with ten decisions it needs a proper layout. The question has to be named by someone: AUGUR can't infer that D-125 and D-131 are about the same thing without a shared subject. The answer strip's wording is typed per segment here.

*Principles.* Time as an address: strong. Explain, never hide. Calm: one build, then still.

*Needs.* A `question` (or subject) on decisions; `amends`/`affirms`/`reverses` links; per-question answer text, or the decision's plain words reused.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V6: Who is told, and why
*Idea.* The reversal's routing, worked out from the wake and the new decision, one row per person who could be affected. Four people get one Inbox item each, each with the reason ("you own a new action…", "one item for two changes…", "you wrote the budget monitor, which counts the saving"), and a receipt (told, seen, acted). Three affected people get nothing, and the row says why ("you chaired the meeting", "your action is kept", "you were there and own nothing it changed"). Eleven readers of the procedures get no notice; they see a seam when they next open it. A panel shows exactly what Jo sees.

*Sources.* The switchboard prompt (O): why was I told, receipts, quiet is a feature; recorded delivery; ADR 0044 (levels, the shell decides loudness).

*What works.* **Routing from the wake**: the people who must hear are exactly the owners of things the decision touched, and the meeting's attendees are already told by being there. "Not told, and why" is explain-never-hide applied to notifications. Receipts give the chair "not seen" in his log without any automatic escalation. It agrees with the switchboard: the reversal is a domain event; the Inbox items are "needs"; the shell decides loudness.

*What fails or risks.* "Was there" assumes attendance is recorded and that being present means knowing; someone who left early would miss it. One item for two changes (Jo) is kinder but needs merging rules. Receipts can feel like surveillance; per ADR 0044 a person sees only their own, and the chair sees "seen" only on items he set.

*Principles.* Calm: the strongest of the six. Explain, never hide: the "nothing, because" rows. No letterbox.

*Needs.* Receipts on Inbox items (told, seen, acted), which the switchboard prompt asks for too; a routing rule "wake owners minus people present"; attendance on meetings.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 3 · Fit 5

---

## Ranking
1. **V2 The wake**: the consequence preview of a reversal; the run's strongest new idea.
2. **V6 Who is told, and why**: the wake routes the news; nobody else hears.
3. **V3 Kept, with seams**: reversal visible in both directions.
4. **V1 The line is crossed**: watches mark and ask, never reverse.
5. **V4 Five ways to revisit**: the lapse gap is worth a rule.
6. **V5 The line of a question**: the answer on any date; needs a question field.

## What I'd build first
The wake as a query ("what points at this decision?") over the `Ref`s apps already publish, shown before any revisit vote (V2), turned into seams afterwards (V3), and used to route the news to exactly the owners it touches (V6). V1's watch is the way in: a revisit line set at the table, read nightly, that marks and asks once. The five verbs (V4) belong on the motion form, with "let it lapse" warning when a decision replaced something.
