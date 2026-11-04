# Surface 2 · Minuting live

**The moment:** 12 May 2026, 10:38 to 10:52, the Fleet and Facilities leadership meeting, item 4, "North depot van inspections". Five members are present, Ruth Mensah sent apologies, and Ellen Shaw takes the minutes. Priya Nair moves that inspections go in-house, Ade Bello asks for "a six-month trial", Jo Barnes says two fitters by the end of June "should be fine", and Marcus Hale (chair) asks for it to come back if more than four vans are overdue. Every variant records the same item, so they differ only in how the minute is made.

**Shared data:** as in the grammar notes (`../_src/data.js`). Each page sets its own "now" to 12 May 2026, so statuses read as they did that day. `DATA.heard` is what the model gateway heard (pencil). Nothing in `DATA.decisions` comes from it.

**Keys:** R replays, T shows the record fields, G turns the model gateway off where the model has a part (V2). Each page lists its own keys.

---

## V1: The agenda is the form
*Idea.* The agenda is the spine of the screen. Each item arrives with its slots already laid out from its paper: the motion is pre-filled from the paper's recommendation ("not yet moved"), and the resolution, actions and revisit-if slots wait as honest blanks. The moment closes item 3 with D-117 and moves the rail to item 4. Its slots appear and nothing else changes. The rail shows each item's time budget as a bar on one scale; the right column shows who is in the room, quorum, and what was decided so far today.

*Sources.* Board agendas and papers (every decision item has a paper with a recommendation); ask only what changes (reference desk): the secretary fills, never retypes; one-now for the time budget.

*What works.* It is the calmest variant and the closest to how a good secretary works: preparation turns live minuting into filling in. The "revisit if" slot sits empty on screen for the whole item, so the chair is reminded to set one before the item closes, which is the cheapest way to get revisit lines into real decisions. Quorum and apologies are always visible.

*What fails or risks.* It assumes papers with recommendations. Many teams meet without papers, and then the form is five blanks. The pre-filled motion could anchor the room on the paper's wording; it is shown dashed and "not yet moved" to resist that. The time bar could feel like a stopwatch on the chair; it only fills, it never flashes.

*Principles.* Explain, never hide: blanks say what is missing ("not agreed yet", "none yet", "not set"). Calm: one change per item. One-now: the agenda's time scale. No letterbox.

*Needs.* Agenda items that carry a paper `Ref` (Artifacts) and a decision slot; a "recommendation" field on papers.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 5

## V2: Read back
*Idea.* Two columns. On the left is what was heard: the model gateway's transcript, in pencil, labelled "not the record", kept with the meeting for 30 days for checking and then deleted. On the right is what was agreed. When the secretary closes the discussion, the model drafts a summary. Each sentence points at the heard lines it came from, and the heard lines show "used". The chair reads it back to the room; when the room agrees it becomes ink, numbered D-118. With G (model off), the left column says nothing is heard and the secretary types; every part of the record stays the same.

*Sources.* Hansard (a verbatim record next to an agreed record, with the two never confused); pencil and ink (reference desk); the read-back in aviation and theatre; minutes "agreed as you go".

*What works.* It keeps the model where it helps (catching what was said) and out of where it can't be trusted (deciding what was decided). The pointers make the draft checkable in seconds. **Retention as a setting** ("heard: 30 days, minute: permanent") answers the first question any organisation will ask about transcribing meetings. Read-back is the step that makes minutes "agreed by those present" without a second meeting.

*What fails or risks.* Transcribing a meeting is a consent and privacy question before it is a design one: every person present must know, and some organisations will forbid it. Read-back costs about a minute per item; over a ten-item meeting that is ten minutes, which chairs will resist for routine items. The pencil summary is long; the agreed minute should be shorter than the draft, and the screen doesn't force that.

*Principles.* Pencil and ink: the strongest of the six. Explain, never hide: the retention note. Calm. No letterbox.

*Needs.* A model gateway transcription capability (and a consent notice) the AUGUR gateway doesn't have; a per-body retention setting for heard text; the pencil and ink tokens from the reference desk run.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 2 · Fit 4

## V3: The motion on the table
*Idea.* The motion is one object in the middle of the screen, and it moves through six named steps: moved, seconded, amended, put to the meeting, carried, numbered. The amendment is a tracked insertion ("as a six-month trial", underlined, with who moved it) until the motion is carried, when it becomes plain words. The vote fills three columns with faces as hands go up; quorum is shown next to the count. When carried, the card turns solid and takes its number, D-118.

*Sources.* Robert's Rules of Order and Citrine's ABC of Chairmanship (motion, seconder, amendment, putting the question); parliamentary order papers; tracked changes.

*What works.* It shows exactly when words become fixed: at "carried", not before. That is the rule the whole run rests on. The number arriving last is a good signal that a decision has an identity only once it is made. A named vote with an abstention and a reason is honest without being dramatic.

*What fails or risks.* Most AUGUR teams don't vote formally; they agree. For them, six steps is ceremony, so the steps should collapse to "agreed" for bodies whose settings say "by consensus". Showing who voted which way is right for a board and wrong for a team retro; it must be a body setting. The large card is empty at 1600 below the vote.

*Principles.* Explain, never hide: the vote by name, quorum, and the abstainer's reason. Calm: hands appear once. No letterbox.

*Needs.* Body settings: "decides by vote or by consensus", "records votes by name or by count". A motion object with amendments.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V4: The room agrees
*Idea.* The shared screen in the meeting room shows one line in large type: the decision in plain words, asking "is this what we decided?". Earlier items rack back as the far plane (blurred and desaturated, no scrim). Each person present answers from their own device: "that is what we decided", "yes, and note my concern", or "no, that's not what we said". The line inks only when everyone present has answered. Ade's "yes, with a note" adds his concern beside the decision with his name, without changing the words. A panel shows what Ade sees on his laptop.

*Sources.* Agreed minutes; focal planes and rack focus (cinematic run); question and answer (room tone): the line is an open question until everyone present has answered it.

*What works.* "Agreed by those present" stops being a formality and becomes a record: who assented to which words, at what time. It separates **assent to the record** ("that is what we decided") from **agreement with the decision** (the vote), which minutes usually blur; Ade abstained on the vote and still confirms the minute is accurate. The far plane is a good use of focus stacking: it is what the room has already settled.

*What fails or risks.* It needs every person to have a device open, and it puts a small social pressure on dissent. "No" must be safe to press. The chair answering aloud for someone without a device is a necessary escape hatch. Five faces fit; a twenty-person board doesn't, and needs a count with names on hover.

*Principles.* Focus stacking: strong. Explain, never hide: the waiting faces and apologies stay visible. Calm: answers arrive, nothing pulses. No letterbox (the large type does the work).

*Needs.* A per-line assent record (`{person, yes|note|no, at}`); a "room" view of a meeting that devices join; a rule for remote attendees.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 3 · Fit 5

## V5: One owner, one date
*Idea.* An action as it was said ("And Jo and Sam can sort out the bay, before the trial starts") becomes a card with two owners and a vague date. The card can't be recorded: a rule explains why one action needs one owner ("each will think the other has it, and nobody can close it") and offers three ways out: split, or name one owner with the other as a helper. The date shows as an honest blank with the model's guess ("read as 1 Jul?"). Sam isn't in the room, so his action is **asked, not told**: it shows as given (dashed) until he accepts it in his Inbox.

*Sources.* RAID and action logs (one owner, one date, one status); RACI (one accountable); question and answer; the honest blank (wear and time).

*What works.* It catches the two commonest failures of meeting actions at the moment they happen, in the meeting's own words. "Helpers named, owner answers" keeps the social truth (two people will do it) without losing accountability. Asking an absent owner instead of assigning to them is a small, important courtesy, and it makes "accepted" a real state.

*What fails or risks.* Interrupting the secretary mid-meeting with a rule could slow the room; the rule should be one line and the split one key. A model reading "before the trial starts" as a date is a guess and must stay pencil. If Sam declines, the action goes back to the chair, which is another loop the chair has to watch.

*Principles.* Explain, never hide: the rule says why. Calm. No letterbox.

*Needs.* Inbox items with **given → accepted** (ADR 0026 has no "accepted" state yet); a helpers field that doesn't make helpers owners.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V6: Standby and go
*Idea.* When the chair says "standby", the letterbox closes around the motion's words: 2.39:1, bars from `--scrim`, the minute behind blurred. The top bar carries the meeting, item, quorum and clock; the bottom bar says who calls standby and who calls go, and that Esc returns to the discussion with nothing lost. "Carried: record it" (Enter) is the go. The frame shows "Recorded · D-118 · in force from today" and then opens again.

*Sources.* Theatre cue calling (standby, then go, for anything irreversible); PDR-009 letterbox; focal planes.

*What works.* It is the clearest statement that recording a decision is irreversible and important. Two steps separate the chair's call (standby) from the secretary's act (go). The bars carry the facts that make it valid (quorum, who is present), so nothing outside the frame is hidden for good.

*What fails or risks.* **It pushes back on PDR-009.** The letterbox is for urgent and important; a routine decision is important but not urgent, and a meeting that records eight decisions would see the frame eight times. It devalues the frame for real urgency. It is right only for decisions of a kind whose settings say "high stakes" (spend over a threshold, a reversal), if at all. The large type wraps to four lines at 1280.

*Principles.* Letterbox: used, and stretched. Focus stacking: the discussion racks back. Calm: one close, one open. Explain, never hide: Esc and the bars.

*Needs.* A per-kind "frame the record" setting; an urgency budget (the cinematic run's open question) before any app may raise the letterbox.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 2

---

## Ranking
1. **V4 The room agrees**: assent to the record, by name, without a second meeting.
2. **V1 The agenda is the form**: calm, cheap, and it puts "revisit if" in front of the chair.
3. **V5 One owner, one date**: catches the commonest failures as they are said.
4. **V2 Read back**: the right place for the model, if consent and retention are settled.
5. **V3 The motion on the table**: for formal bodies only; a body setting.
6. **V6 Standby and go**: a misuse of the letterbox for most decisions.

## What I'd build first
V1's form with V5's rules inside it, and V4's assent as the way an item closes: the secretary fills prepared slots, actions can't be saved without one owner and one date, absent owners are asked, and the line inks when those present have said "that is what we decided". The model's transcript (V2) is a later, opt-in layer per body, with its retention on screen. The formal vote (V3) is a body setting. The letterbox (V6) stays out until there is an urgency budget.
