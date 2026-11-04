# Surface 2 · What the agent did while I was away (the site diary)

**The moment:** Ana Ferreira, Vessel Records lead, comes back on Monday 9 Nov at 09:04 after leaving on Friday at 17:10. Over the weekend two agents worked on her floor: Survey reader (hers, rung 2) ran four times and Filing clerk (Tom Okoye's, rung 3) filed certificates. The diary holds ten entries: three batches (46 details), four details held one by one, one disagreement, eleven certificates filed, one standby (Filing clerk wants to withdraw three superseded certificates, for Tom), one survey outside its scope (a Department-floor vessel), and six reports that waited overnight because Survey reader hit its 500 model calls on Sunday.

**Every count on every page is summed from `DATA.diary`**, so the six variants can't disagree. Keys: R replays, T shows ADR 0014 words (runs, checkpoints, grants), G turns the model gateway off.

---

## V1: The site diary
*Idea.* One ruled page a day (Fri, Sat, Sun, Mon), the same four headings on every page in the same order (Done, Waiting for you, Stood by, Couldn't do), each with its count, and "nothing" written where nothing happened. A countersign box at the foot of each day ("I've read Fri"); Monday can't be signed until the day ends. A summary strip on top.

*Sources.* The clerk of works' site diary (a daily record on a building site, kept by one party and countersigned by another); the ship's deck log (same columns every watch).

*What works.* Fixed headings make absence visible: "Nothing it couldn't do" is information, and a reader learns where to look. The countersign separates "I've read the record" from "I've accepted the work", which no other variant does as plainly. It is the most honest record for an audit: every day has a page whether or not anything happened.

*What fails or risks.* Four columns of mostly "nothing" is a lot of reading for a quiet weekend. Days are the wrong unit when runs cross midnight (Monday's 00:00 batch is really Sunday's work). Signing four days in a row becomes a ritual people click through: the signature needs to mean something (see V5, where the signature is earned by a sample).

*Principles.* Explain, never hide: strong. Calm: still at rest; only the oldest unsigned day is lit. Many deployments: headings are fixed by AUGUR, contents are data.

*Needs.* A diary day as an object in the runs service (`countersignedBy`, `at`), built from run steps and checkpoints. The audit log has the events; the day page doesn't exist.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V2: Night orders
*Idea.* Before leaving, the supervisor's orders for the agent are written on the left page (drafted from its indenture and rungs, with one order of Ana's own: "call me, or Tom, if something can't wait until Monday"). On the right, the log answers each order, line for line, with a verdict: kept, or kept late with the reason. A footer says whether anyone was called.

*Sources.* The master's night order book at sea (orders for the night watch, signed by each officer; the deck log answers); standing orders.

*What works.* The diary is read against what was asked, which is how a supervisor actually thinks ("did it do what I told it?"). "Nobody was called" is the dark-when-normal headline, and it is earned: the page shows why nothing needed Ana. Order 7 (call me if it can't wait) gives the supervisor a say in escalation without giving the agent a way to reach anyone else: calling the supervisor is the one person it may tell.

*What fails or risks.* Most orders are the indenture again; writing them each time would be busywork, so they must be drafted from the grant and only edited. "Kept, late" depends on a judgement of what "late" means. An agent with twenty orders makes a long page.

*Principles.* Calm: strongest of the six (the page's verdict is "nothing needed you"). Explain, never hide: each order says how it was kept.

*Needs.* "Call me if" as an escalation rule in the grant (who, on what); a checkpoint flag "can't wait" set by rule (a deadline before the supervisor is back), never by the model.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V3: The handover
*Idea.* The agent hands over like a nurse at shift change: Situation, Background and Assessment are ink, built from the diary by template; the Recommendation (what to look at first) is pencil, drafted by the model, and the only pencil on the page. Ana reads back four counted lines and presses "I have it"; accepting the handover accepts none of the work. With G off, the recommendation falls back to "oldest first".

*Sources.* SBAR (situation, background, assessment, recommendation) and I-PASS handoffs in hospitals; read-back from closed-loop communication.

*What works.* It reads like a colleague, not a log, and it puts the one thing a model is good at (ordering the work by what matters) in pencil where it belongs. The read-back is the cheapest form of "I know what's waiting for me". It is the variant most like the prompt's "agent as a colleague".

*What fails or risks.* "A pilot boards it on Wednesday" in the recommendation is a fact the model pulled from somewhere; it has to point at a record or it is a guess dressed as ink (pencil and ink: each phrase must point at a fact on the page). A handover from three agents is three handovers. People may skip the read-back.

*Principles.* Pencil and ink: strong (only the recommendation is model text). Calm: given once, in order.

*Needs.* Recommendation items with pointers to diary lines (`ref`), and a template fallback; an acknowledgement event on the handover.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V4: One time scale
*Idea.* The whole absence on one horizontal scale from Friday 17:10 to now, a lane per agent, runs as bands, nights shaded. Marks sit where something waited, was done or couldn't be done, each with its count. The limit is a hatched gap from 22:51 to 00:00; the standby is a lit line from Sunday 14:20 to now; past the now line, a dashed blue "next: propose" shows what is armed. ← → steps through marks; the panel below explains each and offers its one action.

*Sources.* Marey's train graph (time across, one line per train); the wear-and-time run's one time scale and now line; the flight mode annunciator's armed mode.

*What works.* It is the only variant that shows **how long** something has waited (the standby line is 43 hours long), and the only one with what happens next drawn on the same scale. Gaps are visible as gaps. It scales to a week by changing the axis.

*What fails or risks.* Most of the chart is empty night. Marks that fall close in time stack and need a stagger. It is a picture of time, not a list of work: you still need the panel to act. Small marks are a poor target at 1280.

*Principles.* Explain, never hide: the gap and the standby line are honest. Calm: still at rest. Focus: the selected mark is the only bright thing.

*Needs.* Run start and end times, which the runs service has; the "next" step (see grammar V6).

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V5: Signed by sample
*Idea.* Each batch is a lot. AUGUR draws a sample from a fixed table by batch size (≤10: 2, ≤20: 3, ≤30: 4, ≤45: 7…), taking one from each issuer and each kind of detail first. Ana marks each sample detail right or wrong (Y, N). All right: the batch is signed with one name and every detail becomes ink, "accepted by Ana in a batch of 22, 4 checked". One wrong: the whole batch goes back to one by one.

*Sources.* Acceptance sampling (ISO 2859; acceptance number 0); auditors' sampling; stratified sampling.

*What works.* It is the mechanism that makes rung 2 real: **trust changes the sample, not the signature**. A person still signs every fact; the rung decides how much they look at first. Recording the sample with each detail means a later mistake shows which sample let it through, which is exactly what the mistake surface needs (the Nordhavn certificate in Thursday's sample was the new layout). Stratifying by issuer is the lesson that mistake teaches.

*What fails or risks.* A batch of 46 at 2 minutes a check is still work; the table must be tuned per kind of work. Acceptance number 0 is strict: one typo sends 22 details back, which may push supervisors to mark near-misses as right. Sampling theory assumes independent errors; an agent's errors are correlated (same rule, same layout), which is why the stratification matters more than the size.

*Principles.* Explain, never hide: strong (the table and the drawing rule are on the page). Calm: no motion except the draw. Pencil to ink is one visible step.

*Needs.* A batch accept in Triage that records the sample ids and the table row; stratification keys from the agent (issuer, layout, kind of detail); a sample table per kind of work, owned by AUGUR.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V6: The walk-round
*Idea.* A marked-up plan of the Vessel Records floor: rooms for the places agents work (Incoming and Vessel surveys in Artifacts; Triage and Vessels in Data Atlas), with numbered pins where they stopped and a dashed line for the walk in time order. The Department floor above is drawn hatched: they may read there but not propose. A side list gives the stops in order.

*Sources.* The clerk of works' snagging walk (a marked-up plan with numbered snags); site plans; the catalogue run's "where" views.

*What works.* It answers "where did it touch my stuff?" at a glance, and makes untouched rooms visible as untouched (Incoming: no stops). The hatched floor above makes scope a place, not a rule. It would scale to an admin's view of all agents on a floor.

*What fails or risks.* The walk line is decoration: time order is better read in V4. Room layout is arbitrary (there is no real geography between Triage and Vessel surveys), so the plan implies a space that doesn't exist. Pins inside rooms pile up when one place gets most of the work (Triage has five).

*Principles.* Explain, never hide: scope drawn as a hatched floor. Calm: the walk draws once.

*Needs.* A "place" (app plus collection) on each diary entry, which the run steps have as the target of each write.

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 3

---

## Ranking
1. **V2 Night orders**: reads the absence against what was asked; "nobody was called" is the calm headline.
2. **V5 Signed by sample**: the mechanism rung 2 needs, and the record the mistake surface needs.
3. **V4 One time scale**: how long things waited, and what is armed next.
4. **V1 The site diary**: the audit record behind the others.
5. **V3 The handover**: the colleague's voice, if its pencil stays pointed at facts.
6. **V6 The walk-round**: a nice picture, the weakest answer.

**What I'd build first.** The diary day as a record in the runs service (V1's data), shown first as V2: the supervisor's standing orders, drafted from the grant, answered line by line, with "nobody was called" when nothing needed them. Batches open into V5's sampling. V4's time scale is the diary's second tab.

## Needs token
Carried: `--x-proposed-unseen`, `--x-proposed-quiet`, `--x-proposed-type-micro`, `--x-proposed-lit`, `--x-proposed-lit-wash`, `--x-proposed-disagree`, `--x-proposed-disagree-wash`, `--x-proposed-pencil`, `--x-proposed-pencil-wash`. New in this run: `--x-proposed-standby`, `--x-proposed-standby-wash`, `--x-proposed-ceiling`, `--x-proposed-mark-size`. V4's night shading mixes `--shade`; a `--x-proposed-night` would name it. All pages rely on `--font-mono`.
