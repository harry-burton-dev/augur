# Surface 4 · Intent meets the situation

**The moment:** Tue 3 Nov, 07:40. Since 05:30, thirteen things have reached Ellis Marsh, network controller in North Zone: a quality alert taking Ashby borehole 3 out of supply (06:10), a cold-weather amber from Thursday, a big new leak on Calder Lane, an offer of two extra repair gangs, last night's Kelda reading, a press question about a hosepipe ban that arrived untagged, Thornley's weekly level, a South Zone result, a drought permit letter, one restricted item from Security, and three things that touch none of his intents.

**Data:** `DATA.incoming` (each item's touches as [intent, part kind, part id], whether it touches Ellis's own part, when it bites, why it matters to him, its rung, how it was tagged, which measure it moves), `DATA.untouched`, `DATA.rankRule`, `DATA.traces`, `DATA.summary`. R replays, T shows doctrine words, G turns the model gateway off on V3 and V6.

**The rank rule every variant uses** (an order, not a score, owned by Mandate and the same for everyone): 1 touches a limit and your own part; 2 touches your own part; 3 touches a limit above you; 4 a task or freedom above you; 5 a purpose or what done looks like above you; 6 an intent you can't open; 7 touches none (folded, never hidden). Ties go to whatever bites first. No model ranks; a model may only suggest, in pencil, which intent an untagged item touches.

---

## V1: Ranked by what it touches
*Idea.* The morning as one list, grouped by the rule that placed each item, each with the intents and parts it touches, a line on why it matters to Ellis, and when it bites. The rule sits beside the list with its counts. The three untouched items fold into one line, including the IT patch a model thought might touch Kelda's telemetry and Ellis rejected.

*Sources.* Bratman's intention as a filter; Endsley's situation awareness (what matters to this reader); the reference desk's pencil and ink.

*What works.* "Why this matters to you" on every row is the difference between a feed and context. Grouping by rule makes the order explainable without a number: you can see why the press enquiry sits above Thornley's level. The rule list doubles as the legend and the audit.

*What fails or risks.* The "why" lines are the expensive part: here they are written as data, in practice they need a template per kind of touch or a model in pencil. Seven groups is many for a quiet morning; empty groups are dropped. A rank-1 group of eight items would need its own order.

*Principles.* Explain, never hide: strong. Calm: deposits once. Urgency: rank 1 items carry their bite time; the Letterbox is not used (see the combined screen for when it might be).

*Needs.* Touches on every item (tags matched to intent records); a part-of-mine test; bites-by times.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 5

## V2: Sorted under the nest
*Idea.* Four columns, one per intent on Ellis's chain, widest for his own part and narrowest for the Org. Each item sits under the nearest intent it touches and marks the others with small floor-coloured dots. A card touching a limit carries the limit bar and names it.

*Sources.* Kanban swimlanes; Hoshin's cascade; the cinematic run's floors.

*What works.* It shows the shape of the morning: most of it lands on Ellis's own part, one thing each on the Team and Department, four up at the Org. Column width is a quiet second ranking (nearer is wider). Useful to a team lead looking at a whole team's morning.

*What fails or risks.* Loses the order inside a column (ranked within it, but less visible). The rank-1 alert is under "your part" by its nearest touch, while its most important touch is an Org limit; the card has to say so. Four columns on 1280 squeeze the why lines out.

*Principles.* Focus: nearest intent widest. Explain: "also" marks every other intent.

*Needs.* As V1.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V3: The situation paragraph
*Idea.* Paragraph 1 of an order, written for Ellis: one paragraph per intent on his chain, each sentence built by template from an item as what, so what and next (Endsley's perception, comprehension, projection), and footnoted to a sources list in rank order. With the gateway on, a model adds a two-line summary in pencil above ("Tonight's Kelda feed is 8 Ml/d short… Thursday's amber means the Hebden job has to move"); off, the paragraphs alone, unchanged.

*Sources.* The five-paragraph order (situation first); Endsley's three levels; the briefing run's reader's minute and the label run's said another way.

*What works.* People read prose faster than lists when the prose is short. The template guarantees the same morning reads the same way and that every sentence has a source; the model only says it another way, in pencil. Footnotes make "where did that come from?" one glance.

*What fails or risks.* The paragraph for your own part runs long on a busy morning (four items is already a block). The what/so-what/next labels are useful for learning and noise once learned; they should fade after a week. The Org paragraph mostly says "nothing for you to do", which is honest but wasteful.

*Principles.* Pencil and ink: strong. Two registers: prose over the list.

*Needs.* A sentence template per item kind; `detail`, `why` and `bites` on items; the gateway for the summary.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V4: How far up
*Idea.* The rule ranks; the person chooses how far up the nest the list reaches: your part (5), one up (6), two up (7, the default), everything (13). Beyond the reach is a dashed line with a count and what kind ("3 touch intents further up, one you can’t open; 3 touch none. Not hidden: press 4 to widen"). A limit you inherit reaches you at any reach.

*Sources.* Bratman (intention filters options); ADP 6-0 (two levels up); the room-tone run's quiet has named keys.

*What works.* It gives people the one control they want ("less, please") without letting them hide what matters: inherited limits always come through, and the beyond line counts what is left out. The counts on each step make the cost of narrowing visible before you choose it.

*What fails or risks.* A person who sets "your part" and forgets is now blind to the Team, while believing the count tells them enough. The setting should revert to the default each day or show on the Home band. Four steps may be one too many.

*Principles.* Explain, never hide: the count is the explanation. Calm: the default is two up.

*Needs.* Reach as a per-person setting with a default; the inherited-limits exception in the filter.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 5

## V5: Against what done looks like
*Idea.* The morning read against the seven measures on Ellis's intents, nearest first. Each item lands on the measure it moves; where it would move the line, a dashed ghost shows where it would leave it: Kelda at 2 of 10 tonight unless the plan changes; North zone water freed at 6.4 if Calder Lane is fixed. Items that move no measure are listed under the rows, still delivered.

*Sources.* OKR key results; Endsley's projection; the briefing run's same digits at every height.

*What works.* The ghost on Kelda is the single most persuasive picture of "the plan has broken" in the run: a line that was nearly full now projects to a fifth. It ties context to the end state the intent is judged by, which is what "given what we are trying to achieve" means.

*What fails or risks.* Only items with a measurable effect land well; the amber (a risk, not a quantity) has no ghost. Projections are the riskiest numbers on the page and must say how they were worked out. Seven rows at 1280 is the limit.

*Principles.* Consequence preview, for incoming news. Confidence is worked out: a ghost needs its working.

*Needs.* An expected effect on a fact for item kinds that have one (alerts on assets, leak estimates); facts on end-state lines.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V6: Why this reached me
*Idea.* Pick any item and see how it reached you: the tag it carried, the intent record that names that tag, the part of yours it touches, and the rule that placed it. The press enquiry's trace is pencil (no tag; a model suggested ORG-07 L4); Ellis confirms or says "not this intent". A wrong binding can be flagged; nothing can be dragged up or down by hand, because a wrong order means a wrong binding, and fixing the binding fixes it for everyone.

*Sources.* The workings show; pencil and ink; the switchboard run's the route is a trace.

*What works.* It is the answer to "how does ranked by intent work without a model deciding what matters?" shown in one panel. "Correct a binding, never reorder by hand" keeps the order a rule and turns each person's correction into everyone's improvement. The rejected IT-patch suggestion shows a model being wrong harmlessly.

*What fails or risks.* Most people will never open it, and that is fine; it must be one click from every item. Corrections need an owner to review them (whoever keeps the tags), or they pile up.

*Principles.* Explain, never hide: strong. Pencil and ink: strong.

*Needs.* A stored trace per binding (tag, record, part, rule); a correction queue for the tag owner; gateway suggestions for untagged items only.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

---

## Ranking
1. **V1 Ranked by what it touches**: the default view, with the why on every row.
2. **V6 Why this reached me**: the rule made inspectable, and the only place a model takes part.
3. **V4 How far up**: the one control people want, with a count instead of a gap.
4. **V5 Against what done looks like**: the ghost that shows the plan breaking.
5. **V3 The situation paragraph**: prose with sources; good for a handover.
6. **V2 Sorted under the nest**: a team lead's shape of the morning.

**What I'd build first.** V1 as Home's "what needs you", ranked by the rule, with V6's trace one click from every row and V4's reach as a setting that resets to two up each day. V5's ghost goes on the item when it has a measurable effect. V3 is the format for a shift handover.

## Needs token
No new tokens beyond the grammar's. Carried and used: thread (traces, verdicts), ceiling (limit bars on items), unseen (the restricted item), pencil (model suggestions), drift (ghosts that move away from done), standby (bite times). All pages rely on `--font-mono`.
