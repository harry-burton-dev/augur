# Surface 1 · The ladder (grammar)

**The question:** what are the words and marks every screen uses for the climb from data to information to context? Each item must say its rung and what lifted it there (a comparison, a threshold, a rate, a definition, a question, an intent, a reader, what else is going on, what happens next).

**Shared data, one object (`DATA`) for the whole run:** Westmere District Services (Org, 1,240 people), its Environment and Streets department (52) and the Collections North team (11). The task is **WS-31, "Renew the Brightwell collection contract?"**. Tom Reyes, a contracts officer, assembles it on 3 Nov for Grace Obi, Head of Environment and Streets, who decides by 1 Dec (Mandate intent M-208). The reading at the bottom is *27 missed collections in October*. Tom moves to Housing on 14 Nov, and Leah Morgan takes the set over. Contract reader (CR), an agent under Tom, reads the contract. Every count, name, date and sentence part comes from `DATA`. The rung of each piece, what lifted it, its reason and what it holds while are fields on the piece, never typed into the markup.

**Keys on every page:** R replays and T shows the admin words one step down (two registers: "derived value · Explorer query" under *Information*). Each page plays its moment about 1.2 s after load.

**The marks the run settled on** (V1 is where they were chosen):

| Mark | What it says | Looks like |
|---|---|---|
| Rung | data, information or context | a three-step stair filled to the rung, plus the word. Never a colour |
| Lift | what raised it a rung | a dashed chip with a Lucide icon and the words ("compared with July") |
| Reader | who it is context for | context text takes the reader's floor colour as a left edge |
| Why here | the reason, in the adder's words | italic quote with name and date |
| Holds while | the condition it stays true under | link icon; struck through and unlinked when broken |
| Said, not checked | someone's word | dashed underline with a quote icon |
| Not yours to see, sources disagree, an agent's work | carried from the catalogue, briefing and apprentice runs | 135° hatch with whom to ask; warning edges; dotted maker's mark |

**Files:** `v1-specimen.html` … `v6-the-difference.html`, built by `../_src/build.py` from `../_src/common.css`, `data.js`, `lib.js` and `_src/v*.src.html`.

---

## V1: The specimen
*Idea.* A type specimen sheet for the three rungs: one reading shown as data, information and context, built from the bottom up, with every mark numbered and explained in a key. Between rungs a "lifted by" row names the step and says it is never automatic.

*Sources.* Type foundry specimen sheets (one face shown at every size with its anatomy labelled); Ackoff's rungs; the nut graf (the context rung reads like one).

*What works.* It fixes the vocabulary in one page: the stair mark, the lift chip, the reader edge, the reason and the condition. Each rung *looks* different without colour: data is mono figures, information is a sentence, context is a sentence with its reader's floor edge. That gives a rule anyone can apply: if a sentence has no reader, it isn't context yet. The key carries the run's empty marks (not yours to see, disagree, said, pencil), so the grammar includes what can be missing.

*What fails or risks.* It is a reference sheet, not a working screen. Three rungs stacked bottom-up read against the eye's top-down habit, the same problem the briefing's ladder had. At 1280 the key has to drop its last three rows.

*Principles.* Explain, never hide: strong. Each mark explains itself, and the empties are part of the grammar. Calm: it builds once, then nothing moves. No letterbox or focus stacking.

*Needs.* `--x-proposed-rung-step` (the stair), `--x-proposed-lift-edge` (the dashed lift chip). A rung field and a lift list on every working-set piece.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V2: Reaction scheme
*Idea.* The climb drawn the way a chemist writes a reaction. What was added goes above the arrow (a second reading, the contract's clause, the task's question). The kind of lift and who did it go below ("a comparison · template", "a question + a reader · Tom"). The same reading is lifted three ways. The third path gives **N.R., no reaction**: a rate that bears on nothing in the decision, kept with why.

*Sources.* Chemical reaction notation (reagents above the arrow, conditions below; "N.R." as a recorded result); Frické's critique that you can't get information out of data by processing alone.

*What works.* "Above: what you brought in. Below: who and how" is the clearest statement in the run that a lift is an act, not a filter. The N.R. path makes "we looked and it doesn't matter here" a result worth keeping, which the working set needs (set aside, with why). Branching from one reading into two contexts (the decision, the crews) shows that context is per reader before the readers surface does.

*What fails or risks.* Few people know reaction notation, so the arrows look like a flowchart. Seven columns are dense at 1280 (the sources drop out). It doesn't scale past three or four paths.

*Principles.* Explain, never hide: strong (N.R. is kept). Calm: the arrows draw once. No letterbox.

*Needs.* A lift record that names its input (the comparison base, the rule) and its actor ("template" or a person).

*Scores.* Clarity 3 · Distinctiveness 5 · Feasibility 4 · Fit 3

## V3: There, means, next
*Idea.* Endsley's three levels of situation awareness as three bands: what is there (perception, data), what it means (comprehension, information) and what happens next (projection, the part of context most often missing). The third band counts what has been projected and draws what hasn't been as corner-ticked gaps, each naming who could project it. A side panel maps Endsley's "demons" (out of the loop, the memory trap, data overload, an errant mental model, misplaced salience) to the grammar rule that answers each.

*Sources.* Mica Endsley, "Toward a theory of situation awareness in dynamic systems" (1995), and her SA design principles; the catalogue run's "not known yet" corner ticks.

*What works.* It adds what the other variants miss: context isn't only about who reads it, it is also about what comes next. "2 projected, 2 gaps" makes a missing projection visible, so a set with no level 3 looks unfinished. The demons give each rule a job: *the memory trap* is exactly the prompt's "lost when they move on".

*What fails or risks.* Endsley's levels and Ackoff's rungs don't line up exactly: a projection can be pure information ("on the trend, 30 in November"). The bands imply a set should fill all three, which isn't true of every task. The demons panel is for designers, not operators.

*Principles.* Explain, never hide: strong (missing projections are drawn). Calm. No letterbox.

*Needs.* A "projection" lift kind and gap records with a named filler (the empty knows its errand).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V4: The museum label
*Idea.* Three label tiers around one object, as in a gallery: the **tombstone** (data: what, where, when, kept by whom), the **caption** (information: what it means, with its lift), and the **interpretation panel** (context), which changes with the visitor. Press 1, 2 or 3 to change the visitor between the Team lead, the Department head and the Org. Tilden's six principles sit beside it, rewritten as rules.

*Sources.* Freeman Tilden, *Interpreting Our Heritage* (1957); V&A and Beverly Serrell label practice (*Exhibit Labels*), with the tombstone, caption and panel hierarchy.

*What works.* It is the most intuitive explanation of why context belongs to its reader: the object and the caption never change, only the panel does. "Information, as such, is not interpretation" goes straight into the grammar. Every panel ends on the visitor's question rather than advice, which keeps context from becoming a recommendation the model writes. Big and quiet, it fits the water language.

*What fails or risks.* The panel text is written per reader (in `DATA.readers`). In the product someone must write it, and three panels per figure is real work. The museum framing makes context look like a display, when the prompt wants a working object.

*Principles.* Explain, never hide: good. Calm: the panel crossfades between visitors once and then holds. No letterbox.

*Needs.* A reader slot on context pieces; templates for the tombstone and caption from Data Atlas and Explorer.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 3 · Fit 5

## V5: Signed lifts
*Idea.* The climb isn't automatic, so every lift is signed. Lifts by rule (comparison, threshold, rate, definition) are signed by their template. Lifts by judgement (question, intent, reader, what else is going on, what happens next) are signed by a person, and an agent may only offer them in pencil. Each step also shows one way it could be wrong. At the moment, the agent offers to lift "the two counts differ by 8" to context. The offer is held in pencil because a lift to context needs a reader and a reason; it can be accepted as information only, or a person names a reader (N).

*Sources.* Frické (2009) and Weinberger (*Too Big to Know*, 2011) against the automatic pyramid; the reference desk's pencil and ink; the apprentice's ceiling.

*What works.* It gives the cleanest answer to "what may an agent do on the ladder?": **an agent may lift by rule, and may propose but never sign a lift by judgement.** The split between nine lift kinds (four by rule, five by judgement) is simple enough for the kit. "How it could be wrong" on every step is a cheap, honest habit that the frames surface builds on.

*What fails or risks.* Writing a "could be wrong" line per step is effort nobody will keep up beyond a set that matters. The signature column repeats one name most of the time.

*Principles.* Explain, never hide: strong. Calm: the pencil offer appears once. No letterbox.

*Needs.* `lift.kind` (rule or judgement) and `lift.by` on every piece; an agent ceiling entry: "lift to context" is never alone.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 4

## V6: Different from, different to
*Idea.* Bateson's "difference which makes a difference", in two halves. **Different from:** information is the reading set against a base (July, the limit, the supplier's count, the count without the changed rounds); each base gives a different difference, and the base is the lift. **Different to:** context is information that would change what someone does; for the decider, each piece pins to an option (renew, extend six months, retender), for or against. A piece that pins to no option is information for this task, however true.

*Sources.* Gregory Bateson, *Steps to an Ecology of Mind* (1972); decision analysis's value of information (Howard, 1966).

*What works.* It gives two tests anyone can apply. Information: "different from what?" Context: "different to what you'd do?" The options board is the most decision-shaped view in the grammar, and it shows the driver story pinning to nothing until it is checked. "No difference, no context" is a good rule for keeping sets small.

*What fails or risks.* The for and against pins are judgements and could become a scoring game. The base line at the top is hard to read when bases cluster near the reading (19, 20, 19). It suits decisions with clear options, not open situations.

*Principles.* Explain, never hide: good. Calm: pins drop once. No letterbox.

*Needs.* Options on a Mandate decision (the decision sets the bar's "kind of decision"), and a pin from piece to option.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

---

## Ranked
1. **V1 The specimen**: the vocabulary, fixed.
2. **V5 Signed lifts**: the rule for people and agents on the ladder.
3. **V4 The museum label**: the clearest "why context has a reader".
4. **V6 Different from, different to**: the two tests.
5. **V3 There, means, next**: projection as its own band.
6. **V2 Reaction scheme**: best idea (N.R.), hardest to read.

**What I'd build first.** V1's marks as kit parts in Common: the rung stair, the lift chip, the reader edge, "why here" and "holds while", with V5's rule that a lift is *by rule* (template) or *by judgement* (a person signs, an agent proposes). Use V6's two questions, "different from what?" and "different to what you'd do?", as the help text on the rung mark. Leave V3's projection band as a lift kind ("what happens next") rather than a layout.
