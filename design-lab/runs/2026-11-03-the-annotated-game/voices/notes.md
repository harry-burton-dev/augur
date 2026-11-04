# Surface 4 · Two voices

**The moment:** the computed view (what the records say, as at each date) and the people's marks side by side on D-118, where they disagree. The run's position: they are not two answers to one question. The records judge where the decision **stood**; people judge the **choice**. They disagree in four kinds of way, and each kind teaches something different.

**Shared data:** as in the grammar notes. `DATA.hindsight` holds what the records now say about each critical move, shown only on request. The computed view is `posAt(date)` from the decision's own lines; nothing in this surface is typed by a person except marks and lines.

**Keys:** ↑ ↓ move (V1), H the hindsight column (V4), G the ghost line (V5), Space the next step (V6), T the rule, R replays.

---

## V1: The bar and the marks
*Idea.* One row per move: the records' bar and sign beside the people's marks. A row splits (warning wash and a split icon) when they pull apart, by rule: a `?` while the records still read on course a month later (move 4), an `∞` (move 6), a `!` while the records fall (move 9), or two reviewers who disagree (move 13). The panel explains each split in a sentence.

*Sources.* The evaluation column in analysis boards; Informator's move marks; confidence is worked out.

*What works.* The split rule makes disagreement a finding, not a conflict: "a split is a question for the reader, not an error". Move 9 is a good lesson the marks alone wouldn't teach: "a good move can't rescue a position already lost elsewhere". Nothing is averaged.

*What fails or risks.* The split rule is tuned by hand (a month later, two steps); different decisions move at different speeds. Four colours of meaning in one table (marks, signs, bars, splits) is a lot for a first look.

*Principles.* Explain, never hide: the rule is behind T. Calm. Confidence is worked out: kept for positions.

*Needs.* The split rule as part of the computed view; `--x-proposed-warn-wash` (carried).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V2: Parallel text
*Idea.* The game told twice, line for line, like a bilingual edition. Left, the records' account, built by template from the numbers ("Overdue 2 → 5. Line crossed: more than 4 North depot vans are overdue. Position ⩱ → ∓."); right, the reviewer's words and the movers' own. The gutter marks the four rows where one voice speaks and the other is silent or contrary. Quiet rows fade.

*Sources.* Loeb-style parallel texts; dual-annotated games; pencil and ink (template sentences, never model-written).

*What works.* Reading the records' account first is sobering: it is accurate and says nothing about why. The reviewer's column is all why. Side by side, the reader sees what each voice is for. The template rule keeps the left column honest.

*What fails or risks.* Long; seventeen rows of two columns is a document, not a screen. Template sentences get repetitive ("No change on its lines."). Best as a print or export view.

*Principles.* Pencil and ink: the records' sentences are template. Calm. Explain, never hide.

*Needs.* Sentence templates per line kind; nothing else.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 3

## V3: Four reasons they differ
*Idea.* Every disagreement filed under one of four reasons, each with what it teaches: the records can't see it (moves 4 and 6: record assumptions and one-way steps when made); hindsight (13: mark as it stood); the line was set wrong (8: when an action's date moves, ask whether its line should); two people judge differently (13 again: keep both, never average, never vote).

*Sources.* Five reasons an answer moves (reference desk run), as a pattern for naming why two readings differ; engine-versus-human commentary.

*What works.* It turns "the engine and the human disagree" into four actionable statements, three of which are about what AUGUR records or how lines are set. It is the clearest answer to "what would AUGUR need to record during work". Move 13 appearing twice is honest.

*What fails or risks.* Four columns of cases is sparse with one game; with fifty it would need counts. The classification is a reviewer's call, so it is a fifth thing to argue about.

*Principles.* Explain, never hide. Calm. The workings show.

*Needs.* A `reason` on a split (one of four), set by the reviewer.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V4: Then, now, and the mark
*Idea.* Three readings of each critical move: the records as at the move's date; the records now (hindsight, on a blue wash, out of focus until H); and the mark. Move 13 is the case: then `∓` with a fitter due next day, so `!?` names a risk taken knowingly; now overdue 2 → 7, which would make it `?`; Ade's `?` rests on a number known then, so it isn't resulting either. Both marks stand.

*Sources.* Baron and Hershey, "Outcome bias in decision evaluation" (1988); Annie Duke, *Thinking in Bets* (2018), "resulting".

*What works.* It shows outcome bias and guards against it at once. The "now" column is there so you can see it and not use it. The run's argument for human marks depends on this: a mark is fair when it agrees with "then", and the computed "then" is the check on it.

*What fails or risks.* Four rows is the right number; more and the hindsight column dominates. People will read "now" first no matter what.

*Principles.* Focal planes: hindsight out of focus by default. Explain, never hide: one key away. Calm.

*Needs.* `--x-proposed-hindsight`; point-in-time reads (again).

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V5: The blind stretch
*Idea.* The curve, with the reviewer's `∞` hatching 28 May to 1 August: the stretch where the records read `±` then `⩲` but the way back had already closed. A ghost line (dashed, labelled "not real: what it could have read") shows the records' view had the one-way step and its dependency been recorded: `=` from 28 May. The side panel lists what to record: one-way steps with their way back and its cost; assumptions with a date to test them; what each step depends on.

*Sources.* The engine horizon (an engine can't see past its search depth); chess's "unclear" (`∞`); watches say what they can't see (briefing run).

*What works.* It turns a disagreement into a data requirement, without letting a person's mark move a computed number. The ghost is the strongest argument for recording one-way steps: the records could have seen it on the day. "None of these is a model guess. Each is a field someone fills when they act."

*What fails or risks.* A ghost line is a counterfactual and could be mistaken for data; the label must be hard to miss. Recording dependencies is work people skip; it has to be a click on the action, not a form.

*Principles.* Confidence is worked out: a person may only lower it, kept. Explain, never hide. Calm.

*Needs.* `door`, `wayBack` and `dependsOn` on Mandate steps and actions; contract notice periods from Artifacts or Data Atlas.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 5

## V6: Where they differ, ask
*Idea.* A disagreement becomes one question to the one person who can answer it. Move 8: the records read `⩲` (the line still had room) and the reviewer `?!` (the action's date moved and the line didn't). The question goes to Marcus, who set both: "When an action's date moves, should the line that depends on it move too?" His answer becomes a line of theory in the book under C3.2. Three more questions from the same review queue below.

*Sources.* Opening theory (lines tested in games become theory); question and answer (an open question until answered); the switchboard's "no chasing".

*What works.* It closes the loop the prompt asks for: annotations become teaching material, and the bridge is a question answered by the person who knows. "A disagreement with no answer stays a question; it never becomes a rule by itself" is the right guard.

*What fails or risks.* Questions to the chair about his own moves can feel like an audit; the wording must be about the practice ("should the line move?"), never the person ("why didn't you?"). Theory accumulates; it will need an editor.

*Principles.* Question and answer. Calm: no chasing. Explain, never hide.

*Needs.* Questions from a review routed to a person (the switchboard's needs class); theory entries on a book code.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

---

## Ranking
1. **V5 The blind stretch**: a disagreement becomes a field to record.
2. **V4 Then, now, and the mark**: the guard against resulting.
3. **V3 Four reasons they differ**: the classification that makes splits useful.
4. **V6 Where they differ, ask**: the bridge to theory.
5. **V1 The bar and the marks**: the working view.
6. **V2 Parallel text**: the export.

## What I'd build first
V1's row split on the review board, with V3's four reasons as the one field a reviewer sets on a split, and V4's hindsight column behind a key. V5's three fields (one-way step, way back, depends on) go onto Mandate actions now, because the review can only be as good as what was recorded at the time. V6's questions route through the Inbox.
