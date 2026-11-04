# Surface 5 · Acting within intent

**The moment:** 07:40. Ashby borehole 3 is out on a quality alert, so tonight's Kelda feed to North zone is 8 Ml/d short of its 10. Ellis Marsh has six ways to fill it: bring Ryecroft into supply (+6, within freedom), draw 2 Ml/d more from Thornley for up to 72 hours (+2, inside every limit and DEP-14's branch plan, but against the key task of resting Thornley), draw all 8 from Thornley (skips the branch order: Dana's choice), lower Hebden pressure to 12 m (below the team's range: Sam's choice), put borehole 3 back with extra filtration (across L3: only Hana Sato), or ask customers to use less (across L4: only Gareth Lowe). He takes the first two, records how they still serve the intent, and Dana Whitlock gets a notice at 07:52, not an approval request.

**Data:** `DATA.plan` (the gap, the six options with a check against every limit, a verdict, why, the freedom each uses, the chosen pair, the change record, what becomes a notice, Dana's inbox and the derived grant), `DATA.intents`, `DATA.spendCascade`, `DATA.facts`. R replays, T shows doctrine words.

**The rule all six share:** a person may change the plan without asking when every limit holds and the change sits inside a freedom the intent gives, and they have said that intent back. The change records how it still serves the intent (built from what was checked, never typed), the floor above is told, and a question from above never undoes it. Anything across a limit goes to the limit's named owner; anything outside freedom goes to whoever holds that choice.

---

## V1: Options against the limits
*Idea.* The plan broke, in one line ("Tonight's night feed: 8 Ml/d short"). Every option is a row checked by rule against each of the seven limits Ellis's part is bound by (held, crossed, at risk, not touched), with its verdict and why. Picking options adds up below: gap filled, Thornley used (in points of the Org's end state), spend against the team's £25k, and who'd need to say yes. The button only lights when the gap is closed and nobody's yes is needed.

*Sources.* Bratman's filter; the decision matrix; the briefing run's the decision sets the bar.

*What works.* The four verdicts make "within intent" a property you can see, not a feeling. The sum row is the honest bit: "6 Ml from Thornley · 0.07 points" puts the cost to the intent in the intent's own units. "None need anyone's yes" is the sentence that frees the controller at 07:40.

*What fails or risks.* A grid of ticks is dense; most cells are "held" and carry little. Real options won't arrive pre-written (someone writes them, or a model drafts them in pencil from the branch plan). Rows are clickable but only keyboard-pickable by number; the real thing needs proper row buttons.

*Principles.* Explain: every verdict says why and who. Consequence preview: the sum.

*Needs.* Limits as testable clauses; option effects in the intent's units.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V2: The change record
*Idea.* The record of a change made without asking, built slot by slot from what was picked and checked: changed, to, because (the 06:10 alert), so that (Kelda carries 10 Ml/d every night, TM-31), freedom used (DEP-14's standby-source freedom and branch B1, as within stamps), limits held (7 of 7, by rule), cost to the intent, told, ends, undo, and one optional typed note. Beside it, the notice the floor above will get, and a list of what the record doesn't cover.

*Sources.* The paper-and-the-desk run's say what you sign for; ADP 6-0 disciplined initiative ("act, then report"); audit trails.

*What works.* "How this change still serves the intent" is the prompt's "the change records how" answered with structure, not prose, so it can be checked and searched. "What this record doesn't cover" (the four options not taken, and who they'd have needed) closes the gap an auditor would look for. The notice says "a question doesn't undo it", which is the line that makes initiative safe for the person taking it.

*What fails or risks.* Eleven slots is a lot to read; the notice is the summary people will actually see. If people learn the slots fill themselves, the record becomes a formality; the one typed line should be encouraged for anything against a task.

*Principles.* Explain: strong. Calm: one notice, nothing to press.

*Needs.* A change record type on the intent's Ref (ADR 0025/0028), with the freedom and branch ids it used.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V3: What the change touches
*Idea.* Tonight's water to North zone as flows from three sources, in three states (1–3): as planned (Ashby 10), after 06:10 (Ashby 2, a dashed gap of 8), with the change (Ashby 2, Ryecroft 6, Thornley 2). Beside it, everything the change touches before it is made: Kelda back to 10, Thornley 41.2% to 41.13%, Ryecroft at 6 of its 6 licence (no headroom), £18k of £25k, Water Quality sampling daily, customers none, who is told.

*Sources.* The cinematic run's consequence preview; Sankey diagrams; utility network schematics.

*What works.* The flow picture makes the break and the fix obvious to someone who isn't a controller (a Department head reading the notice later). "No headroom" on the licence is the kind of consequence a list of ticks hides: inside the limit, at the edge of it.

*What fails or risks.* A flow diagram is specific to supply networks; other deployments need their own picture or none. It previews one chosen change rather than comparing options.

*Principles.* Consequence preview: strong. Explain.

*Needs.* A deployment-specific preview renderer for the app (an app's job, through Quill), fed by the option effects.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V4: The branch, taken
*Idea.* DEP-14 carried a branch for exactly this (B1: if Ashby is short, Ryecroft first, then Thornley for up to 72 hours), asked for by Sam Okafor in catchball and agreed on 7 Oct. Taking it is throwing a set of railway points: the route lights from the plan onto the branch, past Ryecroft and Thornley to a signal at the cap (Fri 06:00). The record is one line. Past the cap, nothing happens on its own; continuing needs Dana.

*Sources.* Branches and sequels (ADP 5-0); railway points and signals; the apprentice run's silence is not a go (the cap is a signal, not a timer).

*What works.* It shows why mission command is cheap at the moment of change: the thinking was done in October. A branch turns "may I?" into "I took B1", and the cap as a signal at danger is the right shape for a time limit (stops, doesn't act). Strong link from the catchball (writing V3) to the night.

*What fails or risks.* Only works for surprises someone foresaw; the other five options show why branches aren't enough alone. The railway metaphor is decorative; a list with "take B1" would do the same job.

*Principles.* Calm: one action. Explain: who agreed the branch and when.

*Needs.* Branches as records on the intent with a cap and an owner for "past the cap".

*Scores.* Clarity 5 · Distinctiveness 5 · Feasibility 5 · Fit 4

## V5: The edge of freedom
*Idea.* Freedom drawn as a space. The x axis is Thornley water used over three days, the y axis the gap filled tonight. The branch cap is a dashed edge at 6 Ml; tonight's need is a line at 8. Each option is a point (hollow if outside freedom, a cross if it crosses a limit); combining 1 and 2 lands exactly on the line, at the edge.

*Sources.* Operating envelopes in process control and aviation; the cinematic run's light language (the edge).

*What works.* "On the line, at the edge" is a good picture of a well-judged change: enough, and no more of the scarce thing than allowed. It makes "against a task" quantitative.

*What fails or risks.* Only two dimensions fit; option 4 (pressure) sits inside the box but is outside freedom for another reason, which confuses. Charts like this need a reader who likes charts.

*Principles.* Explain: the page says what the axes can't show.

*Needs.* Two named quantities per decision kind, chosen by the app.

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 3

## V6: Approvals become notices
*Idea.* The Department head's side. On the left, what "within intent" changes: bringing a standby source into supply, moving supply between zones within licence and spending up to £25k become notices; changing the branch order and anything across a limit still ask. Under it, the key Ellis acted on: derived from DEP-14 F2 through TM-31 and his part, because he said TM-31 back on 27 Oct, until 15 Dec or a change to F2 or him leaving the team. On the right, Dana's morning: Ellis's notice (told, not asked), Rita Gomez's request to move water from South zone (inside DEP-14's freedom, but South Zone hasn't said DEP-14 back, so it still asks), and the crossed assumption, asked once.

*Sources.* Delegation of authority and schemes of delegation; the keys-and-doors prompt (N); the label run's purpose is the key; the apprentice run's ceiling.

*What works.* It answers the prompt's third question directly: within intent unlocks approvals that become notices, only for holders who said the intent back, through a grant derived from the intent rather than issued by an admin, ending when the intent changes or the person moves on. Rita's "still asks" beside Ellis's notice is the clearest demonstration in the run that the backbrief is load-bearing.

*What fails or risks.* Derived grants are a new identity mechanism (Keycloak has roles and groups, not grants that follow a document). Gating freedom on the backbrief could make people backbrief carelessly just to unlock it; the owner confirming the backbrief is the check.

*Principles.* Explain, never hide: strong. Calm: notices need nothing pressed. Question and answer: still-asks items are questions; notices are not.

*Needs.* A Mandate policy that turns freedom clauses into time-boxed grants for confirmed holders; an audit event kind "within intent"; ADR 0026 Inbox items with a notice kind that needs no answer.

*Scores.* Clarity 5 · Distinctiveness 5 · Feasibility 3 · Fit 5

---

## Ranking
1. **V6 Approvals become notices**: what within intent unlocks, for whom, and the key it runs on.
2. **V2 The change record**: how the change still serves the intent, built not typed.
3. **V4 The branch, taken**: the cheapest change, thought through in October.
4. **V1 Options against the limits**: the verdicts and the sum.
5. **V3 What the change touches**: the clearest picture of break and fix.
6. **V5 The edge of freedom**: a good idea that two axes can't carry.

**What I'd build first.** The change record (V2) with V1's verdict rule behind it, branches as records (V4) so most changes are "took B1", and V6's rule that freedom unlocks only for confirmed holders, with the derived grant written down as a Proposed record next to keys and doors. Notices go to the floor above with "Seen" and "Ask a question", never "Approve".

## Needs token
No new tokens beyond the grammar's. Used: freedom (the edge, within verdicts, the grant), thread (within stamps), standby (still asks, the gap), drift (Thornley flow, crosses), lit (the taken branch), ceiling (limits). V3 and V5 draw data in SVG with token colours. All pages rely on `--font-mono`.
