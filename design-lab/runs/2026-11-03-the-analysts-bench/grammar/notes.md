# Grammar · the bench

Six reference sheets for one vocabulary: **kinds of question**, the **technique** for each, its **price** (minutes and people, said before it starts), what it **makes**, and **where the result is kept**. Every page uses one sample deployment (Vale Regional Services, Facilities on the Department floor) and the contract renewal the briefing and minute runs used: Calder Waste, the North round, intent INT-208, decided as D-142 on 10 Dec 2026. All data sits in `_src/data.js`; the confidence words come from the briefing run's yardstick, worked out by the same rule (`derive()` in `_src/lib.js`). **R** replays, **T** shows each technique's trade name and source one step down, **G** turns the model off (pencil disappears; no mark, count or word changes).

The vocabulary, as people see it:

| Kind of question (what a person says) | Technique (plain name) | Trade name, under T | Price |
|---|---|---|---|
| Why did this happen? | Competing explanations | Analysis of competing hypotheses (Heuer) | 25 min, 1 to 3 people |
| How will it go? How long, how much? | How things like this usually go | Outside view, reference class forecasting | 10 min, on your own |
| Will our plan work? | Check the assumptions | Key assumptions check | 15 min, 1 or 2 people |
| We're about to commit. What could go wrong? | Imagine it failed | Premortem (Klein) | 20 min, 3 to 8 people together |
| Can we rely on what we've been told? | Check the sources | Quality of information check | 10 min, on your own |
| We're leaning one way. Are we right? | The case against | Devil's advocacy | 15 min, you and a challenger |

Left to training, and named on the bench so nobody wonders where they went: Team A / Team B, red team, high impact low probability, what if, fishbone, five whys, Fermi estimates, scenarios.

New employee test verdicts are my own judgement of a first read, not tests with people.

---

## V1: The shelf
*Idea.* The bench as a lean **shadow board**: six tools, each in its painted outline, with the question it answers in quotes as its title. A tool that is out leaves an empty outline that says who has it, on what and how far through ("Sam Okafor and Marta Kowal, on INT-208, 12 of 25 min"). Under the board, the techniques left to training sit as quiet chips with their reason on hover.

*Sources.* The Tradecraft Primer's shelf of short named techniques (2009); lean 5S shadow boards.

*What works.* The question comes first and the technique's name second, which is the whole brief in one glance. The empty outline is a cheap, honest "in use" state that also advertises the bench to the rest of the floor. Each tool shows what the model may and may never do, so the pencil rule is learnt at the shelf, not mid-task.

*What fails or risks.* A shelf invites browsing, and browsing is what the prompt wants to avoid: people should describe the question, not shop for a method. Six cards of the same weight make every technique look equally important. At 1280 the "kept" line drops to fit.

*Principles.* Explain, never hide: strong (the training shelf says why each is absent). Calm: the tools drop into place once. Focus stacking and letterbox: not used.

*Needs.* Nothing new beyond the pencil and lit tokens. Data: a live "in use" state per technique and output (the bench's own result records).

*Test (falsifiable).* If the shelf is the way in, more than half of runs should start from a question card rather than a technique name. If people mostly pick by name, the shelf is teaching names, not questions.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 4.

## V2: The key
*Idea.* A **field guide's dichotomous key**: five numbered couplets of two plain statements ("It is about what has already happened" / "…what will happen"). The person takes the true line and the key ends at exactly one technique. The renewal's six real questions, as people asked them, walk their own paths, and the path stays lit.

*Sources.* Dichotomous identification keys in botany and entomology; the Tradecraft Primer's grouping of techniques by purpose.

*What works.* At most five steps, and nobody needs to know a technique's name to arrive. Every end is one technique, never a list. It doubles as the rule the other choosing variants run on, and it can be tested on its own: six sample questions, six different ends.

*What fails or risks.* A key is only as good as its couplets, and real questions are often two at once (the renewal is "why" and "commit"). The key picks the first true line and can't say "you need two, in this order"; choose V1 and V3 handle that. It reads as a form.

*Principles.* Explain, never hide: strong (the lines not taken stay visible, quieter). Calm: the path lights once.

*Needs.* The couplets are product grammar, fixed for every deployment and translated per locale.

*Test.* Give ten operators the six renewal questions with the key: at least eight of ten should reach the same technique as an analyst would. Below that, a couplet is ambiguous and the page says which.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 4.

## V3: Four situations
*Idea.* Before any technique, one test: **does anyone know what causes what?** Cynefin's four domains, each with its test in a sentence, its method, and its techniques. Clear and chaotic both say **"No technique"**: follow the procedure, or act first and review after. The renewal's own questions place themselves: the notice date is clear, why service fell is complicated, whether Calder will recover is complex, and the Tuesday nobody turned up was chaotic.

*Sources.* Snowden and Boone, "A leader's framework for decision making" (HBR 2007).

*What works.* It is the only sheet where the bench can say no. That matters for trust: a tool that always offers a method will be ignored by people who know when one isn't needed. Showing one decision holding all four situations stops people treating "complex" as a label for a whole project.

*What fails or risks.* Cynefin is easily misread as a 2×2 of difficulty. The test sentence has to carry it, and the domain names are jargon to a civilian operator (I kept them as headings because they are short; under T they could be plainer). The confused centre isn't drawn.

*Principles.* Explain, never hide: strong ("no technique" is shown, not omitted). Calm: questions settle once.

*Needs.* Nothing new. Placing a situation is always the person's call; the model may suggest in pencil.

*Test.* On a sample of a month's bench runs, the share of runs on questions a lead would call "clear" should fall after the sheet ships. If it doesn't, the "no technique" cell isn't being read.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 4.

## V4: The result label
*Idea.* What every technique leaves behind, drawn as a **museum specimen label** with nine numbered parts: the question in the asker's words; the technique with minutes said and taken; who ran it (and the model by its own mark); the facts it ran on with their word at the time; the result in one sentence, built by template; what it changed in the output; what it left open; pencil offered and whether a person took it; where it is kept.

*Sources.* Museum specimen labels; laboratory notebooks; Heuer's advice to record the evidence and the reasoning, not just the conclusion.

*What works.* It is the data contract for the whole run, readable by a person. "What it changed" is the strongest field: a result that changed nothing says so, and that is what lets a floor keep score on its techniques (V5). The label is the same for all six techniques, so one kit part renders them all.

*What fails or risks.* Nine parts is a lot for a chip; the label needs the three heights (chip, card, page) the briefing run found. Positioned number pins are fiddly in React; a grid with named areas would be steadier.

*Principles.* Explain, never hide: very strong. Calm: one part lights at a time.

*Needs.* A **result record** type with a `Ref`, cited by the output it shaped, and its nine fields. Facts kept by `Ref` with their word at the time (the minute run's "value at decision time").

*Test.* A reader a year on, given only the label, should be able to say what was tested, by whom and what it changed, in under a minute. If they need to open the run, a part is missing.

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 4.

## V5: Priced in minutes
*Idea.* Each technique as a bar of minutes, solid for on your own and striped for people together (the minutes are each person's). Under each bar, the renewal's own run: **said 25, took 31**. Beside it, what "pays" means for that technique, as a test anyone can check at the end of a quarter.

*Sources.* Klein's premortem (about 20 minutes); Tetlock and Gardner's habit of keeping score; kitchen menus that print the price before you order.

*What works.* "Cheap to start, quick to finish" is made checkable. The renewal took 81 minutes for 70 said, and every technique changed a line. A five-person premortem costing 100 minutes of the floor is said plainly. The quarterly rule ("a technique that changed nothing in 3 of every 4 runs leaves the shelf for that floor") makes the bench prune itself.

*What fails or risks.* "Changed a line" can be gamed by trivial edits. Minutes are easy to count; value isn't, and the page might push people to the cheapest technique. The overrun colour borrows the disagree token, which over-signals a few minutes late.

*Principles.* Explain, never hide: strong. Calm: bars grow once.

*Needs.* Timing per run (start, finish, people). A floor-level record of runs. `--x-proposed-disagree` for over-time is a stretch; a quieter "over" ink would do.

*Test.* The bench claims "minutes, not hours": the median run of each technique should stay within 1.5× its said price. If a technique's median runs over, its price is re-said on the shelf.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4.

## V6: Widen, never narrow
*Idea.* A grid of who does what in each technique: **people** judge, **records** supply, **the model** works only in pencil, and a last column says what **nobody** may do (AUGUR refuses it in code). The headline rule: *the model widens; it never narrows.* It may add an explanation, a reason, a case against or a fact to look for. It never marks, ranks, drops, chooses or sets a word.

*Sources.* The Tradecraft Primer's devil's advocacy; pencil and ink (reference desk run).

*What works.* "Widen, never narrow" is a rule a non-expert can apply to any model output: did it add a possibility, or take one away? It holds across all six techniques and is testable in code. G empties one column and nothing else moves.

*What fails or risks.* It is a policy page, not a working page. Some "narrowing" is useful (a model spotting that two sources copy one origin narrows the evidence); I filed that under widening ("suggest") because a person still decides, but the line will need care.

*Principles.* Explain, never hide: strong. Calm: the pencil column fills once.

*Needs.* The model gateway's existing audit; a refusal list per technique (the "never" column) enforced server-side.

*Test.* With the model on and off, every mark, total, word and result sentence on a finished run must be identical. Any difference is a bug.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 4.

---

## Ranked
1. **V2 The key.** The choosing rule, in plain statements, that every other way in can use.
2. **V4 The result label.** The data contract and the reading form of every result.
3. **V6 Widen, never narrow.** The model rule for the whole bench, in four words.
4. **V3 Four situations.** The only sheet that says "no technique", which keeps the bench honest.
5. **V5 Priced in minutes.** The self-pruning rule; ship it as the bench's admin view.
6. **V1 The shelf.** Good as the bench's home page in Explorer, risky as the way in.

## What I'd build first
The **result label** as a record type and a kit part (chip, card, page), with the **key** as the rule that picks a technique and the **widen, never narrow** list enforced in the model gateway. Those three make every later surface cheaper: the choosing variants run the key, the techniques write labels, and the model rule is the same everywhere. The shelf and the price sheet come later, as Explorer's view of the bench.

## Needs token (all mixes of kit tokens)
- `--x-proposed-against`: the ink of a mark against an explanation (light with a touch of warning; never red).
- `--x-proposed-cell`: one cell of the explanations grid, a fixed size so grids compare.
- `--x-proposed-hedge`: the dashed edge of a fallback named at the table.
- `--x-proposed-future` and `--x-proposed-future-wash`: the far plane of an imagined future (premortem).
- Carried: `--x-proposed-rung-0…4` (briefing), pencil, lit, seam, unseen, disagree, quiet, micro type.
- `--font-mono` for numbers and eyebrows; it still needs an ADR.
