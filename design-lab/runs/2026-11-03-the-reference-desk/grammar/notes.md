# Grammar: the question sheet

Six reference sheets for the run's vocabulary: **question, clarification, workings, answer, gap, saved question**. For each one the sheets say how it is set and drawn, what it must never claim, and how a model's guess is marked against a fact in the record. Every sheet follows the same question ("which suppliers have we not heard from since spring?") through the same sample data: one `DATA` object in `_src/data.js`, built into every page by `_src/build.py`.

New employee test verdicts below are my own judgement of a first read, not tests with people. Keys on every sheet: **G** turns the assistant (model gateway) off and shows what still works; **T** shows technical words one step down; **R** replays. Each sheet runs its moment about 1.2 s after load. Checked at 1600×900 and 1280×800, with G and T on and off, and no console errors.

## The vocabulary (what all six agree on)

| Plain word | One step down | Set as | Never claims |
|---|---|---|---|
| Question | query text + reading | Your words verbatim, in quotes; under them the reading, in the record's words | to be understood before you confirm the reading; your words are never rewritten in place |
| Clarification | disambiguation | One neutral question, 2 to 4 choices in a fixed order (calendar, size), each with the count it would leave, plus "something else" | a right answer; it never leads and never asks what the record can answer itself |
| Workings | query plan, in plain words | Numbered steps in the order they ran: count, who did it, what was left out | to be complete beyond its sources |
| Answer | result set | A count first, how sure in words, then rows with sources | more certainty than its weakest step, or a guess as a fact; zero is said with what was checked |
| Gap | coverage note | One of the six ways to be empty, what it means for this answer, who could fill it | "nothing found" when it means "not looked" or "not yours to see" |
| Saved question | stored query + run log | Name, your words, confirmed reading, shared with, reruns, answer last changed | that today's answer is the one it was saved with; it never asks the assistant again |

**Three voices** run through every sheet: *your words* (quotes, `--x-proposed-yours`), *the record* (Data Atlas, ink, with a source number), and *a guess* (the assistant, i.e. the model gateway: cooler ink, a dashed line, and the word "guess" or a named mark). A guess is never shown by colour alone.

**What needs the model gateway, and what works without it** (the same on all six sheets):

| Step | With the assistant | Without it |
|---|---|---|
| Reading free words | Drafts a reading (a guess until you confirm) | You pick it from a sentence (the catalogue's "said in a sentence"); Data Atlas finds kinds and details by name and spelling |
| Clarifying | Suggests filters you didn't say ("running contracts only?") | The structure raises the questions: a word in the org glossary ("spring"), a detail with several sources ("heard from"). The extra filter is offered with its count, not asked |
| Matching records | One match by meaning (Easterby, 12 Apr), shown and never counted | Keys and spelling only; the unmatched email waits in Triage |
| Running, counting, gaps, saving, rerunning | Never | Always. Data Atlas does all of it |

So the answer's rows are the same with or without the model. The route to the reading is what changes.

---

## V1: Enquiry slip
*Idea.* The question sheet as the slip a reference desk fills in: six ruled fields in the order a librarian works. Anything the assistant proposes is **pencilled** (dashed, cooler, a pencil). Only you **ink** it. Nothing pencilled is counted. The moment: the pencilled reading inks itself line by line as you confirm it. The one unconfirmed match (Easterby) stays in pencil.

*Sources.* Library enquiry slips and reference statistics forms; Dervin and Dewdney's neutral questioning (1986); pencil-then-ink drafting.

*What works.* The metaphor needs no teaching: everyone knows pencil means "not final". A slip holds all six parts on one page, so you can check a question top to bottom. The table on the right ("with the assistant / without it") is the clearest statement of the gateway's job of the six sheets.

*What fails or risks.* Inking **erases provenance**: once you agree, the reading looks the same as a fact from the record. Six months later, a colleague can't tell what the model proposed. The slip runs long; at 1280 the answer shows two rows. "Pencil" uses one Lucide glyph that also means "edit" elsewhere in AUGUR.

*Principles.* Explain-never-hide: strong (everything left out is on the slip). Calm: yes, nothing moves after the inking. Focus stacking and letterbox: not used.

*Needs.* `--x-proposed-guess-ink`, `--x-proposed-guess-line`; an "inked by" record per proposal (who confirmed it, when).

*New employee test.* **Pass** (my judgement, not tested with a person): "pencil = not yet" should need no legend.

*Gateway.* Needs it for: the draft reading, the "running contracts" suggestion, the meaning match. Works without it for everything else (the G key shows each replacement).

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4.

## V2: Leiden marks
*Idea.* Set the question like an epigrapher's edition. Your words are the text on the stone. ( ) is a word the glossary expands. ⟨ ⟩ is supplied by the assistant. An underdot means less sure (matched by spelling). [ . . . ] is no record, ⟦ ⟧ is not yours to see, and *vac.* is none. An **apparatus** under the rule lists the readings not taken ("since spring] since 1 March 9 : since 1 April 12 : since 31 May 17"), which turns the clarification into a footnote you can reopen. The moment: the marks set themselves into the plain text, sign by sign.

*Sources.* The Leiden conventions (1931) for epigraphic editions; the apparatus criticus of critical editions.

*What works.* It is the most precise mark set: eight distinct states in one line of running text, with no colour needed. The apparatus is a strong idea worth keeping on its own: every reading not taken stays one glance away, with its count.

*What fails or risks.* The marks are a learned code. Operators read ⟨ ⟩ and ( ) as the same thing, and brackets inside sentences tire the eye over a working day. Long answers become one dense paragraph. The hatch over ⟦ ⟧ text costs legibility.

*Principles.* Explain-never-hide: high. Calm: yes. It conflicts with plain-words-first, because the signs need a key.

*Needs.* The same guess tokens; mono for the signs (`--font-mono`, still needs an ADR).

*New employee test.* **Fail** without the conventions table. Keep it for the technical register (T) and for exports.

*Gateway.* ⟨ ⟩ is the only sign that needs it. With G off no ⟨ ⟩ appears, and the line reads "(you picked)".

*Score.* Clarity 2 · Distinctiveness 5 · Feasibility 4 · Fit 3.

## V3: Working papers
*Idea.* An auditor's working paper. Every line has a reference, a count, a **tickmark** for how it was checked (agreed to the record, by key, by spelling, counted, you chose, the assistant's guess, not examined) and a **prepared by / agreed** pair of columns. A line the assistant prepared keeps its dashed box *for good*. When you agree it, your initials sit beside it. It never reaches a total until then. "Open items" lists the gaps with who clears each, and the header records who prepared, drafted and reran the paper. The moment: the ticks stamp down the column.

*Sources.* Audit working papers: tickmark legends, "prepared by / reviewed by" initials, PBC (provided by client), scope limitations, open-items lists, the double rule under a total.

*What works.* It answers the run's hardest question directly. *Which steps used the model gateway* is a column, not a footnote, and provenance never washes out (the opposite of V1). The total's double rule makes "a guess never reaches a count" visible. Open items are honest gaps with names. It is a table, so it is cheap in Quill.

*What fails or risks.* Eight tickmarks is a lot to learn; operators will learn the first four. It reads as bureaucratic, close to the "query builder that assumes you think in tables" the prompt wants to avoid. It suits the *answer with its workings* page more than *the ask*.

*Principles.* Explain-never-hide: the strongest of the six. Calm: yes. Consequence preview: the clarification counts sit in the ledger.

*Needs.* Per-step provenance in the stored question: who prepared each step, who agreed, when. `--x-proposed-guess-line` for the dashed box.

*New employee test.* **Pass, with the legend.** "Prepared by" and "agreed" explain themselves; the ticks need the key once.

*Gateway.* Rows Q.1, C.2, C.3 and W.5 are the assistant's. With G off, Q.1 and C.2 become "You, from a sentence", C.3 disappears and W.5 becomes "matched nobody, waits in Triage".

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 4.

## V4: Chart and zones
*Idea.* Draw the answer over a diagram of its sources, like a sea chart printed over its zones of confidence. Each supplier's last contact is a **sounding** (a solid dot with its source number). The reading's cut-off is a contour line, and the readings not taken are dashed contours with their counts. The assistant's match is a **reported** mark: hollow and dashed, and never used to draw the line. Below the answer is a band per source showing where it is complete, partial, not kept (wavy) or not yours to see (135° hatch, whom to ask). The saved question is the chart's cartouche, with its editions and notices of change ("27 Oct: 9, Northgate Fuels emailed on 22 Oct, answer changed"). The moment: the cut-off line slides from 31 May to 1 April to 1 March as the clarification is answered (17, 12, 9).

*Sources.* Nautical charts: soundings, CATZOC zones of confidence, "Rep" (reported, not surveyed); Notices to Mariners; Shneiderman's dynamic queries (the answer moves as you shape the question).

*What works.* It is the only sheet where gaps are *geography*. You see that emails don't exist before January, so Carrow's silence might only be our records' silence. The sliding contour is the clarification as a consequence preview, and the cartouche with its notices is a lovely form for "answer last changed".

*What fails or risks.* It only works for questions with a time axis. "What do we know about this port?" has no x-axis. Thirteen rows is the limit before it needs folding. Chart reading is a skill, and labels collide with contour lines at high density. It costs more in Quill (positioned marks, a shared axis).

*Principles.* Explain-never-hide: strong for coverage. Calm: the slide runs once. Time as an address: the editions are moments.

*Needs.* Coverage dates per source (when each source starts, and whether it is complete), which Data Atlas doesn't store yet. `--x-proposed-contour-alt`.

*New employee test.* **Partial.** The dots and line read at once; the zones need the legend.

*Gateway.* Only the reported mark. With G off it vanishes and the email waits in Triage; every sounding and line stays the same.

*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 4.

## V5: Three sizes
*Idea.* A type specimen for the six parts: each drawn as a **chip** (Glance, a toast, a mention in Mandate or Artifacts), a **card** (Home, a list) and a **page**. It decides what drops at each size, by rule, as a map generalises with scale. The key rule: *a guess never drops to a size that can't mark it.* A chip can't draw a dashed line legibly, so a chip that would carry a guess says "1 guess needs you" instead. The moment: a ring follows one guess from chip to card to page.

*Sources.* Type foundry specimen sheets; cartographic generalisation (what drops at each scale).

*What works.* It is the sheet a kit team needs. It is honest about where a guess could be lost (toasts, Glance), and the "needs you" chip ties into the shell's existing things that need you. It is the cheapest to build.

*What fails or risks.* It is a spec sheet, not a concept; it adds no new way to read an answer. The card size invents a run sparkline that needs a run log.

*Principles.* Explain-never-hide at every size; calm (a chip is quiet unless it needs you).

*Needs.* Chip and card variants in Aerie (Glance) and Quill (lists); a run log for the sparkline.

*New employee test.* **Pass** (chips and cards are familiar shapes).

*Gateway.* With G off, nothing is dashed at any size, and no chip says "needs you" for a guess.

*Score.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4.

## V6: Two transcripts
*Idea.* The same question as two transcripts side by side: **with the assistant** and **without it**. Every speaker has a cue: You (in quotes), Data Atlas (every number, with its source) and the assistant (indented, dashed, labelled guess). What was *done* is a stage direction in brackets, apart from what was *said*. The assistant only asks or proposes and never says a count. A middle gutter marks where the two transcripts agree (=), nearly agree (≈) or end at the **same rows**. With G off, the left transcript dims and says nobody gets it now. The moment: the lines arrive in turn.

*Sources.* Court transcripts and screenplay format (cues, parentheticals); conversation-analysis turn-taking.

*What works.* It is the best explanation of the model's role of the six: Harry, an admin or an auditor can see in one screen that turning the gateway off changes the conversation, not the answer. "The assistant asks, never tells" is a crisp rule for every model-written line in AUGUR. It also found something: **without the model, the answer can look surer than it is** (sure for 8 of 9, because the system doesn't know the stray email might be Easterby's). The "waits in Triage" line is what keeps that honest.

*What fails or risks.* Two columns is a documentation and admin view, not something an operator uses every day. Data Atlas speaking in sentences makes the record sound like a person, which slightly undercuts the line between the record and the assistant. At 1280 the never-claims move into tooltips.

*Principles.* Explain-never-hide: very strong for the gateway. Calm: yes. Turn-taking (room-tone concept): used.

*Needs.* Nothing new beyond the guess tokens. It needs a decision on whether the assistant may speak in the first person (here it never says "I").

*New employee test.* **Pass.** It reads like a conversation.

*Gateway.* This sheet is the gateway table, drawn out.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 3.

---

## Ranked

1. **V3 Working papers**: who prepared each line, kept for good; a guess never reaches a total; open items with names.
2. **V6 Two transcripts**: the clearest proof that the model changes the route, not the rows. Use it for Admin's gateway page and for docs.
3. **V1 Enquiry slip**: the friendliest everyday form. Take its pencil word, but not its ink-erases-provenance rule.
4. **V5 Three sizes**: the kit rule, in particular "a guess never drops to a size that can't mark it".
5. **V4 Chart and zones**: keep it for time questions and for the *when the data can't answer* surface. Its source bands are the best drawing of a gap.
6. **V2 Leiden marks**: keep the apparatus (readings not taken, with counts) and drop the brackets.

## What I'd build first

One **guess mark** for the whole kit, and the rule that goes with it: a cooler ink, a 1px dashed line, and the word "guess" plus who made it, never colour alone (V1's pencil word for operators, V3's "prepared by" underneath). The rule: a guess keeps its mark after you agree it (your initials are added, the dashes stay), never enters a count or a total, and at chip size becomes "needs you". Then a **prepared-by column** in the answer's workings (V3), which gives every step one of three actors: You, Data Atlas or the assistant. That one column answers "which steps used the model gateway", and it lets the saved question rerun honestly. A rerun replays the confirmed reading and the Data Atlas steps and never calls the gateway; any new meaning-match it would have needed waits in Triage. It is two small kit parts (the mark, the actor cell), and every other surface in this run can stand on them.

## Where this goes beyond the ask, and pushes back

- **Provenance over tidiness.** V1's inking is pleasant, but it erases who proposed what. I recommend the V3 rule (dashes stay, initials added), even though a page with many accepted guesses looks busier.
- **Without the model, an answer can look surer than it is** (V6). An unmatched record that might belong to an answer row must say so ("1 email matched nobody, in Triage"), or turning the gateway off quietly raises confidence.
- **The assistant's plain name.** These sheets call it "the assistant" (the shell already has one) and "model gateway" one step down. If the shell's assistant and Data Atlas's reader are different things to people, this needs one word.

## Needs token
- `--x-proposed-guess-ink`: the guess's ink, a mix of `--info` and `--ink-muted`.
- `--x-proposed-guess-line`: a 1px dashed rule in that ink.
- `--x-proposed-yours`: your words (currently `--light`).
- `--x-proposed-contour-alt` (V4): a reading not taken.
- Carried from the catalogue, still unadopted: `--x-gap`, `--x-stale`, `--x-shadow`, `--x-quiet`.
- `--font-mono` is used for counts, cues and ticks on every sheet and still needs an ADR.

## Data the shell doesn't have yet
- An **org glossary** (deployment config: "spring", "financial year"), so clarifications can be raised without a model.
- **Per-step provenance** in a stored question: who prepared each step, who agreed it, when.
- A **run log** per saved question: when each run happened, its count, and the change against the last run with a reason ("Northgate Fuels emailed on 22 Oct").
- **Coverage per source**: when it starts, and whether it is complete, partial or on another floor (V4's zones).
- Model matches stored as **unconfirmed proposals** linked to the answer rows they would change (Triage holds proposals, but not this link).
