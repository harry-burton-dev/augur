# Shortlist: the apprentice

Ranked by what I'd build first. The headline: **an agent works in pencil under a named person, and the only thing trust changes is how much of its work a person samples, never whether a person signs.** Anything it can't take back waits for a go, and silence is never a go.

| # | Build | Look at | Why it ranks here |
|---|---|---|---|
| 1 | **Pencil with a maker's mark, and the mode line**: every agent output carries its monogram, dotted while pencil and kept after a person accepts it; wherever its work shows, one line says what it is doing now, what it will do next, what stops it, and why it last changed | [The marks](grammar/v4-marks.html), [Now and next](grammar/v6-mode-line.html), [Two hands in Triage](proposal/v6-two-hands.html) | Every other item uses them. It needs only `proposedBy`/`acceptedBy` and the run's current and next step in words. |
| 2 | **Standby and go**: the agent does every reversible part itself and holds at the first step it can't take back. Five states (standby, standing by, go, hold, lapsed), a go-by time, the deputy asked by rule, a steady lamp in the band. A standby nobody answers **lapses, not done**. The Letterbox only when the go-by falls before the supervisor's next look | [From standby to go](combined/v3-standby-to-go.html), [Silence is not a go](standby/v5-silence.html), [Cue light](standby/v1-cue-light.html), [Time out](standby/v6-time-out.html) | It is the line between an assistant and a liability. "Standing by" (acknowledged, not a yes) fixes the blur every approval screen has. |
| 3 | **A rung per kind of work, with a cap and an end date**: four rungs (Shadow, Asks each time, Asks for the batch, Acts then shows), none above 3. The kind of work sets the cap (facts for Data Atlas cap at 2, because nothing skips Triage); the supervisor sets the rung with a reason; every widening is a permit that lapses after 12 weeks unless renewed; widening offers a replay first | [The rung, previewed](scope/v1-rung-preview.html), [The masterpiece](scope/v5-masterpiece.html), [Permits](scope/v3-permits.html), [The agent's page](combined/v4-the-agent-page.html) | Trust per kind, not per agent, is what let Ana keep class survey details at 2 while narrowing Nordhavn alone. Lapsing means an unwatched agent drifts back to asking, never forward. |
| 4 | **Trust changes the sample, not the signature**: at rung 2 a run's work waits as one batch; AUGUR draws a sample from a fixed table, across issuers **and their layouts**; one wrong sends the batch back; signing records the sample on every detail. A detail read by only one reader is always in the sample; a disagreement never goes in a batch | [Signed by sample](diary/v5-by-sample.html), [Read twice](proposal/v4-two-readings.html), [A week in Triage](combined/v1-a-week-in-triage.html) | It cut the supervisor's checking from 46 to 14 minutes a day, and when it failed, the recorded sample showed exactly why. |
| 5 | **The site diary, read against your orders**: a day page per agent built from the run's steps (done, waiting, stood by, couldn't do), countersigned; shown first as the standing orders answered line by line, "Nobody was called" when nothing needed you | [Night orders](diary/v2-night-orders.html), [Monday morning](combined/v2-monday-morning.html), [One time scale](diary/v4-one-time-scale.html) | "What did it do while I was away?" answered against "what did I tell it?", in one screen, with the calm headline earned. |
| 6 | **Mistakes have siblings**: one wrong detail recalls its lot (same agent, kind, issuer, detail, runs); each repair leaves a seam; anyone who sees the work can pull a cord that pauses that one kind of work; the scope review narrows only what failed and says the way back | [Recall by lot](mistake/v2-recall.html), [The andon cord](mistake/v6-andon.html), [The seam](mistake/v1-the-seam.html), [The scope review](mistake/v5-scope-review.html) | An agent's errors are systematic, so one found means more exist. Six of nine Nordhavn tonnages were wrong; the recall found them in minutes. |

**Worth keeping as options:**
- [The handover](diary/v3-handover.html): SBAR in ink with the recommendation in pencil and a counted read-back.
- [The source beside the claim](proposal/v2-source-beside.html): the fastest check of a reading, once passages carry positions.
- [The fence](scope/v2-the-fence.html): scope as the floor rule people already know (read upward, write on your own floor).
- [Read back](standby/v3-read-back.html): only for steps that leave the deployment (email through the relay).
- [The cue sheet](standby/v4-cue-sheet.html): one cue per irreversible step, called in order, no "go all".
- [The review](mistake/v3-review.html): five questions, four by template; question 4 ("why the checks didn't") is the useful one.
- [What the undo touches](mistake/v4-undo-reach.html): corrections to the owners of what used the wrong number, sent by the supervisor.

**Not worth pursuing:**
- [The life of a piece of work](grammar/v3-lifecycle.html) as a screen: right for the ADR and the kit, not for people.
- [The walk-round](diary/v6-walk-round.html): the plan implies a geography that doesn't exist.
- The "in a row" streak in [the marking scheme](proposal/v5-marking.html): it turns checking into a game. Keep the fixed reject reasons.
- [The logbook](scope/v4-logbook.html) as its own page: it belongs as the record tab of the agent's page.
- [Who answers for what](grammar/v5-who-answers.html) as a screen: it belongs in docs/agents.md.

**Answers to the prompt's questions:**
- *Which actions an agent must never take alone in AUGUR.* At any rung, an agent stands by for a person before it would:
  1. delete, purge or withdraw anything;
  2. publish, share or send anything people will read (including email through the organisation's relay);
  3. tell anyone but its supervisor;
  4. accept a proposal, its own or another agent's;
  5. choose between sources that disagree;
  6. change an intent's state, owner or deadline;
  7. approve anything;
  8. change its own scope, rung or grants;
  9. work on a floor it isn't granted, or open restricted records;
  10. act as a person (it always signs as itself, ADR 0008).

  This list is AUGUR's, the same in every deployment; no grant or supervisor can lower it. One clarification the run needed: filing that keeps the same readers (moving a certificate from Incoming to Vessel surveys on the same floor) is reversible work, not publishing; anything that widens who can read is publishing.
- *What ADR 0014 needs to add.* It already has agents as apps, durable runs, grants at start, checkpoints to the Inbox, budgets, cancel and audit. It needs:
  1. **A supervisor and a deputy** in the grants at start. No supervisor, no run: if the post is empty, the agent pauses.
  2. **A rung per kind of work, with a cap**: four rungs, none above 3; caps set by AUGUR and the app (facts cap at 2).
  3. **An end date on every widening**, renewed by a person, or the kind drops back to rung 1.
  4. **The ceiling**: a fixed set of standby checkpoint kinds.
  5. **Standby states and timing**: standing by (claimed), go, hold, lapsed (expired, not done), a go-by, a deputy asked by rule. ADR 0026's Inbox needs "claimed" and "expired".
  6. **`proposedBy` and `acceptedBy` on every output**, kept after acceptance; a batch accept records its sample.
  7. **The site diary**: a day page per agent built from the run's steps, countersigned.
  8. **Now, next and why**: the run's current step in words, its armed next step and a reason on every change of mode.
  9. **Pause one kind of work**, open to anyone who can see the work; only the supervisor resumes.

  The combined [agent's page](combined/v4-the-agent-page.html) pins each addition to where it shows.
- *How agent proposals differ from people's in Triage and the Inbox.*
  - **Who wrote it**: a person by name; an agent by its mark, with its supervisor named.
  - **How it looks**: a person's is plain; an agent's is pencil (dotted, italic) until accepted.
  - **How it comes**: one at a time; an agent's by run (a batch at rung 2, one by one at rung 1).
  - **What it carries**: whatever source the person names; an agent's carries its workings (page, passage, both readings, the model step).
  - **Who may accept**: any reviewer but the author; an agent's only a person, its supervisor or deputy, never an agent.
  - **After acceptance**: ink with the author's name; an agent's keeps its mark and "accepted by …", and counts on its record per kind.
  - **In the Inbox**: one item for the floor's reviewers; an agent's is one item per run for its supervisor, not one per detail, so Inbox counts stay human-sized.

**Where these push back:**
- **Trust is not earned by accepted work alone.** The prompt says scope widens as work is accepted. The week shows why that isn't enough: a random sample missed a systematic error, and two readers with the same wrong idea agreed. Widening should need a replay on work people already checked, sampling should be stratified by source and layout, and every widening should lapse unless renewed.
- **The level belongs to a kind of work, not to the agent.** One agent at one level would have forced Ana to narrow everything after the Nordhavn mistake (+230 checks a week) instead of one kind (+6).
- **Batching saves time only at volume.** For links (25 a week) the batch and its sample cost the same 25 minutes as checking each. Don't widen low-volume kinds.
- **No veto timer, even for convenience.** Sheridan and Verplank's level 6 ("goes ahead unless you stop it") will be asked for. The run says never: a standby lapses.
- **The cord widens who can affect an agent.** Anyone who can see its work can pause one kind of it. That is new, and safe (a pause loses nothing), but it is Harry's decision.
- **Agents never open the Letterbox.** A standby goes there only by the shell's rule (a go-by before the supervisor's next look), capped like the beacon.

**Decisions for Harry** (none taken):
1. Adopt the four rungs with a cap per kind of work, none above rung 3 and no veto timer? I recommend yes, written into ADR 0014.
2. Make the ceiling a fixed AUGUR list that no deployment can shorten? I recommend yes.
3. "No supervisor, no run": pause an agent when its supervisor leaves or is removed? I recommend yes, with the deputy taking over for up to a week.
4. Widenings lapse after 12 weeks unless renewed? I recommend yes; the period could be an organisation setting with a floor.
5. Open the cord (pause one kind of work) to anyone who can see the work? I recommend yes, with a reason required and the supervisor told.
6. Does a batch accept with a recorded sample satisfy Data Atlas's "nothing skips Triage"? I recommend yes: a person signs every fact, and the record says how much they looked at.
7. A standby with a go-by before the supervisor's next look opens the Letterbox. That extends PDR-009's use; does it need its own Proposed record?
8. Agents carry a 2–3 letter maker's mark in the manifest `agents` block, chosen by the app and checked for clashes at install?

**Gaps:**
- Tokens (each listed as "needs token" in the critiques): `--x-proposed-standby`, `--x-proposed-standby-wash` (the lamp), `--x-proposed-ceiling` (the ceiling bar), `--x-proposed-mark-size` (the maker's mark). Carried from earlier runs and still needed: pencil, seam, disagree, lit, unseen, quiet, micro type. Every page relies on `--font-mono`, which still needs an ADR.
- A sampling table per kind of work, owned by AUGUR, and its strata.
- The pattern readers per kind of detail (an agent app's job, but AUGUR should require one for rung 2).

**Data the shell doesn't have yet:**
- The run's current step in plain words, its next step, and a reason on every mode change (for the mode line).
- Inbox states "claimed" and "expired", a go-by, a lapse time, and escalation to a deputy (standby).
- `proposedBy` with agent and supervisor on Triage proposals; batch accepts with sample ids.
- Lot keys on every proposal (agent, kind, issuer, layout, detail, run), a "recalled" state and batch undo with seams.
- A detail history in Data Atlas (proposed, accepted, disputed, repaired) with actors.
- Events for "a detail you used was repaired", for Mandate bindings and Artifacts briefings.
- Weekly volume and checking time per kind of work; shadow runs that compare with Triage verdicts.
- A paused flag per kind of work with who and why; a diary day object with a countersignature.
