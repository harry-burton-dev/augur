# Surface 4 · Escalation

**The moment:** a needs-you item nobody answers, moving along a rota, with handover. The main story is the survey plan: Owen named (Tue 12:30), Leila as his cover (Wed 08:00), the limit passing at 12:00, Ana on call asked at 12:00 and passing it on at 12:25 with a note, Tom (team lead) asked at 12:25 and taking it Thursday at 09:05. The second story is the gas safety returns: Tom named, Ana on call, the lead step skipped because Tom was already asked, and Dana Whitfield (Department admin) taking it Friday at 09:10. The urgent story is the ceiling leak at 02:14 on Saturday.

**The policy (set by Tom Ashby, readable by anyone on the team):** the person named, until the item’s limit or 4 working hours; their cover if they are away; whoever is on call, for 2 working hours; the team lead, for 8 working hours; the Department admin, who keeps it until someone takes it. Waits count the team’s working hours (08:00 to 17:30, Monday to Friday). Urgent: whoever is on call, then every 15 minutes the next step (lead, then Department admin). It never goes louder or faster. Taking it stops the climb; seeing it doesn’t. Passing it on asks the next step at once.

**Shared data and files:** see the grammar notes. Every step, skip, wait and stand-down is computed by `escalate()` in `lib.js`.

---

## V1: The ladder
*Idea.* The policy as a ladder, bottom to top: named, cover, on call, team lead, Department admin. Each rung shows who, when they were asked, when they saw it, whether they passed it on or took it, and when the next step would have begun. A lit marker climbs the rungs. Keys 1 and 2 switch between the two stories.

*Sources.* PagerDuty escalation levels. Hospital on-call ladders.

*What works.* It is the clearest single picture of a policy in action. The second story shows the skip rule honestly (“Team lead: skipped, already asked”) and that the ladder is in time, not in rank. Rungs not reached stay visible (“Dana Whitfield, not reached”).

*What fails or risks.* Vertical ladders read bottom-up, against the reading direction. With a cover step that isn’t used, a rung says “not needed: nobody was away”, which is honest but adds noise.

*Principles.* Explain, never hide: strong. Calm: the marker climbs once.

*Needs.* The policy store, and step history on Inbox items.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V2: The handoff strip
*Idea.* A flight progress strip for the item, in bays for each person. The rule is air traffic’s: the strip stays with its owner until the next one takes it. Offered strips are cocked (tilted, outlined) in the receiving bay, while the owner’s bay still holds it. ← → steps through the handoff. The moment stops at 12:25 on Wednesday: Owen still owns it (and is away), Leila and Tom have it offered, Ana has passed it on.

*Sources.* NATS flight progress strips. Sector handoff and the “cocked strip” convention.

*What works.* It makes **no gap** literal: there is never a moment when nobody owns the item, because offering doesn’t transfer ownership; only taking does. It also shows the uncomfortable truth of this policy: Owen owns it while he is on leave. That is either right (accountability) or wrong (he can’t act), which is a decision for Harry.

*What fails or risks.* Bays per person don’t scale past 6. Strips are a metaphor that works for operators and confuses office workers. The tilt is decoration if overused.

*Principles.* Explain, never hide: who owns and who is offered. Calm.

*Needs.* Owner and offered-to as separate fields on Inbox items (ADR 0026 has an owner only).

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit 4

## V3: The working clock
*Idea.* The item’s life on a working-time axis: nights and weekends fold into thin seams (“14 h 30 min folded”), because the policy counts working hours. Each person’s turn is a bar from when they were asked to when they took it, passed it on, or the next step began, with seen, passed, took and acted marks. The limit is a line. The summary says “1 d 22 h on the wall clock, but only 17 h of working time”.

*Sources.* Train graphs (Marey). Shift clocks. SLA “business hours” clocks.

*What works.* It explains why escalation feels slow or fast: it runs on the team’s clock, not the wall clock. It also shows a hidden cost: Owen’s bar runs the whole length, because he owned it until Thursday.

*What fails or risks.* Folded time is unfamiliar; the seams need their labels. Bars overlap in meaning (owner, offered). Good for a lead reviewing a case, not for the person acting now.

*Principles.* Calm: the now line runs once. Explain, never hide: folded time is labelled, not hidden.

*Needs.* The team clock as a policy setting. `--x-proposed-night`.

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V4: Bleep log and handover note
*Idea.* The item’s bleep log: when each person was asked, why, how long they took to call back (seen), and their answer (took it, passed it on with a note, or no answer, with when the next step began). Beside it, passing it on opens a handover note in SBAR form. Situation and Background are filled from the trail; you write Assessment and Recommendation. The note travels with the item.

*Sources.* Hospital bleep and callback practice. SBAR (NHS Institute). I-PASS handover.

*What works.* The note is the best idea for handover in the run: **whoever is asked next doesn’t start from nothing.** Half the note is free (from the trail), so the cost of a good handover is two sentences. The log also gives the real numbers: everyone called back within 10 minutes to 3 h 15 min, and nobody took it until the lead did.

*What fails or risks.* SBAR is clinical vocabulary. The letters can stay, with plain labels. A required note slows passing on in an emergency; it should be optional for urgent and required for needs.

*Principles.* Explain, never hide: strong. Calm: the note types itself once in the demo.

*Needs.* A note on pass-on and take in Inbox history.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 4

## V5: The board
*Idea.* A departures board of every open needs-you item on the team at a moment: the item, the app, who has it now, since when, who is asked next and at what time, and its state (open, taken, past limit, held). ← → moves the clock by the hour through the week, and the cells that change flip.

*Sources.* Departures boards. Ward whiteboards. PagerDuty incident lists.

*What works.* It makes the schedule visible to everyone, which was the prompt’s ask. At 12:30 Wednesday you can read “Sign off the winter damp survey plan · with Owen, Leila, Tom · next Dana, Thu 10:55 · past limit”. It never says why someone hasn’t answered, only who has it and what happens next.

*What fails or risks.* A team board of who hasn’t answered can turn into blame. Keep it to “who has it” and “next ask”, never response times per person. On a big team it needs filters.

*Principles.* Calm: nothing moves unless you move the clock. Explain, never hide.

*Needs.* A team-scope read of Inbox items (today the Inbox is personal).

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V6: Urgent at night
*Idea.* The ceiling leak at 02:14 in the Letterbox (2.39:1 from `--letterbox-ratio`). The top bar says what and whose rota; the bottom bar carries the schedule: Tom on call, emailed 02:14; team lead and on call skipped (Tom already asked); Dana Whitfield, Department admin, at 02:29. The clock runs: at 02:29 Dana is emailed; at 02:31 Tom takes it, and the bar says “Tom Ashby took it at 02:31. Dana Whitfield was stood down.” The “I have it” button is the lit signal. D shows Dana’s view: asked at 02:29, then “Tom Ashby has it”, which closes only when she presses Done.

*Sources.* PDR-009 (Letterbox). Bleep escalation. Room tone’s “the signal is the control”. The cinematic urgent path.

*What works.* The bars carry the schedule, so the letterbox isn’t empty chrome, and the stand-down is a designed moment rather than a silent removal. It is the known route for urgent: email through the organisation’s relay, the Letterbox when they come in, and a visible next step every 15 minutes.

*What fails or risks.* At 2 a.m. nobody is looking at AUGUR. The real channel is email, and AUGUR has no push or SMS. That is the gap: email at night is a weak bleep. The urgent repeat schedule (every 15 minutes) clashes with room tone’s doubling gaps; this page uses the policy step, not repeats.

*Principles.* Letterbox: on-model, the only use in the run. Calm: one thing moves, the clock. Question and answer: taking it is the answer; seeing it isn’t.

*Needs.* The urgent flag (ADR 0044 D3), urgency budgets (D4), and a decision on a channel that wakes people (push, SMS through the organisation’s gateway), which would need an ADR.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 5

---

## Ranking
1. **V4 Bleep log and handover note**: the note is the handover.
2. **V5 The board**: the schedule everyone can see.
3. **V1 The ladder**: the policy in one picture.
4. **V2 The handoff strip**: no gap, made literal.
5. **V6 Urgent at night**: right for urgent, limited by email.
6. **V3 The working clock**: a lead’s review tool.

**What I’d build first.** A policy store (team-owned, readable by the team) and three Inbox fields: taken by, offered to, and a pass-on note. Then show the next step on every needs-you card and the team board. The ladder and strip are two renderings of the same step history.
