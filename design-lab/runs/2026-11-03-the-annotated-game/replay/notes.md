# Surface 2 · Replaying a decision

**The moment:** stepping through D-118 in Mandate, move by move, three weeks after it was reversed. Most pages land on move 6 (28 May 2026, Dana gives Kestrel notice before any fitter is hired), the move where the game turned.

**Shared data:** as in the grammar notes, plus `DATA.actions` (A-301 to A-303 with every due-date change) and `DATA.record` (what had been circulated or recorded by each date). Every panel is read "as at" the move's date, so the board never shows what came later unless asked.

**Keys:** ← → or ↑ ↓ step (V1, V2, V4), Home and End (V1), H shows hindsight (V2), Space plays and stops (V6), R replays.

---

## V1: The analysis board
*Idea.* An analysis board for a decision. Left, a tall evaluation bar; middle, the board: the decision's lines with headroom as at the date, its actions with their state that day, the last four things on the record, and the current move with its marks; right, the score sheet with each move's marks and the records' sign; below, the curve with the selected move. The `∞` on move 6 hatches the bar.

*Sources.* Open-source analysis boards (board, move list, evaluation bar, graph); Kasparov's *My Great Predecessors* (the reader replays on a board beside the text).

*What works.* It is the familiar shape and it works: you can step a six-month decision in seventeen presses and the board tells you exactly what stood each day ("Hire two fitters · Open", "Give Kestrel notice · Done 28 May"). The record list is the quiet hero: "On the record by this date" is what a reviewer needs to judge fairly.

*What fails or risks.* Dense; three panes and a curve. The board's contents are specific to this kind of decision (lines, actions, record); a decision with no lines gets an empty left half. The evaluation bar and the board's position word say the same thing twice.

*Principles.* Time as an address: every panel is "as at". Calm: nothing moves unless you step. Explain, never hide.

*Needs.* Point-in-time reads of actions and lines (`as at` on Mandate records); a "what was on the record by date" query across Artifacts and Mandate.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 3 · Fit 4

## V2: As it stood
*Idea.* A blind replay. Moves still to come are out of focus (blurred and desaturated, the cinematic run's far plane) behind a "not known on 28 May" fold. The right pane splits "known that day" (record, line values) from "not known yet" (the questions still open, as hatched blanks: "Will two fitters be in post by 1 August?"). Hindsight is a button, "Show what came of it", and arrives on its own blue wash labelled "Known later".

*Sources.* Baron and Hershey, "Outcome bias in decision evaluation" (1988); Annie Duke, *Thinking in Bets* ("resulting"); rack focus and focal planes (cinematic run).

*What works.* It is the run's best defence of human marks: if the reviewer can't see the result until after marking, a `?` means "avoidable with what was known". The open questions are worded from the lines, never from what happened, so they don't leak the ending. Using rack focus for "not known yet" is a natural fit for the light language: the future is the far plane.

*What fails or risks.* The people reviewing D-118 already know how it ended; blurring the screen doesn't blur their memory. It helps the second reader more than the first. Blur on a long list is expensive and can look broken; a quiet hatch might do. Someone will always press H first.

*Principles.* Focal planes: used as intended. Explain, never hide: the future is hidden on purpose, says so and is one key away. Calm.

*Needs.* `--x-proposed-future-blur`, `--x-proposed-hindsight`; open questions derived from lines and assumptions.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit 5

## V3: The clocks
*Idea.* Every deadline the decision ran against on one rail: Kestrel's notice window (to 1 June, one-way, in warning), the hiring action (30 June, moved twice, old bars dashed), line L2 (1 August), Kestrel's cover ending (1 September), the trial to its review. The moment slides a now line to 28 May and a note appears: the one-way clock had 4 days left and the hiring clock 33, "nobody chose that order; the dates did". Beside it, answer times: each world move and the days until a move that changed something (38 days after the line crossed on 1 August).

*Sources.* Chess clocks and time trouble (Informator's `⊕`); critical path; the minute run's moved dates.

*What works.* It finds something the marks don't: the order of the clocks forced the bad move. That turns a blame-shaped `?` into a structural lesson ("when a one-way clock ends before the clock it depends on, move one of them at the table"), which is what an after-action review is for. "Answered means a move that changed something" makes the 38 days visible without accusing anyone.

*What fails or risks.* Five clocks is the limit before the rail becomes a Gantt chart. Answer times can become a performance metric for chairs, which the review rules forbid; this view must stay inside the review, never on a dashboard. The rail's rows are hand-placed.

*Principles.* One now (one rail, one now line). Calm. Explain, never hide.

*Needs.* Deadlines from contracts (notice periods) as data on the decision; moved dates kept as history (the minute run has them).

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V4: Variations
*Idea.* The main line on the left, with "2 lines" badges on the three moves that had alternatives. Selecting one opens the tree: the move played, and the lines not played that were on the record at the time (clause 9's six-month break; Kestrel's ad hoc price of £210 in the D-128 pack; the revisit item's three choices). What follows each line is a reviewer's estimate, in italic, and says so. One line was played elsewhere: R-03, grounds maintenance in Parks and Open Spaces, "waited until four gardeners were in post, then gave the contractor notice" and was kept.

*Sources.* Informator variations in parentheses; opening theory (a line played in another game).

*What works.* "Only lines on the record count" keeps hindsight out: a reviewer can't invent a clever alternative and mark the move down for missing it. A line thought of afterwards is allowed but marked "not on the record" and doesn't count against the player. The link to R-03 is where review becomes learning: the better line wasn't theory, another floor played it.

*What fails or risks.* Most decisions don't record their options; this view will often be empty, and that emptiness is itself a finding the review should state. Estimates for lines not played are guesses, however labelled; a reader may take them as fact.

*Principles.* Explain, never hide. Pencil and ink, by analogy: estimates are labelled. Calm.

*Needs.* `opts[]` on a decision's moves (options on the table, with where each was recorded); links between reviews (the book).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V5: Move and reply
*Idea.* The decision in turns, like a score in pairs: our moves on the left, the world's reply on the right, the records' position after each turn. Five turns. The moment lights the three critical turns and adds a line under each: what our move left the world free to do ("The notice left the world a free move: if hiring failed, nothing could take Kestrel's place. It failed.").

*Sources.* Game notation in move pairs; the after-action review's "what happened"; the minute run's distinction between decided and what happened to it.

*What works.* It says plainly that a decision is a game with two sides and only one of them is ours, which is why world moves are never marked. Asking "what did our move leave the world free to do?" is a better review question than "who got it wrong?". It is also the most readable layout in the surface: five rows.

*What fails or risks.* The turn grouping (our moves until the world next moves) is mechanical and sometimes odd: turn 1 holds six of our moves. "The world" includes people we work with (Kestrel, applicants), which can read as us against them.

*Principles.* Calm. Explain, never hide. The world's moves stay visible but unmarked.

*Needs.* A `side` on every recorded event (ours or not); nothing else new.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 4

## V6: Play through
*Idea.* How masters study a collection: play the whole game at a steady pace. A large card shows the current move; quiet moves pass by and settle in a fading list on the left; the play stops at the four critical moments, shows the marks and waits for Space. A progress rail shows the stops.

*Sources.* Annotated game collections; Nimzowitsch's *My System* (explanation only where it counts); reading pace from the briefing run.

*What works.* It is the most humane way to meet a review for the first time: the story at reading pace, with the commentary arriving exactly when it matters. It needs no instruction. It is also the natural entry point from the book (learning V4 uses its shape).

*What fails or risks.* Autoplay is motion, and the brief says nothing should move at rest: it must only start on a key press, never on load (the prototype plays once as its moment). Readers who want to scan will find it slow.

*Principles.* Calm: plays only when asked, stops by itself. Explain, never hide.

*Needs.* Nothing new beyond the review data.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

---

## Ranking
1. **V2 As it stood**: the replay mode that makes human marks fair.
2. **V1 The analysis board**: the working layout, with V2's blur as its default.
3. **V3 The clocks**: the structural lesson the marks miss.
4. **V5 Move and reply**: the plainest summary.
5. **V4 Variations**: valuable where options were recorded.
6. **V6 Play through**: the reader's mode, not the reviewer's.

## What I'd build first
The analysis board (V1) with V2's "as it stood" as its default: moves to come out of focus, hindsight on its own wash behind a key. V3's clocks belong on the board as a strip when a decision has more than one deadline. V6 is the reading mode the book opens into.
