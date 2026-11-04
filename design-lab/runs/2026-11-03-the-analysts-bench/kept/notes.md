# The working, kept

D-142, read a year later. Nadia Osei became Head of Facilities in September 2027; on 18 Nov 2027 she opens the decision Jo Reyes chaired on 10 Dec 2026. Four techniques shaped it (how things like this usually go, competing explanations, check the assumptions, imagine it failed: 81 minutes in all), and a year of events has happened since: a watch crossed in January and February, Low Moor phase 2 arrived in May, tender preparation started 12 days late because AUGUR couldn't see a date pass, and missed collections were back under 15 by May. The score of each tested judgement is in `_src/data.js` (`later`).

The question every variant answers: **can a reader a year on see how the judgement was tested, and whether the tests were right?**

---

## V1: How it was tested
*Idea.* The decision record (words fixed, status beside them, from the minute run) with a section under the words: **how it was tested**, one line per technique (when, minutes, who, what it found, what it changed). Above it, "decided below its bar, with a hedge": no surer than its weakest assumption, and the hedge written at the table. A side column lists its watches and the techniques **not run, and why**.

*Sources.* UK JIC assessments' scope notes; decision records (ADRs).

*What works.* It is the smallest change to the decision record that answers the prompt, and it reads in a minute. "Not run, and why" is the honest half most records leave out. "Below its bar, with a hedge" says out loud what most decisions hide.

*What fails or risks.* It shows what was done, not whether it was right; it needs V3's score beside it a year on. The watches column is long.

*Principles.* Explain, never hide: strong. Status beside the words: kept. Calm.

*Needs.* The decision record's link to its working (result records by `Ref`). A "not run, because" field.

*Test.* A new reader should answer "which technique set the term?" from this page alone in under a minute.

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 5.

## V2: Glosses
*Idea.* The decision's words in the middle of the page, as in a glossed manuscript or a Talmud page; the techniques that shaped each phrase in the margins around them, numbered. "12 months" carries a gloss from the outside view; "a break at 6 months" from the assumptions check; "£120" and "Start tender preparation" from the premortem; "service credit" from competing explanations. The page counts words and glossed phrases: 38 words, 5 glossed.

*Sources.* Glossed manuscripts; the Talmud page layout.

*What works.* It ties working to words at the phrase, which no other variant does. A reader sees which parts of the decision were tested and which came through untested. Beautiful and calm.

*What fails or risks.* Needs phrase anchors that survive (the minute run's "words fixed once agreed" makes that possible). Margins don't scale past six or seven glosses. Hover-to-light is not keyboard-friendly yet (keys 1 to 5 do it).

*Principles.* Explain, never hide: strong. Calm: still page.

*Needs.* Phrase-level links from decision words to result records.

*Test.* Every phrase changed between draft and decision should carry a gloss; an unglossed change means a change happened outside the bench, and the page should say so.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4.

## V3: The score
*Idea.* A year on, every tested judgement set against **what happened**: the forecast (5 in 11; it happened), the explanation (held: Tuesday's misses fell once the 9th vehicle ran), each assumption (6 of 7 held; the unsupported one held a week late, caught by its watch), each premortem reason (3 happened at least partly). The side column sums it up and keeps the floor's record: of six forecasts called "about half", three happened.

*Sources.* Tetlock and Gardner, *Superforecasting* (2015), keeping score; the after-action review.

*What works.* It is the only way the bench can learn whether its techniques work here, and it is plain: held, partly, didn't, can't tell. "Can't tell" is kept (the county contract was never visible), which stops the score flattering itself. Facts, not grades: nobody is blamed.

*What fails or risks.* One decision proves nothing, and people will over-read it. Outcomes need someone to record them; most will be computed from watches, some won't. A Brier score would be more exact but means nothing to an operator; plain counts are the right register.

*Principles.* Explain, never hide: strong (can't tell is a state). Calm.

*Needs.* An outcome per assumption, reason and forecast: computed from watches where possible, asked of the owner at the review date otherwise.

*Test.* Over a floor's year, assumptions marked solid should hold more often than those marked unsupported. If not, the marks mean nothing and the yardstick rule needs looking at.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4.

## V4: The redline
*Idea.* The draft that went into the bench ("five years, £60 credit") and the words that came out, as a **redline**: struck words, inserted words underlined, each change numbered with the technique that made it. A phrase kept but now resting on a technique ("service credit") is dotted. "Nothing was changed by the model."

*Sources.* Keeling schedules; legal redlines.

*What works.* "What did the bench change?" answered in one sentence of marks. It proves the techniques paid (every change has a source) and is familiar to anyone who has read a contract redline.

*What fails or risks.* Only works if a draft existed before the bench; many decisions are drafted after. Struck and inserted text in large type is busy.

*Principles.* Explain, never hide: strong. Visible repair: the redline is the seam.

*Needs.* The draft kept as a version on the decision; changes attributed to result records.

*Test.* Every inserted or struck phrase should map to a recorded change; an unattributed change is listed as "changed outside the bench".

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4.

## V5: The ledger
*Idea.* The working as a **bound ledger**: each technique an entry, dated and signed, with the facts it read and their word at the time, and beside each, what that fact says now ("7 vehicles since May" → "10 vehicles since June 2027"). Pencil is noted ("assistant proposed 'crews moved': taken, untested").

*Sources.* Laboratory notebooks; chain of custody.

*What works.* Then and now per fact is what an auditor asks for, and it shows that results rest on facts that move. Entries are added, never edited.

*What fails or risks.* Long; it's a reference view, not a reading view. "Now" values need the facts' current state, which is live and can be on floors the reader can't open.

*Principles.* Explain, never hide: strong. History as material.

*Needs.* Fact values at the time of each technique (the minute run's "value at decision time"), and live values with access applied.

*Test.* For every fact a technique read, the ledger can show its value then. A missing "then" is a bug in how results are stored.

*Score.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4.

## V6: Ask the working
*Idea.* Nadia asks the decision a question ("did anyone think the price would rise?"). The model only matches her words to one of a fixed set of reader questions, in pencil; the answer is **built from the working's records by template**, every line pointing at its entry ("check the assumptions · 24 Nov 2026 · a3"). One question it refuses: "Was it the right decision?"

*Sources.* The reference desk run; the briefing run's lead's questions.

*What works.* It is how people actually read old decisions: with one question in mind. Fixed questions per record type keep answers exact and the model out of the answer. The refusal is a good line.

*What fails or risks.* Only as good as the fixed questions; people will ask others. A free question the model can't match should say so and offer the five, not guess.

*Principles.* Pencil and ink: the match is pencil; the answer is ink. Explain, never hide: refusals stated.

*Needs.* Reader questions per record type as templates over result records.

*Test.* With the model off, every answer must be identical when the question is picked from the list.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4.

---

## Ranked
1. **V1 How it was tested.** The section every decision record gets.
2. **V3 The score.** What turns the bench from a habit into a learning system.
3. **V4 The redline.** The proof that the techniques changed the decision.
4. **V6 Ask the working.** The reading mode a year on.
5. **V2 Glosses.** The most beautiful; needs phrase anchors.
6. **V5 The ledger.** The auditor's view, one step down.

## What I'd build first
**V1's section** on the decision record in Mandate, fed by result records, with **V3's score** appearing beside it at the decision's review date. V4's redline is free if the draft is kept as a version. V6's questions come after, as templates. The score is the part I'd push hardest: without it nobody will ever know whether the bench works here.

## Needs token
Nothing new beyond the grammar's list.
