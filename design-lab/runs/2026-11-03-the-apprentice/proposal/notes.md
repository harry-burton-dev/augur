# Surface 3 · A proposal waiting

**The moment:** Survey reader read the Lloyd's Register annual survey of MV Northern Tern (IMO 9412337) at 00:00 on Monday and proposes four details: gross tonnage 3,412, next special survey due 14 Mar 2027, class ✠100A1, and an owner, "Tern Shipping Ltd", which disagrees with the port register's "Northern Tern Shipping AS". Ana Ferreira, its supervisor, decides. Every variant marks the work as the agent's (pencil, maker's mark SR) until a person accepts it, shows its workings, and offers accept, change or reject.

**Data:** `DATA.proposal` (the document, the lines with their quotes, the pattern reader's results, the six steps, the fixed reject reasons) and `DATA.kinds` (the record of each kind of work). Keys: R replays, T shows the ADR and Triage terms, G turns the model gateway off.

---

## V1: Pencil on the record
*Idea.* The proposal sits on the vessel's own record in Data Atlas: ink details from the port register, and below them the agent's four lines in pencil with the maker's mark, each with tick, change and cross. The focused line folds out its workings (the passage, the pattern's reading, what the record has now). The owner shows two answers side by side with the disagree mark; the agent may not choose. A side panel says who proposed it, under whom, and carries the agent's mode line.

*Sources.* The copy-editor's pencil on a proof (suggestions in the margin of the real text); pencil and ink (reference desk run).

*What works.* It is where the reader already is: the record. The difference between ink and pencil is visible in place, so nobody mistakes a proposal for a fact. "Pencil isn't counted anywhere until a person accepts it" is said once, next to the work. Two answers side by side is the honest form of a disagreement.

*What fails or risks.* Accepting one line at a time on the record is slow for a batch of 46 (V6 and diary V5 are the batch forms). A record with many pending agent lines becomes mostly pencil; the record needs a "hide pencil" view for readers who aren't deciding. Change is shown as a toy edit here.

*Principles.* Pencil and ink: strong. Explain, never hide: strong (two answers, never one chosen silently). Calm: one fold-out.

*Needs.* Triage proposals rendered on the entity page, not only in the Triage queue; `proposedBy` with agent and supervisor.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V2: The source beside the claim
*Idea.* The page the agent read on the left, as text, with the passages it used marked; the proposed details on the right; a tie from each detail to its passage, solid for the one in focus. A chain-of-custody line says when the report arrived, which run read it, when it was proposed and that nothing else touched it.

*Sources.* Court exhibit marking and the annotated transcript; chain of custody for evidence; the reference desk's "the answer has a base".

*What works.* It is the fastest way to check a reading: the eye goes from the value to the passage and back. It makes the important negative visible: lines the agent didn't use (net tonnage, deadweight) are there too, so a person can see what it skipped. The chain line answers "could anything else have changed this?"

*What fails or risks.* It needs the document as text with positions, which scanned PDFs don't give without OCR. Ties between two columns fail when the passage is off-screen (page 5 of 7). At 1280 the two columns are narrow. It shows the source, not the reasoning: a value read from the wrong row (the Nordhavn mistake) would look tied and right.

*Principles.* Explain, never hide: strong. Calm: the ties are static.

*Needs.* Passage spans (page, offset) on each proposal; Artifacts renditions with text positions.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V3: The workings
*Idea.* The agent's method as six numbered steps, each marked by who did it: AUGUR (found the report, matched by IMO number, compared with the record, proposed), the model (read the pages) or a pattern (read the same lines again without the model). On the right, what the steps produced. G strikes the model step and shows what is left: three of four details, the match intact, no number changed.

*Sources.* "Show your working" in maths; the reference desk's method card; the brief's pencil and ink.

*What works.* It shows how small the model's part is: one step of six, and every value but one was also found without it. That is the strongest argument for trusting the rest of the pipeline and for keeping the model in pencil. "Accepting the details doesn't accept the method; the method is kept with them" is a rule worth keeping.

*What fails or risks.* Six steps is the happy path; a real run has retries and tool calls, and the list would grow. "Change step 2: another vessel" implies the person can edit the agent's method, which is a bigger promise than Triage makes today.

*Principles.* The workings show: strong. Pencil and ink: G changes the route, not the numbers.

*Needs.* Run steps with a plain-words label and a `by` (model, pattern, AUGUR), which the runs service would record anyway for audit.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V4: Read twice
*Idea.* Every detail is read twice, by the model and by a pattern, and set against the record. The verdict is worked out by rule: read the same twice (can go in a batch), model only (always checked, always in the sample), a person chooses (readings or record disagree; never in a batch), not read (gateway off, nothing guessed).

*Sources.* Dual keying in data entry (two people type the same form; differences are checked); the four-eyes principle; the briefing run's "confidence is worked out".

*What works.* It turns "how sure is the agent?" into a rule a person can check, without a model-made confidence score. The rule decides batch eligibility: **a detail read by only one reader is always in the sample** and **a disagreement never goes in a batch**. It is the bridge between the proposal and the sampling in diary V5.

*What fails or risks.* A pattern reader for each kind of detail is real work, and some details (class notation, free-text remarks) won't have one. Two readers built on the same wrong assumption (the Nordhavn column order) agree and are both wrong: agreement is not truth, which the mistake surface shows.

*Principles.* Confidence worked out by rule; explain, never hide. Calm: columns fill once.

*Needs.* A pattern reader per kind of detail in the agent app; a verdict field on each proposal (`readings: agree | single | differ`), set by AUGUR, not the agent.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V5: The marking scheme
*Idea.* One detail, large, and three marks: tick, correct, cross. Pointing at a mark previews what it does to the agent's record for this kind of work before you make it (ticked 214 +1; in a row 60 → 0). A cross asks for one reason from a fixed list (wrong vessel, wrong value, wrong unit or format, not in the source, out of date, not ours to record).

*Sources.* Examiners' marking schemes (tick, correction, cross, with a reason code); the apprentice's crit; consequence preview (cinematic run).

*What works.* It makes the record that trust is built on visible at the moment it is written, and says plainly that **a mark changes the record, never the rung**: widening and narrowing are a separate decision. Fixed reasons make patterns countable: ten crosses for "wrong unit" are one problem, not ten bad days.

*What fails or risks.* Showing the run of ticks ("60 in a row") turns checking into a game, and may make a supervisor reluctant to break a streak. One detail at a time is slow. A correction counted against the agent when the source itself was wrong is unfair; the reasons need "the source was wrong".

*Principles.* Consequence preview: strong. Calm: still until you point.

*Needs.* A feedback event per mark (kind of work, verdict, reason); a record per kind of work; "the source was wrong" as a seventh reason.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 3

## V6: Two hands in Triage
*Idea.* Triage with people's and agents' proposals in one queue, and a table of the seven ways they differ: who wrote it, how it looks, how it comes (one at a time or by run), what it carries (a named source or full workings), who may accept it (any reviewer but the author, or only the supervisor and deputy, never an agent), what happens after (ink with the author's name, or ink that keeps the maker's mark and counts on the agent's record), and how it shows in the Inbox (one item for the floor's reviewers, or one item per run for the supervisor).

*Sources.* An editor's in-tray (staff copy and agency copy in one pile, marked differently); maker's marks.

*What works.* It answers the prompt's third question directly. The two most important differences: **an agent's proposal can only be accepted by a person, and only its supervisor or deputy**, and **an agent's work reaches the Inbox once per run, not once per detail**, so Inbox counts stay human-sized. The pencil row style makes the queue readable at a glance.

*What fails or risks.* A queue that mixes both may let agent batches crowd out people's single proposals; it may need a "people first" sort. Limiting acceptance of agent work to the supervisor makes the supervisor a bottleneck; the deputy is the release valve, and the rule should allow a named group.

*Principles.* Explain, never hide: the table is the explanation. Pencil and ink: whole rows in pencil.

*Needs.* `proposedBy { kind: person | agent, id, supervisor }` on Triage proposals; an Inbox item whose ref is a run (ADR 0026's Ref back to the app, pointed at the runs service).

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

---

## Ranking
1. **V6 Two hands in Triage**: answers how agent proposals differ, and keeps the Inbox human-sized.
2. **V2 The source beside the claim**: the fastest check of a reading.
3. **V4 Read twice**: the rule that decides what may go in a batch.
4. **V1 Pencil on the record**: the reader's view, where the work lands.
5. **V3 The workings**: shows how small the model's part is.
6. **V5 The marking scheme**: right about reasons, wrong to make a streak visible.

**What I'd build first.** `proposedBy` on Triage proposals with the maker's mark (V6), the passage span on each proposal so the source can sit beside the claim (V2), and AUGUR's read-twice verdict (V4) deciding which details may go in a batch and which are always checked. Fixed reject reasons from V5, without the streak.

## Needs token
Same set as the grammar (carried pencil, seam, disagree, lit; new standby, ceiling, mark size). V2's document background mixes `--ink` into `--slate-deep`; a `--x-proposed-paper` would name it. All pages rely on `--font-mono`.
