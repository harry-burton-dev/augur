# Surface 5 · Standby and go

**The moment:** at 08:41 the harbour log records the Ridge east cardinal buoy 0.2 nautical miles out of position. Notice drafter (rung 1, under Rhiannon Price, the harbourmaster) drafts Notice to Mariners 41/2026, checks the position against the buoy register and saves the draft, unpublished. All of that can be undone. Then it holds before two steps that can't: **publish** the notice to the Notices to Mariners library on the Org floor (640 people; it can be withdrawn but stays as withdrawn) and **email** it through the organisation's mail relay to 212 outside addresses (can't be unsent). It should go by 10:30, before a pilot boards at the Ridge; it lapses at 12:00.

**Data:** `DATA.standby` (the draft, the reversible steps done, the irreversible steps with reach and undo words, the go-by and lapse times, the deputy, the time-out checks, the read-back, the harbour log, other standbys on the floor). Keys differ per page and are shown in the top bar; R replays and T shows ADR words on every page. Rhiannon is the viewer.

**Rule common to all six:** an agent does every reversible part of a job itself and stops at the first step it can't take back. Anything on the ceiling list waits for a person at any rung. "Standing by" (acknowledged) is never a go. A standby nobody answers **lapses: it is not done.**

---

## V1: The cue light
*Idea.* The stage manager's cue light. The agent lights a steady lamp beside its mark in the shell's band; the panel says what it holds before. Rhiannon can answer "Standing by" (I have it, I'm reading it: not a yes), "Go" (the lamp goes out green, it acts) or "Hold". The protocol is written beside it: dark, standby, standing by, go.

*Sources.* Stage management calling (standby, standing by, go; cue lights that are on for standby and off for go); the room-tone run's question and answer.

*What works.* It separates three states every approval UI blurs: **asked, acknowledged, answered**. "Standing by" stops the agent asking anyone else without letting it act, which is what a supervisor needs at 08:55 when they've seen it but need a minute. A steady lamp in the band is the right size of signal: visible, never blinking, one per waiting standby.

*What fails or risks.* The theatre words need teaching; "Standing by" will be read as "go ahead" by some. The lamp competes with the band's other signals. Several standbys at once need a count, not several lamps.

*Principles.* Question and answer: strong. Calm: steady lamp, no loop. Letterbox: not here (see V2).

*Needs.* Inbox item states mapped: open = standby, claimed = standing by, done = go, declined = hold, expired = lapsed. ADR 0026 has open, done, declined and handed on; it needs claimed and expired. `--x-proposed-standby`.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit 5

## V2: In the Letterbox
*Idea.* A standby with a deadline before the supervisor would otherwise look is urgent, so it opens in the Letterbox (PDR-009): a 2.39:1 frame from `--letterbox-ratio`, bars from `--scrim`. The top bar carries what can't be undone and its reach (publish · 640 people · can be withdrawn; email · 212 addresses · can't be unsent); the bottom bar carries go by 10:30 and why, the lapse time and the deputy. The harbour log and the agent's mode line stay visible, desaturated, behind.

*Sources.* PDR-009 and the cinematic run's urgent path (the bars carry information, nothing outside the frame is hidden for good).

*What works.* It uses the accepted urgent pattern for the one kind of agent moment that deserves it, and the bars do real work: the consequence and the clock are in the frame's edges, the decision in the middle. Hand on is offered beside go and hold.

*What fails or risks.* If agents can open the Letterbox, a busy agent could take the screen too often. It must be the shell's rule (a standby whose go-by is before the supervisor's next look), never the agent's choice, and capped like the beacon (one at a time). Blur on the background costs on large screens.

*Principles.* Letterbox: strong. Focus stacking: the frame is the near plane. Calm at rest: it only opens for a deadline.

*Needs.* A go-by time on standbys; the shell's rule for when a standby is urgent; the Letterbox part in Common (built, unused).

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V3: Read back
*Idea.* Closed-loop go: the agent says what it will do with the numbers; the person reads back the one that can't be undone ("How many addresses will it email?"); only a match arms Go. A wrong read-back (640, the people, not the addresses) says nothing has been sent and to read again.

*Sources.* Air traffic control readback and hearback; closed-loop communication in surgery and emergency teams.

*What works.* It catches the commonest slip: approving the wrong scope. In the moment, typing 640 for 212 shows the person mixed up the library's readers with the email list, which is exactly the confusion a go button would have let through. It is reserved for steps that leave the deployment or can't be withdrawn.

*What fails or risks.* Friction. Used for everything, it becomes typing numbers by rote. People will copy the number from the sentence above. Accessibility: a typed number is harder than a button for some users; a choice of three numbers would also work.

*Principles.* Consequence preview made active. Calm.

*Needs.* A `readBack` field on the standby (which value, chosen by AUGUR's rule, not the agent), stored with the audit event.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 3

## V4: The cue sheet
*Idea.* The prompt book's cue sheet. Each step that can't be undone is its own numbered cue, in order: Q1 publish, Q2 email (waits for Q1), and the floor's other standby (Filing clerk's withdrawal, Tom Okoye's to call, shown but not Rhiannon's). Cues are called one at a time; there is no "go all".

*Sources.* The stage manager's prompt book and calling a show (cues numbered, called in order, each with its own standby).

*What works.* Splitting the job into cues lets a person **let the reversible-ish step go and hold the irreversible one** (publish now, email after a second look). Seeing other supervisors' standbys on the floor, clearly not yours, answers "is anything else waiting?" without giving anyone a button they shouldn't have.

*What fails or risks.* Most standbys are one step; the sheet is heavy for them. A list of other people's cues invites "can you just press it for Tom?" The order between cues has to come from the agent's plan, which must be fixed when the standby is raised.

*Principles.* Explain, never hide (others' cues visible, not callable). Calm.

*Needs.* Standbys as ordered steps, each its own checkpoint; a floor-wide view of open standbys.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V5: Silence is not a go
*Idea.* The standby's own clock: raised 08:52, the deputy also asked at 09:41 (halfway to go-by, by rule), go by 10:30, lapses at 12:00. Three columns say what happens if someone answers, if the supervisor doesn't, and if nobody does: it lapses, nothing is sent, the draft stays, the diary says "lapsed, not done", and the cost of not sending is written now, while there is time.

*Sources.* Fail-safe railway signalling (a signal with no instruction returns to danger); the dead man's switch, inverted (here, no hand on the control means stop, not go).

*What works.* It is the clearest statement of the run's most important rule. Asking another person is the only thing the clock does by itself; it never acts. Writing the cost of lapsing at the start ("the 10:30 boarding goes without the notice") makes the stakes plain without making the agent pushy.

*What fails or risks.* A deadline that lapses safely can still hurt (mariners without a notice). For truly time-critical safety notices, an organisation may want a rule that a standby goes to a duty officer, not just a deputy; that is still a person. The automatic deputy step needs a deputy to exist.

*Principles.* Calm: the clock is shown, not ticking. Explain, never hide: the cost of silence is stated.

*Needs.* `expiresAt` and an escalation rule (deputy at a fraction of the time) on standbys; an "expired, not done" Inbox state and diary entry; a deputy on every supervisor.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 4

## V6: Time out
*Idea.* The surgical time out. On the left, the job split in two: done already (can be undone) and on go (can't). On the right, four lines the agent filled in pencil (right buoy, right position, right readers, if it's wrong) that the person confirms one by one; Go arms on the last. "If it's wrong" is the undo plan for a thing that can't be undone.

*Sources.* The WHO Surgical Safety Checklist's time out (said aloud before incision; the team confirms patient, site, procedure); Gawande's pause points.

*What works.* "If it's wrong: withdraw it and send a cancellation notice" is the line nobody writes until it is too late. Making the agent draft the checklist and the person confirm each line gives the model a useful job (preparing) while keeping the decision with a person. The split is the clearest picture of "standby as small as it can be".

*What fails or risks.* Four confirmations per standby is a lot for routine notices; it should scale with reach (time out only above a reach threshold). People tick checklists without reading; the read-back (V3) is stronger for the one number that matters.

*Principles.* Pencil and ink per line. Calm.

*Needs.* Standby checks drafted by the agent with pointers to their evidence; a reach threshold set by AUGUR.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

---

## Ranking
1. **V5 Silence is not a go**: the rule the whole run rests on, stated plainly.
2. **V1 The cue light**: asked, acknowledged and answered as three states.
3. **V2 In the Letterbox**: the urgent case, with the consequence in the bars.
4. **V6 Time out**: the split and the undo plan.
5. **V4 The cue sheet**: one cue per step that can't be undone.
6. **V3 Read back**: right for email outside the deployment, too much elsewhere.

**What I'd build first.** The standby as an Inbox item with five states (standby, standing by, go, hold, lapsed), a go-by and a lapse time, a deputy asked by rule, and the steady lamp in the band (V1 and V5). The Letterbox (V2) only when the go-by falls before the supervisor's next look. The split (V6's left half) on every standby; the read-back (V3) only for steps that leave the deployment.

## Needs token
`--x-proposed-standby` and `--x-proposed-standby-wash` (the lamp and its panel) are this surface's own. V2 uses `--letterbox-ratio`, `--letterbox` and `--scrim` as PDR-009 says. All pages rely on `--font-mono`.
