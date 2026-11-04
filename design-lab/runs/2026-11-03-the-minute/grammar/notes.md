# Surface 1 · The minute sheet (grammar)

**The moment:** one item of one meeting. On 12 May 2026 the Fleet and Facilities leadership meeting (Department floor) decided **D-118**: van inspections at the North depot move in-house from 1 July, as a six-month trial, and Kestrel's contract drops to breakdown cover. It set three actions. On 3 November 2026 **D-131** reversed it. Every sheet names the parts of that record and shows them on the real decision, so the grammar is tested on the story the rest of the run follows.

**Shared data, one object (`DATA`) for the whole run:** one organisation, one body (its chair, secretary, members, quorum and cadence are settings), 11 meetings, 22 decisions over a year, 10 actions with their full histories, three monthly series the decision's revisit lines watch, and the "wake" (everything in AUGUR that points at D-118). Every status on every page is computed from dates by `statusAt(decision, date)` and `actionAt(action, date)`, so any page can be read "as at" another date.

**Keys:** R replays, T shows the record fields (two registers), G turns the model gateway off where the model has a part. Each page lists its own keys in the top bar.

**Files:** `v1-specimen.html` … `v6-sentence.html` are built by `../_src/build.py` from `../_src/common.css`, `../_src/data.js`, `../_src/lib.js` and `../_src/grammar/v*.src.html`. The built pages link the kit as the brief says.

---

## V1: Specimen minute
*Idea.* One agreed minute (item 4 of FFL 26/05) laid out the way a company secretary writes it, with its eleven parts numbered and named in a key beside it: heading, present, motion, resolution, because, vote and dissent, said in discussion, actions, revisit if, status, confirmed. The moment lights the resolution, then reads the same sheet on today's date: the status part turns to "Reversed on 3 Nov 2026 by D-131 · the words above are unchanged". Nothing else on the sheet moves.

*Sources.* Company secretary practice (the numbered minute, "IT WAS RESOLVED that"); ICSA guidance on minutes (record decisions and the reasons, not the conversation); annotated specimens from the briefing run's grammar V1.

*What works.* It is the sheet a new member of the meeting understands without help, because it looks like minutes they already get. Reading the same sheet at two dates makes the central rule visible in one step: **status lives beside the words, not in them.** Putting "said in discussion · not decided" on the sheet, in italics, is the cheapest form of ratio and obiter. The numbered key is a good onboarding device for the record type.

*What fails or risks.* It is a document, not a working surface: the actions and revisit lines are text, so nothing here can be done. It is long; at 1280 the status and confirmation scroll below the fold, which hides the one thing that changed. Minutes written this fully take a trained secretary; most teams write two lines.

*Principles.* Explain, never hide: strong (apologies, abstention and dissent are on the record, never left out). Calm: one light, once. Focus stacking: none. No letterbox.

*Needs.* `--x-proposed-resolution-size` (a size for the fixed form of words); `--x-proposed-reversed` (opacity for a reversed record's text). Data: `meeting.present`, `apologies`, `quorum` on a body; `motion`, `amendment`, `vote`, `dissent`, `obiter` on a decision.

*Scores.* Clarity 5 · Distinctiveness 2 · Feasibility 5 · Fit 4

## V2: Two lifecycles
*Idea.* The states of a decision (motion, in force, worth revisiting, reversed; with lost, complete, lapsed, kept and amended as branches) and of an action (given, accepted, part done, done, closed; with handed on, date moved, overdue, sent back and overtaken), each state labelled with **who may move a thing into it**: the room, a watch, the calendar, the owner, the chair, a later decision. D-118's real path lights state by state, with a one-now strip under it (moved 10:41, agreed, a line crossed on 1 Aug, kept by D-128 on 8 Sep, crossed again on 6 Oct, reversed 3 Nov). Keys 1 to 3 light each action's path.

*Sources.* ADR status sets (Proposed, Accepted, Superseded, Deprecated, AUGUR's own ADR 0001); RAID and action logs; question and answer (room tone): an action is an open question until the person who asked closes it.

*What works.* "Who may move it" is the real spec, and it fits on one screen. It settles three arguments in advance: nobody edits a decision into another state; "done" is the owner's word and "closed" is the chair's (so an owner can't close their own action); "overdue" is derived from the date, never set by a person. The lit path shows that "worth revisiting" can happen twice, with a "kept" between, which a single status field can't record.

*What fails or risks.* It is a reference diagram, not something an operator meets. Eleven decision and action states is a lot; operators need four words at most in a row (see V4). "Kept" is drawn as a state, but in the data it is a new decision that affirms the old one. A real build should say so (it does, in the side text).

*Principles.* Explain, never hide: each state says who moves it, which also says who to ask. Calm: the path lights once. No letterbox.

*Needs.* An action state machine in the Inbox (ADR 0026 has open, done, declined, handed on; this needs **accepted**, **done by owner** and **closed by setter** as distinct states, and **overtaken**). A history list per action that is never overwritten.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V3: Decided versus said
*Idea.* Every sentence of item 4, in the order it was said, sorted into six lanes: put to the meeting, **decided**, because, will do, **assumed**, said but not decided. The moment slides each sentence from where it was said into its lane. Read on today's date, the one sentence in the assumed lane ("two fitters in post by 30 June", said by Jo in passing) lights: "1 in post since 9 Sep. This is what the reversal turned on."

*Sources.* Court judgments: ratio decidendi (what was decided and the reasons it needed) versus obiter dicta (what was said along the way); Hansard (the verbatim record beside the agreed record); ADR "context" and "consequences".

*What works.* The **assumed lane** is the find of the grammar. Decisions fail on what everyone took for granted, and minutes never write that down. Making the assumption a first-class part of the record, watched like a revisit line, is how a reversal can be explained six months later. Only the decided lane is searchable as a decision, so a remark ("the bay could take the south depot's vans") never turns up as policy. The lanes also tell AUGUR who to notify: will-do owners get Inbox items, nobody gets the "said" lane.

*What fails or risks.* Sorting live is real work for the secretary. A model could propose the lane (pencil), but that is exactly the judgement people argue about. Six lanes are wide: at 1280 the lane descriptions hide. Some sentences belong in two lanes (Dana's "three months' notice" is said and led to an action). It is drawn as two chips, which is honest but doubles the count.

*Principles.* Explain, never hide: strong. The dissent is kept in "said", with "noted at his request". Calm. No letterbox.

*Needs.* `assumptions[]` on a decision, each optionally bound to a series or an action (here: fitters in post, bound to A-302). A lane field on minute lines.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V4: The marks
*Idea.* A specimen of every mark at three sizes: a decision's seven states at word, row and page size; an action's six states and one alarm; and five more (pointer, seam, revisit line on a sparkline, said-not-decided, not known yet). At the top, a sentence in the North depot procedures cites D-118 at word size. The moment reads that citation on each date in D-118's life: in force, worth revisiting, in force, worth revisiting, then **reversed → D-131**, hatched. The procedure's sentence itself never changes.

*Sources.* Legal citators (Shepard's and KeyCite signals: a case cited anywhere shows whether it is still good law); ADR status; the wear and time seam and hatch; the six ways to be empty (catalogue run).

*What works.* **The live citation** is the strongest single idea for other apps: any document, intent or fact that cites a decision shows its status at word size, read from the record, so a procedure that rests on a reversed decision says so without anyone editing it. The marks are drawn from what is already in the language (hatch for past, warning edge for a question, corner ticks for not known), so nothing new competes with "needs you" light. Reversed is quieter but never struck through, and never gone.

*What fails or risks.* Seven decision marks are too many to tell apart at word size. In practice only four matter to a reader (in force, worth revisiting, reversed or amended with a pointer, and ended). "Complete" and "lapsed" could share the ended mark with a word. The hatched citation inside body text is busy, so it needs testing at 14 px.

*Principles.* Explain, never hide: the citation says what replaced the decision. Calm: no motion at rest; warning is an edge, not a fill. No letterbox.

*Needs.* A Quill `DecisionRef` inline part (id, status mark, pointer to successor). An Artifacts rule that a citation reads the current status at render, plus "as at" for printed copies. `--x-proposed-reversed`.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 5

## V5: One decision, five forms
*Idea.* D-118 written five ways: a board minute, Hansard (verbatim and an agreed summary), a law report (catchwords, held, obiter, later treatment), a decision record (status, context, consequences) and an action log row. A sixth column is the AUGUR record, and each of its fields names the form it came from. The moment lights each field and the part of the form it came from. Two fields are new: **rests on, then and now** and **revisit if**.

*Sources.* Board minutes; Hansard; law reports and headnotes; ADRs (Nygard; AUGUR's own `docs/decisions`); RAID logs.

*What works.* It answers "why not just use ADRs?" honestly. ADRs have status and consequences but no owner or date. Minutes have fixed words but no status. Action logs have owners but no reasons. Law reports have later treatment, which nobody else has. It is the best page for Harry, because it argues the record type's fields from practice, not taste.

*What fails or risks.* It is a comparison sheet. Nobody works in it. Six columns at 1280 is cramped and the forms' "take" lines hide. The Hansard column shows the model-heard verbatim as plain text, so it is not marked as pencil here. In AUGUR it would be.

*Principles.* Explain, never hide: n/a. Calm. No letterbox.

*Needs.* Nothing beyond the record type it argues for.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 3

## V6: The decision in a sentence
*Idea.* The whole decision as one sentence with slots: "On ⟨date⟩ the ⟨body⟩ decided ⟨words⟩ because ⟨3 reasons⟩. It rests on ⟨6 records in 3 apps⟩. ⟨Owner⟩ will ⟨do⟩ by ⟨date⟩; … It stays in force unless ⟨line⟩, ⟨line⟩, or ⟨date⟩." Every slot's underline says where its words came from: from records (blue), agreed in the room (green), typed by the secretary (ink), heard by the model (dotted pencil). One action has **no date** because its owner wasn't there, so its slot stays an honest blank and **Record** is blocked with the reason. F fills it. G turns the model off and the pencil date becomes the secretary's to type, with no change to the record.

*Sources.* Said in a sentence (catalogue run); pencil and ink (reference desk); RAID's rule of one owner and one date; BLUF.

*What works.* It reads aloud, so the chair can read it back to the room, which is how minutes get agreed as you go (see live V2 and V4). The provenance underline is quiet and complete. It is the strongest statement of the rules: a decision needs words, a reason, an owner and date per action, and at least one "unless". **A decision with no revisit line stays in force until someone remembers it.** The blocked Record button shows "explain, never hide" applied to a missing fact.

*What fails or risks.* Long. D-118 runs to nine lines at 1600 and more at 1280; a decision with six actions would be a paragraph. Four underline styles must be learned. The blue "from records" underline uses `--info`, which already means focus and "then" (a gap the wear and time run flagged).

*Principles.* Explain, never hide: strong. Pencil and ink: strong. Calm: slots fill once. No letterbox.

*Needs.* Validation rules on the record type (required slots). An "unless" field that is required, or at least nagged for.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

---

## Ranking
1. **V4 The marks**: the live citation is the cheapest, most reusable piece of the run.
2. **V3 Decided versus said**: the assumed lane explains reversals before they happen.
3. **V6 In a sentence**: the read-back form and the rules of a complete decision.
4. **V2 Two lifecycles**: the spec for who may move what.
5. **V1 Specimen minute**: the plain, familiar form; it is the print view.
6. **V5 Five forms**: the argument for the record type, for Harry rather than for operators.

## What I'd build first
The marks and the lifecycle together: a `DecisionRef` that any app can render at word size, reading its status from Mandate. Then a decision record type whose words can't be edited, whose status comes only from dates, watches and later decisions, and whose actions are Inbox items that only their setter can close. The assumed lane comes next, as an "assumptions" list on the record that a watch can bind to. It costs little and is what makes a reversal explainable.
