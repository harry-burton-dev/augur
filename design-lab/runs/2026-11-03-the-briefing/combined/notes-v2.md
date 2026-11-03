# Combined V2: From question to briefing

`v2-from-question-to-briefing.html`, built by `_src/b/build.py` from `_src/b/common.css`, `data.js`, `lib.js` and `v2-from-question-to-briefing.src.html`. It shares one sample with V3 (`_src/b/data.js`): Ridgeway Regional Services, Sam Okafor (depot coordinator, North depot crew, Team floor) briefs Priya Nair (Fleet lead, Department floor) on the 18 North depot vans. Every count, day, word and reading time is worked out from the van records, the source grades and the templates in that one object.

**Keys.** 1–6 show a question's picture in the margin, B shows the bottom line's pointers, V opens the records under the picture, S strikes the phrase that points at nothing, I inks, T admin words, G model gateway off, R replays. The moment plays about 1.2 s after load. Checked at 1600×900 and 1280×800, with T, G, S/I and V, and with reduced motion. No console errors and no sideways scroll.

## V2: From question to briefing
*Idea.* Sam builds a one-minute briefing by answering Priya's questions in a fixed order: What happened? How big? Getting worse? Where? How sure? What next? Each answer is a template sentence with its picture at word size inside it, and the picture is chosen by the question, never from a chart picker (count with symbols, bars longest first, a line over time, one tile per site, no picture, the records). The margin shows the chosen picture at full size, the words that chose it, why, and the one picture that is not offered for that question, with its reason. Every part has its own seconds. When an answer runs over, its last cuttable sentence drops into **If asked**, one step down. A gap, a disagreement, no record and what readers can't see are pinned and never cut. Once the six answers are in, the model drafts the bottom line in pencil. Each phrase carries the number of the answer it points at. One phrase ("and Kestrel has never missed a visit before") points at nothing, so it is struck and blocks inking until Sam strikes it (S). G removes the draft, and the template line and a "your recommendation: you write it" gap take its place. No number on the sheet changes.

*Sources.* The lead's questions (heights V6) as the order; the staff note's struck phrase and inking with provenance (minute V1); If asked (minute V5); the minute meter (minute V3, grammar V6); the picture is in the sentence (picture V6) on the question-first engine (picture V1); the yardstick worked out by rule (grammar V2, confidence V1); the appreciation's lanes as the per-phrase pointers (grammar V5); the ladder's same-digits check (grammar V3); pencil and ink, the answer has a base, six ways to be empty (reference desk and catalogue shortlists).

*What works.*
- The questions are the layout. A manager reads the sideheads as the briefing's contents, and nobody meets the words "chart", "height" or "abstraction". The margin's chain ("Getting worse → asks a change over time → A line over time") is the whole picture rule in one line.
- The budget is enforced by a rule that can't hide anything. Here it cut 14 s and moved four sentences into If asked ("Since when?", "And the others?", "What about Harbour store?", "Do the counts cover everything?"). The gap, the no-record weeks, the disagreement and Westfield's hidden vans stayed in place, each with a pin that says why. The total reads 50 s of 60 before the bottom line is inked and 57 s after.
- Each pencil phrase carries a numbered pointer, so "points at a fact" is visible without a lanes column. The margin's pointer list (B) is the check, and the struck phrase is the one place the model's licence ends on screen.
- Counts take no word. "How sure?" carries the two judgement words (almost certain, likely), states that the briefing is no surer than its weakest, and keeps the gap. The 7-versus-5 dispute sits in What happened? with its own mark, and the rule finds it a dispute only because the inspection records are copied from the depot log and count once. T shows the weights.
- The same-digits line (headline 7 · picture 7 lit · records 7 rows) is worked out on every render, and "Numbers in the answers: 11" doesn't move with G.

*What fails or risks.*
- Legibility of the word-size pictures. Eighteen truck symbols at 15 px are just readable, the tile glyph (5 px cells) is a glyph rather than a chart, and both make uneven line heights. The full-size margin carries the real reading, so the word-size versions are reminders.
- At 1280×800 the sheet scrolls by about two lines (If asked folds below the fold). The rail and margin fit.
- Reading time from word counts is crude (numbers and pictures cost more than words), and an author may write to the meter. The rule that pinned lines can't be cut is the guard that matters.
- A fixed six-question order fits a "what's going on" briefing. A decision briefing needs "What are the options?" (minute V6), so the set must come from the kind of briefing, as data.
- One phrase can point at a fact, and still say more than that fact (for example "this week" isn't in any record here). A pointer check catches invented claims, not overstatement. Overstatement needs an entailment check or a person.
- Over a full working day the margin's never line ("Not offered for this question") will be read once and then ignored. It should fold after the first week.

*Principles.* Explain, never hide: strong. Cuts move, they are never deleted; pinned lines say why they stay; the unseen depot names whom to ask; the empty bottom line says what's waiting. Calm: the answers deposit once, the cut fades once, and nothing moves at rest. Focus stacking: the selected answer and its full picture are the lit pair; no blur. Letterbox: not used (this is for information, not urgent).

*Model gateway.* The model writes one thing, the bottom line, in pencil, from the six answers' claims. It may also suggest a question for If asked (pencil icon), never its answer: "Could another firm do the inspections sooner?" is answered by a gap naming Dana Whitlock. It never picks a picture, a word, a number, a cut or a sentence of an answer. The gateway would need to return the draft **as phrases with claim ids**, not as a string, so the page can draw the pointers and strike what has none. A phrase without an id is struck by the page, not by the model.

*Data Atlas would need.*
- **One query per finding with three heights**: the count, the picture's rows (per van: due date, days late) and the records. The page refuses to publish when they disagree.
- **A question set per kind of finding** (here: what, how big, getting worse, where, how sure, what next), each with its picture form, its never item and its default budget, as configuration.
- **Sentence templates per answer**, each sentence marked as cuttable (with the If-asked question it becomes) or pinned (with the kind of empty that pins it).
- **Month-end counts with "no record" kept apart from zero** (the 8–21 Sep outage).
- **Source grades on every observation and "derived from"**, so copies count once (inspection records ← depot log), plus `derive()` returning the word or the dispute for a claim.
- **Site places in a coarse grid** for the one-tile-per-site picture, with "some" for sites on floors the author can't open.
- **Expected details and who could fill them** (the gap: whether Kestrel can come before 5 Nov; Dana Whitlock).
- Artifacts: per-sentence provenance (template, person, model; inked by) and the If-asked block.

*Needs (tokens).* Carried: `--x-proposed-pencil`, `-pencil-wash`, `-unbacked`, `-data`, `-data-ctx`, `-lit`, `-lit-wash`, `-disagree`, `-disagree-wash`, `-gap-ink`, `-hatch`, `-stale`, `-unseen`, `-quiet`, `-type-micro`. New in the b-screens: `--x-proposed-seam` and `--x-proposed-seam-wash` (used in V3). The demo's timer offsets are choreography in JS, not UI motion; transitions use motion tokens. Relies on `--font-mono` (IBM Plex Mono), which still needs an ADR.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 3 · Fit 4.

*Beyond the ask.* (1) The cut rule pins four kinds of line, not only gaps: no record and what readers can't see are pinned too, because cutting them would make the remaining number look surer. (2) Pencil time is not counted until it is inked, so the model can't make a briefing look short. (3) The rule makes the 7-or-5 disagreement a dispute only because the copies count once. Without "derived from", the depot log and its own copy would outweigh Kestrel and the disagreement would vanish. That is a strong argument for storing derivation in Data Atlas.

*Questions for Harry.* Should the question set be fixed per kind of briefing by an admin, or may the author add a question? I recommend fixed per kind, so leads learn where to look. And is 60 s a deployment setting, or does it come from the reader (a lead's preference)?
