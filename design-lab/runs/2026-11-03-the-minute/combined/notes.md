# Round 2 · Combined screens

Four screens that combine the round 1 winners into something that could ship. All four are built by `../_src/build.py` from the same `DATA` object as round 1, so D-118, its three actions and its reversal are the same records everywhere.

---

## V1: From the table to the reversal (`v1-table-to-reversal.html`)
**The flow the prompt asked for:** one decision followed from a meeting, through three actions, to its reversal six months later.

*Idea.* Three columns that stay put while the date moves. On the left is **the record** of D-118: the same words throughout, with only its status and the counts beside it changing (records moved, lines crossed, actions open). In the middle is **the scene** for that date. On the right are **its actions**, each with a four-step bar (asked, accepted, answered, closed), moved dates as seams, lateness in warning, and a lit edge on whatever changed since the last scene. Along the foot, one time rail from May to November carries the decision's status bands (white in force, amber worth revisiting) and six scene marks:
1. **12 May, at the table.** Agreed in the room: the resolution, everyone present answering (Ade abstained, with a note), the revisit lines, and the assumption that two fitters will be in post by 30 June.
2. **23 Jun, a date moves.** A-301 was closed at matters arising; A-302's date moves with a reason, and the old date stays as a seam. The decision is unchanged.
3. **1 Aug, a line is crossed.** No fitter is in post. The decision is marked; in September the meeting keeps it with one fitter (D-128) and says why.
4. **6 Oct, another line.** Five vans are overdue. The watch marks the decision again and asks the chair once; the review is brought forward.
5. **3 Nov, before the vote.** The wake: everything that rests on D-118, and what reversing it would do to each.
6. **3 Nov, reversed.** D-131. D-118 keeps its record and points forward; seams on the procedures and the intent's forecast; four people told, one Inbox item each.

The moment jumps from the table to six months later in one step. ← → move between scenes, P plays them all at reading pace, and the rail marks are buttons.

*Sources.* Live V1, V4 and V5; actions V3 and V4; revisit V1, V2, V3 and V6; record V5 (the same facts at every size); one-now; the score's full score and parts.

*What works.*
- **The record column never loses a word.** Over six months the only things that change on it are a status word, three counts and, at the end, a pointer to its successor. That is the prompt's "reversal is visible", made literal.
- **The actions column shows question and answer over time.** A-301 runs asked → closed by June. A-303 is answered in July and closed only in September, at matters arising. A-302 accepts, moves twice, goes late, and is withdrawn ("overtaken"), and its bar turns hatched rather than red. The three new actions from D-131 arrive with lit edges.
- **The rail is one-now.** The amber stretches show at a glance that the decision spent two of its six months "worth revisiting", and that the first time it was kept on purpose.
- **Every scene is a date.** The whole screen is computed from the records "as at" that date, so the scenes are addresses (time as an address), not slides.

*What fails or risks.* It is a story view, best for explaining a decision to someone who wasn't there (an auditor, a new member, a successor) and not a daily screen. The scene texts are written for this story; a real build would generate them from the event types (made, date moved, line crossed, kept, wake, reversed), which is possible because each scene maps to one kind of event. Scenes 5 and 6 share a date, so the rail has to nudge them apart. At 1280 the three columns are tight and the scene text scrolls.

*Principles.* One-now: strong. Explain, never hide: nothing is deleted, every moved date and withdrawn action stays. Calm: the screen moves only when you move the date. Focus: the scene is the near plane; record and actions are steady at the sides. No letterbox.

*Needs.* Everything the record type needs, plus dated events for decisions and actions (made, moved, crossed, kept, reversed), which the events service would store as domain events.

*Scores.* Clarity 5 · Distinctiveness 5 · Feasibility 3 · Fit 5

## V2: The decision record (`v2-the-record.html`)
*Idea.* The record page as it could ship in Mandate. The header has id, status, kind and its standard of proof, title, the fixed words, who decided at which meeting (vote, the noted dissent, minute confirmed, how many remarks were said but not decided), and a banner when it is worth revisiting or reversed. Three columns follow. **What it rests on, then and now** has a sparkline and the revisit line on each series, crossed lines in warning, and "moved · no line was set" where something changed that nobody asked to be told about. **What follows** has the actions with the four-step bar and "only Marcus, who asked, can close an action". **Who has relied on it** lists every later record that treated it (followed, questioned, cites, reversed) with seams on the documents that cite a reversed decision, and the live citation chip at the foot. An "as at" control reads the whole page on 12 May, 20 Oct or today.

*Sources.* Record V1, V2 and V3; grammar V4 (the live citation); actions V3; revisit V3.

*What works.* It answers the four questions a reader brings, in order: what was decided (header), can I still trust why (then and now), what's being done about it (actions), and who else is relying on it (treatment). Reading it on 20 Oct and then today is the clearest demonstration that **status, not words, is what moves**. "Who has relied on it" is the wake in its everyday form.

*What fails or risks.* Dense at 1280: the "why" lines under evidence hide except where a line was crossed. Three columns of equal weight don't say which matters most; on a decision worth revisiting it's the first, on a reversed one the third. The page could re-order its columns by status, but that's a special case the shell rules discourage. The argument view (record V4) didn't make it in, and the warrant field is still a decision for Harry.

*Principles.* Explain, never hide: strong. Calm. No letterbox.

*Needs.* The record type in Mandate; snapshots or "as at" reads of cited values; `Ref`s from documents (Artifacts bound events) and decisions to decisions.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 5

## V3: Minuting live (`v3-minuting-live.html`)
*Idea.* The secretary's screen during item 4. The agenda rail is on the left (time used against the item's budget). In the middle are the item's slots, laid out from its paper: the motion with mover, seconder and amendment; the **resolution, drafted in pencil from what was heard** and read back by the chair; actions, each with one owner and one date, the absent owner's marked "asked, not here"; and revisit if, with the assumption "watched too". On the right is the room: "Is this what we decided?" with each person present answering, Ade's "yes, with a note" adding his concern, and the heard line the date came from (kept 30 days). When everyone present has answered, the pencil inks, the number D-118 appears, three Inbox items go and two watches start. G turns the model off; nothing in the record changes.

*Sources.* Live V1, V2, V4 and V5; grammar V6 (where each part came from).

*What works.* It keeps the three rules that matter at the table: the model only hears (pencil), the room agrees (ink), and an action needs one owner and one date. "Yes confirms the minute, not the vote" is a small line that heads off the commonest confusion about agreeing minutes. The secretary's work is filling, not writing.

*What fails or risks.* Transcription needs consent, and some organisations will refuse it; the screen must work without it (G shows that it does). Five faces fit, twenty need a count. The revisit-if slot is filled here; in practice it will often be empty, and the screen should ask for it before the item closes (live V1 does) without nagging.

*Principles.* Pencil and ink: strong. Question and answer: the line is open until everyone present answers. Calm. No letterbox (live V6's standby-and-go is left out on purpose).

*Needs.* A meeting "room" that devices join; per-line assent; Inbox items with `accepted`; watches from revisit lines; per-body retention for heard text.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 3 · Fit 5

## V4: The floor's decision log (`v4-the-log.html`)
*Idea.* One log, three ways in. **Ask it** (a subject in plain words), **open it at a date** ("as at" 1 Aug or today), or **read it by meeting**. The answer sentence is built from the records ("5 decisions mention inspections. In force today: D-131."). The list below is grouped by meeting, with each minute's confirmed or draft state, and dims what wasn't in force on the date. An overview shape above shows how many of the body's decisions (matching the question) stood on each day, with reversals marked. A side panel shows the workings and, at a past date, what has changed since.

*Sources.* Log V1, V2, V3 and V4; the reference desk (the answer has a base, the workings show).

*What works.* It is the register people need, the audit view, and the question box in one screen without modes. The overview shape is a better overview rung than lifelines for a busy body: it stays one line high however many decisions there are. Asking a subject narrows the shape too, so "inspections" shows its own short history.

*What fails or risks.* The shape is abstract (a count over time) and needs its label. With one or two matching decisions it is nearly flat. The question parser only understands a subject; time words ("on 1 August") are in log V4 and should come back. Free text inside the shell's command palette may be where most people ask, rather than here.

*Principles.* Explain, never hide: the workings and the dimmed past. Time as an address. Calm. No letterbox.

*Needs.* Catchwords on decisions; status computed by date; `@date` routes.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 5

---

## What I'd build first
V2's record page and V3's minuting screen are the product. V1 is how the run proves they hold together over six months, and it is worth keeping as a "history" mode of the record (record V6's job, done better). V4 is the log those records live in. The order is: the record type with fixed words, computed status and the four action states; minuting that fills it, with the room's assent; the log; then the wake and the history view.
