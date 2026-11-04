# Surface 1 · The notation sheet (grammar)

**The moment:** each sheet names part of the vocabulary and shows it on the same game. D-118 (the minute run's contract decision, reversed after 175 days) is replayed as seventeen moves: twelve of ours and five of the world's. People mark moves; the records mark positions.

**Shared data:** one `DATA` object in `_src/data.js`. The game is `DATA.moves` (dated, with who moved, whether the step was one-way, the clock it ran against and the lines not played that were on the record). Marks are `DATA.annotations` by move: the mover's own mark first (`self`), the reviewer's after, and the one position mark `∞`. The computed view is worked out in `_src/lib.js` (`posAt(date)`) from the three lines the decision set itself (`DATA.lines`), as at any date; nothing is typed. Deployment words (mark names, codes, families) are data; the glyphs are not.

**Keys:** R replays, T shows the record names and rules. V3: 1 to 4 highlight each part, C copies the text. V4: ← → move the date. V6: G turns the model gateway off.

**The notation in one table** (the run's proposal):

| Kind | Marks | Who writes them |
|---|---|---|
| Move marks | `!!` won it · `!` good · `!?` a risk taken knowingly · `?!` dubious · `?` mistake (avoidable with what was known) · `??` lost it | the person who made the move, first; then the reviewer |
| Signs | `□` only move · `⊕` against a clock · `N` new to us · `∆` with the idea · one-way step (Lucide `door-closed`) | recorded with the move, or by the reviewer |
| Positions | `±` on course · `⩲` narrowly · `=` at its lines · `⩱` off course · `∓` well off course | the records only, by rule |
| Unclear | `∞` the records can't see this | a person; lowers certainty, never moves the number |

---

## V1: The key
*Idea.* The back cover of a games book: three columns (moves, signs, positions), each mark with its word, what it means for work and a real example from D-118, and a strip under it that writes the whole game in notation. The moment fills the marks into the strip one by one.

*Sources.* Chess Informant's language-free key (1966 onwards); Nimzowitsch's habit of explaining a symbol the first time he uses it.

*What works.* It is learnable in the minute the prompt asks for: six move marks, five positions, four signs, one `∞`. The examples do the teaching ("? · Everything rested on this, and nobody tested it"). The strip at the bottom shows how dense the notation is: a six-month decision in two lines. Splitting the key into "people mark" and "the records mark" columns makes the run's main argument visible before anyone reads it.

*What fails or risks.* `±` and `⩲` look alike at small sizes, and `⩲`, `⩱`, `∓`, `∞`, `□` and `⊕` are not in IBM Plex Mono: here they render from a fallback font. Glyph weight is uneven. `!!` and `??` have no example in this game, which is honest (they should be rare) but leaves them abstract. A person new to chess reads `!?` and `?!` as the same thing for a while.

*Principles.* Calm: static. Explain, never hide: every mark has its words. Many deployments: words from data, glyphs fixed. No letterbox.

*Needs.* A notation font decision (Plex Mono lacks the position signs; Jost lacks most); `--x-proposed-mark-good`, `-info`, `-soft`, `-bad`; a `Mark` part in Common.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V2: Moves and positions
*Idea.* The run's central diagram. One time scale; the records' position above it (a sign per date and the curve), the people's marks below (glyphs per move, the mover's own quieter). The moment drops the marks in and draws a bracket around move 6, where the records read `±` before and after and the reviewer wrote `?` and `∞`. Three boxes below name where the voices agree (11), disagree (6) and where two people disagree with each other (13).

*Sources.* Engine evaluation graphs in open-source analysis boards; de Groot on how experts read positions; the Informator split between move marks and position signs.

*What works.* It answers the prompt's first question by drawing it: a choice and a position are different objects, so a human mark and a computed view don't compete. "Never one number" is said and shown: nothing averages the two lanes. The bracket on move 6 is the run's best single picture: the losing move was played two months before the records noticed.

*What fails or risks.* Moves on the same day stack and have to be clustered; a decision with forty moves in a week would need zoom. The curve's vertical scale (headroom from −1 to 1) is abstract; the five signs are the readable part. The bracket is positioned in script, fragile in a real build.

*Principles.* Focal planes are implied (two lanes, one in focus at a time) but not used. Calm: one moment, then still. Explain, never hide: the rule is one key away (T).

*Needs.* The shared `TimeScale` (owed since wear and time); the computed view as a service function over a decision's lines.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 5

## V3: The score sheet
*Idea.* The whole reviewed decision as plain text, like a game score with its tag pairs: `[Decision "D-118"] [Code "C3.2 …"] [Result "Reversed by D-131"]`, then `1. Paper: in-house at £112 a van ?! ?! 2. Amend: as a six-month trial ! …`, commentary in braces, lines not played in parentheses, the world's moves in italics. The key on the right highlights each part.

*Sources.* Portable Game Notation (PGN, 1993) and its tag pairs; Informator's compact score.

*What works.* A review that exists only as a screen can't be quoted in a minute, an email or a search; this can. It is also a test of the grammar: if the review can't be written in a paragraph, it has too much in it. "The page view is drawn from this; nothing on it says more" is a useful build rule.

*What fails or risks.* Few operators will read text notation for pleasure; this is the export and the interchange, not the main view. Long move names make the paragraph heavy; the san field needs a length limit (I'd say 40 characters). Copying needs care for screen readers (the glyphs read as punctuation).

*Principles.* Many deployments: tag names and codes from data. Calm. Explain, never hide.

*Needs.* An export format for reviews (a text and a JSON form); a `san` field with a length limit on every recorded move.

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 5 · Fit 3

## V4: The evaluation, worked out
*Idea.* How the records' position is read on a date. Each line the decision set (more than 4 vans overdue; two fitters by 1 August; the saving from £186 to £112) gets a headroom bar from its record on that date; the weakest decides the sign; two lines crossed is always `∓`. A tall evaluation bar on the left, the curve with date stops below. The moment walks from 28 May to 1 August and the sign falls from `±` to `∓`. The rule card says what it can't know: a notice period, who was off sick, a clause in a contract.

*Sources.* Engine evaluation bars; confidence is worked out (briefing run): fixed yardstick, weakest part wins, a person may only lower it.

*What works.* It makes the computed view boring, which is the point: three lines, a rule, a sign. Nobody types a position. "No lines, no evaluation" closes the loophole where a decision without lines would get a comfortable `±`. A dated line (two fitters by 1 August) losing room as the date nears without a hire is the most useful single rule; it turned `⩲` on 23 June.

*What fails or risks.* The headroom formula for a dated line (room falls with elapsed time × what's missing) is a choice, not a law, and teams will argue about it. An aim (the saving) is weighed like a line, which may be wrong: a missed saving is not a crossed line. Real decisions will set lines on things AUGUR can't read.

*Principles.* Explain, never hide: the rule is on screen, with what it can't see. Calm. Confidence is worked out: kept and extended.

*Needs.* Lines bound to saved questions (Data Atlas), the events service's clock (the briefing run's gap again), the five position words as tokens of the yardstick kind.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 5

## V5: The critical moment
*Idea.* What makes a moment critical and who finds it. Four finders: the position falls two steps, a line is crossed (both the records), a one-way step (the records, if it was recorded when taken), and a person's mark. For D-118 they find moves 4, 6, 10, 11, 12, 13, 15; the records alone find 10 and 15, "where the trouble showed, not where it was made". A specimen of move 6 shows its marks and the four parts of a line of commentary: known then, chosen, instead (on the record), with the idea.

*Sources.* De Groot, *Thought and Choice in Chess*; Kasparov's annotations (long lines only at the turning points); the after-action review's "what happened and why".

*What works.* "Commentary only where it turned" becomes a rule anyone can apply. The four parts make a line of commentary checkable: a `?` needs what else was on the record, otherwise it is `?!` at most. That one rule keeps hindsight out of the marks.

*What fails or risks.* The finders are tuned to this game; a quieter decision might find nothing and then a review has no moments, which is fine but will feel thin. "Instead, on the record" punishes teams that don't write their options down; that is partly the intent, but a reviewer should be able to add a line "not on the record" (replay V4 does).

*Principles.* Explain, never hide. Calm. The workings show.

*Needs.* `opts[]` (the options on the table) recorded with a move; `door` and `dependsOn` on a step.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V6: Who marks what
*Idea.* Five voices in a table (the person who made the move, the reviewer, a second reviewer, the meeting, the records, the model) against what each may do (mark a move, mark a position, write a line, find a moment) and who sees it before it is agreed. Beside it, "mine and ours": your marks on your own moves are yours until released; marks belong to moves, not people; drafts are pencil; a learner's guesses are private; reach follows the decision. G turns the model off and only two pencil cells go.

*Sources.* Self-annotated games (Kasparov, Botvinnik); the after-action review's no-blame rule; mine versus ours (wear and time); pencil and ink (reference desk).

*What works.* It answers the prompt's second question in one place. "Own moves first" is the strongest rule in the surface: the mover's mark is written before the reviewer's is visible, so neither steers the other, and it is the mark readers trust most. "No page anywhere counts anyone's ? marks" turns the privacy rule into a product rule.

*What fails or risks.* A table of rules is a policy page, not a design; it needs the marking surface to make it real. "The meeting agrees, never re-marks" will be tested the first time a chair dislikes a mark on his move. The model's role (draft a line, suggest a moment) is small enough that it may not be worth building.

*Principles.* Explain, never hide: every voice says what it may not do. Calm. Pencil and ink.

*Needs.* A permission model for reviews (mover, reviewer, body); private drafts; release and withdraw.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 5

---

## Ranking
1. **V2 Moves and positions**: the run's argument as one picture.
2. **V4 The evaluation, worked out**: the computed view made plain and limited.
3. **V5 The critical moment**: four finders and a line with four parts.
4. **V1 The key**: the sheet people will actually keep.
5. **V6 Who marks what**: the governance, best shown inside marking.
6. **V3 The score sheet**: the export, not the view.

## What I'd build first
The key (V1) as a Common `Mark` part with the six move marks and the five positions, worded from data; the computed view (V4) as a rule over a decision's own lines, as at any date; and the split between them (V2) as the layout every review screen follows. The four parts of a line (V5) go into the marking panel as the shape of a comment, and V6's rules go into the permission model, not onto a page.
