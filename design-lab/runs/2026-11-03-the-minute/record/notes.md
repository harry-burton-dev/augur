# Surface 3 · A decision record

**The moment:** D-118, read on different dates. On 12 May it is in force. On 20 October it is worth revisiting: two lines set at the table have been crossed (one fitter instead of two by 1 August; five vans overdue on 6 October), and its own cost per van has risen from £112 to £148. Today, 3 November, it has been reversed by D-131. Each variant opens one decision and asks what a reader must see to trust it, check it, or know it no longer holds.

**Shared data:** as in the grammar notes. All values "now" come from the monthly series in `DATA.series` and the action histories, read by date, so every variant agrees with every other on every date.

**Keys:** A steps the "as at" date (V1, V2, V4, V5), arrows move a week (V6), Space steps the treatments (V3), T shows the record fields, R replays.

---

## V1: The record page
*Idea.* An ADR made for operators. The header has the id, the status beside it, the kind of decision and the standard of proof it asks for ("Change a contract asks for likely or surer"), the title, and the resolution in its fixed words. Under that are who decided it, at which meeting, and when the minute was confirmed. Two columns follow: why (reasons with pointers), what it rests on (then, and now with the old value struck), what was said but not decided; and what follows (actions with their states and moved dates as seams), revisit if (each line watched or crossed), who decided (vote, dissent), and history. When it is reversed, a hatched banner names its successor and says "the words below are as agreed on 12 May; they are not edited."

*Sources.* ADRs (AUGUR's own: Status, Context, Decision, Consequences, Superseded by); board minutes; the decision sets the bar (briefing run).

*What works.* It is complete, and a reader who has never seen the meeting can understand the decision, check it and see what replaced it. The banner is the answer to "reversal is visible": the old record keeps its words, its reasons, its actions and its history, and points forward. "Rests on, then and now" in one list makes a stale reason obvious without anyone writing a note.

*What fails or risks.* It is dense, nine sections on one screen. It is the page you go to, not one you notice. On a decision with twelve actions the right column scrolls a long way. The standard of proof is shown but nothing here uses it (V4 and the briefing's bar do).

*Principles.* Explain, never hide: the strongest of the six (abstention, dissent, apologies, moved dates, the successor). Calm: the banner is hatched, not lit. No letterbox.

*Needs.* The record type: fixed `words`, `because[]` with evidence refs, `evidence[]` with the value at decision time, `revisitIf[]`, `vote`, `dissent`, `obiter`, `status` computed from events. A `Ref` to the successor.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V2: Then and now
*Idea.* The decision is a hinge in the middle of the screen. On its left is each record it rested on, valued as it was on 12 May; on its right, the same record today, with a sparkline and the revisit line set at the table. The moment replaces each "then" with "now" one row at a time. Rows that crossed their line turn to warning and say which line. The assumption row reads "assumed → 1 of 2". The verdict at the foot is a template: "Worth revisiting. 2 lines set at the table have been crossed, the assumption it needed did not hold, and its cost has risen by £36 a van. Nothing changes until the meeting decides: it is on the agenda for 3 Nov."

*Sources.* The workings show; wear and time (then and now with carry-over); the reference desk's "five reasons an answer moves".

*What works.* It is the best page for the person who has to decide whether to reopen a decision: everything that moved is on one line each, and nothing has to be read twice. It separates **moved** (the in-house cost rose, but no line was set for it) from **crossed** (a line the meeting set was passed). That is the difference between "interesting" and "the meeting asked to be told". "Nothing changes until the meeting decides" keeps the decision in force; a watch never reverses anything by itself.

*What fails or risks.* Six rows fit; thirty wouldn't. A decision that rests on a whole briefing needs grouping. It only works if the value at decision time was stored, and today nothing in AUGUR snapshots a fact when something cites it. Rows with words instead of numbers ("saving counted: £3,100 of £16,000") break the column.

*Principles.* Explain, never hide: strong. Calm: values change once; warning is an edge and a colour of text. No letterbox.

*Needs.* A snapshot of each cited value at decision time (or `as at` queries on Data Atlas: the wear and time run's "field-level before and after"). Series that can be read at a date.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 3 · Fit 5

## V3: Headnote and treatment
*Idea.* The decision written up as a law report: a flag at the top (good, questioned, reversed), the citation (D-118 · FFL 26/05/4 · body · date), catchwords for search, then **Held** (in plain words), Because, On (what it rests on), Unless, Said (obiter, in italics), Dissent, Amends and the full Words. Beside it is a citator: every later record that treated D-118, oldest first, with a signal computed from that record's own link. *Cites*: D-125 re-advertised the fitter post, the North depot procedures and the budget monitor rest on it. *Followed*: D-128 kept the trial going. *Questioned*: D-130 brought the review forward after a line was crossed. *Reversed*: D-131. The flag shows the worst signal so far.

*Sources.* Law reports and headnotes; Shepard's and KeyCite citators; ratio and obiter.

*What works.* Treatment answers a question no other variant does: **who has relied on this decision since?** The procedures document and the budget monitor are listed beside the decisions, so a reversal shows at once who must update what. That is the wake (see revisiting). The flag is a one-glance trust signal that can travel with a citation (grammar V4). Catchwords give search something better than full text.

*What fails or risks.* Legal register: "held", "treatment" and "obiter" are lawyer words. The labels here are plain (Held, Said, Unless), but the form still feels formal for a depot meeting. "Questioned" is computed from a decision that merely moved a meeting date, which is a judgement call in the rule. Signals need a small fixed vocabulary per deployment.

*Principles.* Explain, never hide: treatment is computed, never typed. Calm. No letterbox.

*Needs.* Links between decisions with a kind (`affirms`, `amends`, `relates`, `reverses`). Documents' citations of decisions as `Ref`s (Artifacts would publish `artifacts.bound` per ADR 0025). Catchwords (`subjects`).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V4: The argument
*Idea.* The decision drawn as a Toulmin argument: **grounds** (the facts) *so, probably* (the qualifier: "as a six-month trial", and the standard of proof with its weakest fact) **decided**; *since* **the rule it takes for granted** ("if our own fitters inspect for less than a contractor charges, and just as often, running costs fall and no van goes overdue"); *because of* **what the rule rests on** (intent M-42, D-097); *unless* **what would undo it** (the assumption and the revisit lines); *so we will* (the actions). Read on 20 October, the "unless" box and the "since" box turn to warning, and the since box says which half of the rule failed: "just as often" did not hold.

*Sources.* Stephen Toulmin, *The Uses of Argument* (1958): data, claim, warrant, backing, qualifier, rebuttal; argument mapping; the decision sets the bar.

*What works.* It is the only variant that shows **why** a decision failed, not only that it did. The warrant ("the rule it takes for granted") is the part nobody writes down, and it is what actually broke. The qualifier box is the natural home for the standard of proof. The diagram reads in three seconds: one box is amber, and that is the leg that gave way.

*What fails or risks.* Writing a warrant is hard; few secretaries will do it in a meeting. It may need to be the chair's job after the meeting, or a model's suggestion in pencil (with the risk that a model writes a confident rule nobody agreed). The connectors are drawn from box positions and must be redrawn on resize. Six boxes at 1280 are tight.

*Principles.* Explain, never hide: strong. Calm: two edges change colour, once. No letterbox.

*Needs.* A `warrant` field (optional, or pencil). Assumptions as first-class parts of the record (grammar V3).

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V5: Chip, card, page
*Idea.* The same record at three sizes. As a chip inside other records (an Inbox item, a sentence in a procedure, an intent's forecast), as a card (on hover or in the log), and as a page. A check strip at the foot proves the five facts each size shows are the same (status, since, open actions, past their date, lines crossed), because all three call one function. The moment moves the date to today and all three change together.

*Sources.* The overview rung (wear and time); same digits at every height (briefing run); legal citators for the chip.

*What works.* It makes the case for a kit part with three sizes and no stored status. The chip inside Jo's Inbox item ("from D-118 · reversed → D-131") tells her, without opening anything, that the action she is late on no longer matters. The check strip is a test as much as a picture.

*What fails or risks.* It is a spec sheet, not a working view, and has spare space at 1600. The "3 of 3" ticks are trivially true here; in a real build they belong in the kit's tests.

*Principles.* Explain, never hide. Calm: one change. No letterbox.

*Needs.* Quill `DecisionRef` (chip), `DecisionCard`, and the record page, all fed by one `decision.facts(asAt)` call.

*Scores.* Clarity 4 · Distinctiveness 2 · Feasibility 5 · Fit 4

## V6: A decision's life
*Idea.* The whole life of D-118 on one time scale, May to December: a status band (in force, worth revisiting outlined in warning, reversed hatched), one lane per action (set, due dates as diamonds with moved ones dashed, done as a dot, closed as a green dot, overtaken dotted), the two series it watches with their revisit lines, and the meetings with the decisions that touched it. A chosen date line can be moved a week at a time. The panel on the right shows the record as it read on that date, and the address `mandate / decisions / D-118 @ 2026-08-01` can be copied and sent. The moment walks the date from 12 May to today once.

*Sources.* One-now and time as an address (wear and time); Marey's train graph; project Gantt charts with baselines.

*What works.* Cause and effect line up vertically. The overdue line crosses 4 in October, the band turns amber, the meeting a week later brings the review forward, and the reversal follows. A-302's dotted life with two moved diamonds is the whole story of the fitters in one row. The date address is a real feature: "this is what was in force when you made that call" is a common question in audits and disputes.

*What fails or risks.* It is a dense chart for one decision, closer to an analyst's view than an operator's. Moving the date redraws everything, which is fine for one decision and expensive for a log of hundreds. Lane labels and series need deployment-specific choices (which series does a decision watch?), which comes from its revisit lines.

*Principles.* One-now: strong (one scale, one now line). Time as an address: strong. Explain, never hide. Calm: the walk happens once.

*Needs.* Event history with dates for decisions and actions (it is all in the record); series readable by date; `@date` addresses in shell routing.

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 4

---

## Ranking
1. **V2 Then and now**: the page that decides whether to reopen.
2. **V1 The record page**: the complete record with a visible reversal.
3. **V4 The argument**: shows which leg gave way; the warrant is the find.
4. **V3 Headnote and treatment**: "who has relied on this since?" feeds the wake.
5. **V5 Chip, card, page**: the kit part spec.
6. **V6 A decision's life**: strong as a history mode, not as the record.

## What I'd build first
V1 as the page, with V2's then-and-now as its "what it rests on" section and V3's treatment list as a side panel. V5's three sizes are the kit parts underneath. The argument (V4) is worth testing as the way a reversal is explained to people who weren't there; it needs the warrant field, which I'd add as optional and never required. V6 is the "history" mode of the page, behind one key.
