# Shortlist: the minute

Ranked by what I'd build first. The headline: **a decision's words are agreed once, in the room, and never edited; everything else about it (its status, its actions, what it rests on and who relies on it) is read from records and moves beside the words.** A reversal is then just the next decision: the old record stays whole and points forward, and everything that leaned on it gets a seam and, where someone must act, one job.

| # | Build | Look at | Why it ranks here |
|---|---|---|---|
| 1 | **Words fixed, status beside them**: a decision record type in Mandate whose words can't be edited, whose status (in force, worth revisiting, amended, reversed, complete, lapsed) is computed from dates, watches and later decisions, and a `DecisionRef` chip any app can cite that always shows the current status | [The record](combined/v2-the-record.html), [The marks](grammar/v4-marks.html), [Chip, card, page](record/v5-three-sizes.html) | Everything else hangs on it. The live citation alone fixes "a procedure still says we do X, but we reversed X in November". |
| 2 | **Actions are open questions**: four Inbox states (asked, accepted, answered, closed) plus overtaken. The owner says done; only the person who asked closes it. One owner and one date, or it can't be recorded | [An open question](actions/v3-open-question.html), [One owner, one date](live/v5-one-owner-one-date.html), [From the table to the reversal](combined/v1-table-to-reversal.html) | The data found A-303 done on 22 July and closed on 8 September: 48 days nobody could see. "Done is not closed" is the cheapest fix in the run. |
| 3 | **Agreed in the room**: the agenda is the form (slots laid out from each paper), the model hears in pencil, the chair reads back, and each person present answers "that is what we decided". Assent to the record is separate from the vote | [Minuting live](combined/v3-minuting-live.html), [The room agrees](live/v4-the-room-agrees.html), [The agenda is the form](live/v1-agenda-is-the-form.html) | Minutes written as you go and agreed by those present, without a second meeting. Ade abstains on the vote and still confirms the minute is right. |
| 4 | **Revisit lines**: every decision says at the table what would reopen it, and what it assumes. AUGUR watches both; crossing a line marks the decision "worth revisiting" and asks the chair once. A watch never reverses anything | [The line is crossed](revisit/v1-the-line-is-crossed.html), [Then and now](record/v2-then-and-now.html), [Decided versus said](grammar/v3-ratio-and-obiter.html) | D-118 failed on "two fitters by 30 June", said in passing by Jo. Making the assumption a watched part of the record is what lets a reversal be explained. |
| 5 | **The wake**: AUGUR knows everything that rests on a decision (actions, documents that cite it, forecasts, later decisions). Revisiting shows it before the vote; reversing turns it into seams and named jobs; the news goes to exactly the owners it touches | [The wake](revisit/v2-the-wake.html), [Kept, with seams](revisit/v3-seams.html), [Who is told, and why](revisit/v6-who-is-told.html) | It is the run's strongest new idea. Reversing D-118 costs three jobs, two document editions and a forecast; keeping the bay is free. The room should see that before it votes. |
| 6 | **The log, three ways in**: ask it a subject, open it at a date, or read it by meeting. Every answer is built from records by template, with its workings | [The floor's log](combined/v4-the-log.html), [In force on a date](log/v2-in-force-on.html), [Ask the log](log/v4-ask-the-log.html) | "What was in force on 1 August?" is the audit question, and `@date` makes it an address. |
| 7 | **Matters arising as the rhythm**: open actions are asked about at the next meeting, in the owner's own words, with one reminder before it. No chasing between meetings | [Matters arising](actions/v4-matters-arising.html) | The calmest variant in the run. It also caught an action done in July and never closed. |

**Worth keeping as options:**
- [The argument](record/v4-argument.html) (Toulmin): the only view that shows *which* leg gave way. The "rule it takes for granted" (the warrant) is what broke. It is an optional field, maybe pencil.
- [From the table to the reversal](combined/v1-table-to-reversal.html) as the record's history mode (it does [a decision's life](record/v6-biography.html) better).
- [Five ways to revisit](revisit/v4-five-verbs.html): "let it lapse" warns when a decision replaced something and lapsing leaves a gap.
- [The line of a question](revisit/v5-the-line.html): the answer to "who inspects the vans?" on any date.
- [The subject index](log/v5-subject-index.html), with locators that carry their status.
- [Read back](live/v2-read-back.html): model transcription, opt-in per body, with retention on screen.
- [One now line](actions/v6-one-now.html) for the chair's board.

**Not worth pursuing:**
- [Standby and go](live/v6-standby-and-go.html): the letterbox for recording a decision. See push-backs.
- [The minute book](log/v6-minute-book.html) as a book. Keep its confirmation stamp and correction seam.
- [Your part](actions/v2-your-part.html) on its own: actions from decisions are too few to fill a part. Wait for the score (F) to put intents and actions on one part.
- [Lifelines](log/v3-lifelines.html) as the log's default: a good overview, a poor list.
- [Five forms](grammar/v5-five-forms.html) as anything but an argument for the fields.

**Answers to the prompt's questions:**
- *Where decisions live: Mandate, Artifacts, or their own record type?* **Their own record type, in Mandate.** An intent asks; a decision answers. Mandate already holds "what the org has asked for" and its discussion (ADR 0028), so a decision is the natural outcome of an intent, with its own `Ref` (`mandate / decision / D-118`) that other apps cite.
  - **Not Artifacts.** A decision isn't a document: it has a status that moves, actions with owners, and watches. Artifacts holds the **minutes**: a document per meeting that transcludes the decisions by `Ref`, gets confirmed by the next meeting, and keeps corrections as seams.
  - **Actions live in the Inbox** (ADR 0026), each with a `Ref` back to its decision.
  - **The decision log** is a Mandate view per body and per floor.
  - Not a new app, and no new service.
- *How do decisions link to the intents and facts they rest on?* By `Ref`s, the way ADR 0025 links apps to entities:
  - `answers → intent` (Mandate).
  - `restsOn[] → fact | saved question | document | intent`, each with **its value at decision time**, so "then and now" works without diffing history.
  - `assumptions[]` and `revisitIf[]`, each optionally bound to a saved question in Data Atlas, which is what the watch reads.
  - `affirms | amends | reverses → decision`, to other decisions.
  - Going the other way, apps publish `bound` events when they cite a decision (a document's citation, an intent's forecast, an Inbox item). That gives "what points at this decision": the wake. Citations render the decision's status live.
- *How does this agree with the score (F) and the switchboard (O)?*
  - **The score (F) agrees on:**
    - actions are entries on people's parts;
    - "nothing for you until …" is a rest;
    - a decision is a rehearsal mark you can say aloud ("from D-118");
    - every time view shares one rail and one now line ([one now line](actions/v6-one-now.html), the [six-month rail](combined/v1-table-to-reversal.html)).
  - **Clash with the score:** cues need dependencies, and this run kept actions flat (one owner, one date, as RAID logs do). Only two real cues turned up in a year ("after the bay is fitted"). I'd allow one optional `after` link per action, not a dependency graph.
  - **The switchboard (O) agrees on:**
    - matters arising is the digest rhythm;
    - a reversal is a domain event, and the Inbox items it makes are "needs";
    - routing comes from the wake ("why was I told: you own an action D-131 sets");
    - receipts (told, seen, acted);
    - every affected person who is *not* told is listed with the reason;
    - quiet is the default.
  - **Clash with the switchboard:** it wants unanswered "needs" to escalate along a rota. This run says a late action goes to the next meeting with the owner's reason, not up a chain. The rule I'd propose: **actions from decisions don't escalate; the chair sees "not seen" and "late" in his log.** Only a "needs" with a deadline inside a week may escalate.

**Where these push back:**
- **On PDR-009 (letterbox):** [standby and go](live/v6-standby-and-go.html) shows that framing every recorded decision would spend the letterbox on things that are important but not urgent. A meeting of eight decisions would see it eight times. Keep it out, or limit it to a kind of decision whose settings say "high stakes", and only once an urgency budget exists.
- **On "reversal is visible":** visible must not mean loud. A reversal shows as a hatched record with a pointer, and as seams where it was cited. Only the owners of new or withdrawn work get an Inbox item. No banners, no notices to readers.
- **On "minutes are written as you go":** yes, but the next meeting still confirms them, because people spot errors later (the [minute book](log/v6-minute-book.html)'s correction of a wrong date). Agreeing in the room makes the confirmation quick; it doesn't replace it.
- **On the prompt's "a decision is a record, not a sentence in a chat":** many real decisions are made in a thread, not a meeting. Mandate's discussion (ADR 0028) needs a "mark as decided" that drafts a record and asks the people in the thread to assent, as the room does. Not prototyped here.
- **Not every decision needs the full form.** "Routine business" (bring a meeting forward, sell two pool cars) should be one line with no evidence, no lines and no bar.
- **A watch never changes a decision beyond "worth revisiting".** Automation that reverses or suspends a decision would take the decision away from the people who made it.

**Decisions for Harry** (none taken):
1. **A decision record type in Mandate, with its own `Ref`.** Recommended. It needs a record in augur-mandate (the record type) and an AUGUR ADR for the cross-app part: `decision` as a `Ref` type that other apps cite and publish `bound` events for.
2. **Inbox states.** Add *accepted* and split *done* (owner) from *closed* (the person who asked), plus *overtaken* when a decision withdraws it. This changes ADR 0026's state set, so it needs a new Proposed record. Recommended.
3. **Words immutable once agreed;** corrections only through the next meeting's confirmation, as a seam. Recommended.
4. **Revisit lines: required or nudged?** I recommend nudged, with a default review date per kind of decision when none is set.
5. **The model hearing meetings (transcription):** allowed? If yes, I recommend off by default, opt-in per body, retention on screen (30 days suggested), and the model only ever drafts in pencil.
6. **Standard of proof per kind of decision** (carried from the briefing run): per kind, set by the kind's owner. Recommended.
7. **Body settings:** decides by vote or by consensus; records votes by name or by count; who may close actions (only the setter, or "on the owner's word" for routine kinds).
8. **Escalation of late actions:** none (the meeting is the escalation), against the switchboard's rota model. Your call.

**Gaps:**
- *Tokens.* `--x-proposed-resolution-size` (the fixed form of words) and `--x-proposed-reversed` (opacity for a reversed record's text) are new. Still owed from earlier runs: the stale hatch, the unseen hatch, warning edge and wash, lit and lit wash, pencil and pencil wash, quiet, micro type, gap ink. `--info` now means focus, "then", pointers, seams and "from records" at once, and needs splitting (the wear and time run asked too).
- *Kit parts.*
  - Status marks (the seven decision states as a `dm` part).
  - `DecisionRef` chip, `DecisionCard` and the record page.
  - The four-step question bar for actions.
  - The seam.
  - The shared `TimeScale` / `TimeRail`.
- *Decisions not prototyped.* "Mark as decided" from a Mandate discussion thread. Decisions on the Team and Org floors, and floor travel between their logs. Access: a decision whose evidence a reader can't open (the briefing's reach rules apply).

**Data the shell doesn't have yet:**
- *The decision record:* words, `because[]` with evidence refs, evidence values at decision time, `assumptions[]`, `revisitIf[]`, vote, dissent, said-not-decided, kind, and `affirms`, `amends` and `reverses` links.
- *Status as dated events,* never a stored field.
- *Meetings:* body (chair, secretary, members, quorum, cadence), attendance, agenda items with paper `Ref`s, per-line assent, confirmation and corrections.
- *Inbox:* the states above, moved dates with reason and who agreed, receipts, and helpers who are not owners.
- *Watches* on revisit lines and assumptions. They need the events service's clock (due dates passing), the gap the briefing run also hit.
- *`bound` events* from Artifacts and Mandate when something cites a decision, and a "what points at this" query.
- *Catchwords* from a controlled list per deployment.
- *Shell routing:* `@date` addresses.
- *For read back:* transcription in the model gateway, with consent and retention.
