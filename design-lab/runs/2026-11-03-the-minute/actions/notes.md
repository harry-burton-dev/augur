# Surface 4 · Actions out of decisions

**The moment:** the actions the Fleet and Facilities leadership meeting has set this year, seen by their owners and by the chair, Marcus Hale. The run follows three actions from D-118: Dana Whitlock gives Kestrel notice (done in May, closed in June), Jo Barnes hires two fitters (due 30 June, moved twice, one fitter in post since 9 September, late), and Sam Okafor fits out the bay (done 22 July, closed 8 September at matters arising). Each variant shows both views, at a date that makes its point: 20 June (V2), 30 July (V3), 9 October (V4) or 2 November, the day before the reversal (V1, V5, V6).

**Shared data:** as in the grammar notes. Every state is computed by `actionAt(action, date)` from the action's history; "overdue" is derived from the date and never stored; moved dates keep the old date and the reason.

**Keys:** O changes owner (V1, V2, V6), C closes (V3), Enter sends the update (V4), T shows the record fields, R replays.

---

## V1: The action log
*Idea.* The chair's view is a RAID-style table: every action of the body, grouped under the decision it came from (with that decision's status), with owner, due date (moved dates as seams), state, when it was set and how long it has been open. A summary line counts open, past their date, **done and waiting for you to close**, and closed this year. Beside it, the owner's view shows only the rows still theirs to answer, each with Done, Update and "Ask to move". The moment lights Jo's late row in the chair's table: one record, two views.

*Sources.* RAID and action logs (one owner, one date, one status); ADR 0026 (the Inbox: owner, state, `Ref` back to the app).

*What works.* It is the familiar form, and it adds the two things action logs usually lack: the decision's own status on the group row (D-118 is "worth revisiting", so its actions may be pointless), and "done, waiting for you to close" as its own count. "Ask to move" means a due date never moves silently: the chair agrees, and the old date stays.

*What fails or risks.* A table invites managing by table: sorting by lateness, chasing. With 200 actions it becomes the backlog nobody reads. It shows the chair everything at once, which is right for a body of six and wrong for an Org floor.

*Principles.* Explain, never hide: closed rows stay, quieter. Calm: one light. No letterbox.

*Needs.* Inbox items with `accepted`, `done`, `discharged` and `overtaken`; `moves[]` with reason and who agreed; a decision `Ref` on each item.

*Scores.* Clarity 5 · Distinctiveness 2 · Feasibility 5 · Fit 4

## V2: Your part, and the full score
*Idea.* The owner's view is a part, as in an orchestra. Jo's one entry (hire two fitters, due 30 June, ten days away) sits on her staff, with the now line, a cue above it ("bay fitted out, Sam"), and a **rest** after it: "nothing for you after 30 Jun from these decisions". The chair's view underneath is the full score: one row per owner, one bar per action from set to due, the same time scale and the same now line. The moment hands the part from Dana (done, resting) to Jo.

*Sources.* Orchestral parts and scores: entries, multi-bar rests, cue notes; the score prompt (F); one-now.

*What works.* **Rests are information.** "Nothing for you after 30 June" is as useful to Jo as the entry itself. The two views are visibly the same piece: Jo's bar in the score is her part. It is the clearest agreement with the score prompt and one-now: a decision's actions are entries on people's parts, and the decision is a rehearsal mark ("from D-118").

*What fails or risks.* Cues need dependencies AUGUR doesn't know: that the trial needs the bay and the fitters is in nobody's record. Here they are typed in the page; the score prompt hits the same gap. Most owners have one or two actions from decisions, so a part is mostly rest. That is honest, but it is a lot of screen for little ink. Unless it joins the intent work on the same part (F), it is thin.

*Principles.* One-now: strong. Calm: one change. Explain, never hide: the rest is a stated fact, not an empty space.

*Needs.* `after` links between actions (a cue), or between an action and a date in a decision ("trial starts 1 July"). A shared time-scale part in the kit (wear and time's `TimeScale`).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V3: An open question
*Idea.* An action is a question the chair asked. Each one shows four states on a line: **asked** (by the chair, at the meeting), **acknowledged** (the owner says "mine"), **answered** (the owner says done, with what shows it), **resolved** (the person who asked closes it). On 30 July, Sam has answered A-303 ("bay signed off by Ruth Mensah", 22 July). It is off his list but open on Marcus's, under "Answers waiting for you", with Close it and Send back. The page says how long it has waited and how long it will wait if left for matters arising on 8 September (**48 days**). The moment closes Ade's newer answer; Sam's older one still waits.

*Sources.* Question and answer (room tone: acknowledge, act and resolve are different states); RAID logs; read receipts.

*What works.* It makes the most useful distinction in the run concrete: **done is not closed**, and the person who asked is the only one who can close. The 48-day figure is a real finding in the data: actions are finished long before anyone confirms them, because confirmation waits for the next meeting. "Nobody else was notified" when something resolves is calm by design.

*What fails or risks.* A chair with thirty answers waiting has a new inbox to clear, a real cost. Allowing "close on the owner's word" as a body setting for routine actions would help. "Send back, with a reason" could feel like a rebuke; the words matter.

*Principles.* Explain, never hide: the waiting count and the evidence. Calm: closing tells nobody. No letterbox.

*Needs.* The four states as Inbox states (ADR 0026 has open, done, declined, handed on; it needs **acknowledged** and a split between **done by owner** and **closed by setter**). Evidence on "done" (a note or a `Ref`).

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V4: Matters arising
*Idea.* Open actions are asked about at the next meeting, not chased between meetings. The chair's paper for 13 October, item 2, lists every action the body has set that is not yet closed, oldest first, each with its owner's update **in the owner's own words** and a suggested question ("due 31 Oct, in 22 days. Will it land?"; "done since 29 Jul, never closed: close it?"). The owner's view tells Jo when she'll be asked and by when to send her update, with one reminder before the meeting and no other notices. The moment sends Jo's update; it lands on the chair's paper.

*Sources.* Board practice ("matters arising from the minutes"); newspaper editions and digests (the switchboard prompt): batching into a known rhythm.

*What works.* It is the calmest variant: the meeting's own cadence is the reminder schedule, and owners explain themselves before anyone asks. It caught Ade's action that was done on 29 July and never closed. The owner's update replaces a status field nobody fills in. It agrees with the switchboard prompt's "digests" and "quiet is a feature".

*What fails or risks.* A monthly rhythm is too slow for an action due in a week. Urgent actions still need a direct route (the switchboard's escalation). If an owner never writes an update, the paper says "No update yet", which is honest and a little public.

*Principles.* Calm: the strongest of the six. Explain, never hide. No letterbox.

*Needs.* A meeting's next date known to the actions (body cadence), an "update" field per action per meeting, and one scheduled reminder (the events service needs a clock: the briefing run's gap again).

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 5

## V5: Traced back
*Idea.* The owner reads up. Jo's Inbox item opens to a chain: your action ← asked by Marcus Hale (only he can close it) ← because of D-118 (worth revisiting) ← **it depends on you**: "two fitters in post by 30 June", the decision's assumption, today "1 in post since 9 Sep" ← which serves intent M-42. The chair reads down: a tree from intent M-42 to its decisions to their actions, with "not linked to an intent" as its own group ("which does it serve?").

*Sources.* Hierarchy without containers (batch 1 research): indentation and rules, no boxes; ADR 0025 (`Ref`s between apps); Mandate's intent-to-task cascade.

*What works.* "It depends on you" is the honest line: Jo's late action isn't just late; the decision rests on it. That is the reason to tell her the decision is worth revisiting before the meeting reverses it. The chair's tree shows decisions that serve no intent, which is a governance smell worth surfacing.

*What fails or risks.* The chain is long for a small action, so it should fold to one line ("from D-118, for M-42"). Linking decisions to intents is extra work at the table; without it the tree is all "not linked". It assumes every decision answers one intent; some answer two.

*Principles.* Explain, never hide: strong. Calm. No letterbox.

*Needs.* `decision.answers → intent Ref` (Mandate), `inbox.item.ref → decision Ref`, assumption ↔ action links.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V6: One now line
*Idea.* Every action on the floor on one time scale (May to December), grouped by decision, with one now line drawn once by the board. Bars run from set to due; closed ones are outlines with a closed mark where they were closed; overtaken ones are dotted; moved dates leave thin blue ticks where they used to be; lateness is a dashed stretch past the bar up to now. The owner's view is the same board lit for them, with everyone else at rest. The moment turns the chair's board into Jo's.

*Sources.* One-now (wear and time); Gantt baselines (planned against actual); the score's full score.

*What works.* Lateness becomes a distance you can compare across actions and decisions. A-302's two blue ticks and its long bar tell its story without words. "The same board, lit for you" is a better owner's view than a filtered list, because Jo can see that her late action sits under a decision whose other actions are all closed.

*What fails or risks.* Two days late is invisible at this scale; the dashes need a minimum width. Rows truncate at 1280. Dimming others to 28% is a focus-stacking move, and some owners will want them gone. Twenty decisions is a long board.

*Principles.* One-now: the strongest of the six. Focus stacking: others racked back. Calm.

*Needs.* The shared `TimeScale` / `TimeRail` parts (wear and time); moved-date history.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 5

---

## Ranking
1. **V3 An open question**: done is not closed, and only the asker closes.
2. **V4 Matters arising**: the meeting's rhythm as the reminder schedule; owners' own words.
3. **V1 The action log**: the familiar form with the decision's status beside each group.
4. **V5 Traced back**: "it depends on you" is what makes a late action matter.
5. **V6 One now line**: the board view, for the chair and the floor.
6. **V2 Your part**: right in spirit, thin until the score (F) joins intents and actions on one part.

## What I'd build first
The Inbox states from V3 (asked, acknowledged, answered, resolved, plus overtaken) with a decision `Ref` on every item. Then V4's matters-arising paper, generated for each meeting from the open items and the owners' updates. That replaces chasing with a rhythm and catches answered-but-never-closed actions. V1's table is the chair's full list; V5's chain is how an item opens; V6 is a view of the same data once the shared time scale exists.
