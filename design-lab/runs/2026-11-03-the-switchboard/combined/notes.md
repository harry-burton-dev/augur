# Round 2 · Combined screens

Four screens that could ship, each built from the round 1 winners and the same `DATA` and routing model (`_src/lib.js`). Checked at 1600×900 and 1280×800, with R, T and each page’s own keys, and with reduced motion. There are no console errors and no sideways scroll.

---

## V1: The week replayed (`v1-the-week-replayed.html`)
The required screen: one week of a team’s notices replayed through the routing rules, showing every route taken.

*Idea.* A train graph of the week. Time runs left to right. The top line is the apps (a dot per notice), there is one lane per person (their working hours lit, quiet dark, away hatched, on-call days underlined in the team colour), and the bottom line is “Never told”. Every delivery drops from its app to the person: a hatched bar when held, a dashed stem when it waits for an edition, a dashed diagonal from the previous holder when the policy asks the next person, and a ring when they acted. Counters along the top tick with the clock: notices, told live, held, into editions, on a card, list only, asked next, taken or acted, never told, urgent. The side panel shows the selected notice’s every route in plain words, with receipts, passes and stand-downs. Space plays and pauses, 1 2 3 set the speed, ← → steps notice by notice. The moment runs the week to Wednesday 12:30 and stops on the survey plan.

*Sources.* Marey’s train graph. Switchboard operator logs. Flight progress boards. Grammar V3 (the exchange), Why V2 (the trace), Escalation V3 (the clock).

*What works.*
- It is the whole model on one screen: 41 notices, 54 deliveries, 7 stopped, 2 urgent, and every one explained in the side panel from the same trace.
- Patterns show at a glance. Owen’s lane is hatched from Wednesday, and two items arrive there as cards. Every weekday at 09:30 a dot falls to “Never told”. Tom’s lane is the busiest. Saturday at 02:14 a red drop reaches Tom, then a dashed one to Dana at 02:29. Sunday’s halted release reaches only Sam, with nobody else to ask (“rota: skipped → lead: skipped → admin: skipped”).
- It answers the control room question “what does a flood look like?” at team scale: you can see the week is calm, and where it isn’t.

*What fails or risks.*
- Lanes per person don’t scale past about 12. A Department replay needs lanes per team, opening into people.
- Dense days overlap. Monday morning’s six notices sit within a few pixels. It needs zoom into a day (the exchange view).
- A replay of who was told what is sensitive. It should be visible to the team lead and the people in it, never across teams. The side panel names people’s routes, which is the same privacy question as the trace.

*Principles.* Explain, never hide: strong (stopped notices have their own lane). Calm: it moves only when played. Focus: selecting a notice dims the rest, without blur.

*Needs.* Route traces stored per notice (or replayable from receipts). Person hours and away as data. `--x-proposed-night`, `--x-proposed-held`.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 5

## V2: Why, and change it here (`v2-why-and-change-it.html`)
*Idea.* Ana’s notifications with postmarks on the left. The selected notice in the middle: a because-sentence and the trace, with hops after hers faded. On the right, the settings that touch this notice: mute this app, toast for this level, the end of your day, and the rota (not yours, “Ask to swap”). Each has a live preview of what this notice would have done, and last week’s tally with the change. Nothing is saved until Save. The moment turns on “Mute Mandate” and the preview answers: “Inbox and List. You would still be asked: muting never takes you off a rota.”

*Sources.* Why V1 (postmark), V2 (trace), V3 (what would change it). My switchboard V3 (the sentence). The cinematic consequence preview.

*What works.* The question “why was I told?” is almost always followed by “how do I stop it?”, and this screen answers both in place, with the consequence before the change. The mute preview prevents the most common mistake (muting to escape a rota).

*What fails or risks.* Three columns is dense at 1280. The trace could fold to the because-sentence until asked. Only four settings are offered; the rest live in My switchboard.

*Principles.* Explain, never hide. Consequence preview. Calm.

*Needs.* The trace and a what-if over the person’s last week, server-side.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V3: Escalation with handover (`v3-escalation-with-handover.html`)
*Idea.* The survey plan’s escalation on one screen. Five bays (Owen named, Leila cover, Ana on call, Tom team lead, Dana Department admin) show each person’s state at the chosen moment: owner (away), offered and seen, passed on, took it, next at Thu 10:55. Below is a working-clock scrubber with each hop as a button and the nights folded, then the team board at that moment, and the handover note Ana wrote when she passed it on (S and B from the trail, A and R hers). ← → steps through. The moment plays up to Ana’s pass.

*Sources.* Escalation V1 (ladder), V2 (strip), V3 (clock), V4 (SBAR), V5 (board).

*What works.* It shows the three things the prompt asked for together: a schedule everyone can see (the board and “next at”), handover with no gap (owner versus offered), and a note so the next person starts informed. It is also a good support view (“why did this take two days?”).

*What fails or risks.* Too much for the person acting. They need the card with the next step and the note. This is the lead’s or support’s view. The owner-while-away state (Owen) is shown honestly and remains a decision.

*Principles.* Explain, never hide. Question and answer: seen, taken and done are separate states. Calm.

*Needs.* Inbox fields: offered to, taken by, pass-on note. A policy store and team board read.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V4: The app owner’s report (`v4-the-owners-report.html`)
*Idea.* Admin, Apps, Repairs tracker, Notices: six numbers (18 sent, 17 told, 6 held, 11 seen, 6/7 needs-you acted on, 41 never told), the by-kind table with route bars, the returned-to-sender list with one Ask button per blocker, and an inline dry run. The moment changes the dry run from the Department (reaches nobody) to the team (5 later).

*Sources.* App owner V2, V3 and V6. Email campaign reports.

*What works.* It replaces “check your service log for a 403” with a page that says what happened and who can change it. The dry run sits where the owner is already looking, so the next send is checked before it goes.

*What fails or risks.* Owners of apps with dozens of kinds need paging. The never-told number is alarming out of context; the returned list beside it is the context.

*Principles.* Explain, never hide: strong. Calm.

*Needs.* Refused sends recorded in the events service; per-app counts; `dryRun`.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 4
