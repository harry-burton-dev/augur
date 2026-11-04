# Round 2 · Combined screens

Four screens that combine the strongest round-1 variants into something that could ship. They share the run's one sample (`_src/data.js`) and engine (`_src/lib.js`); every count is worked out by running the recipe. Keys on every page: **R** replays, **T** admin words. Checked at 1600×900 and 1280×800, with reduced motion; see the run README for what was checked.

---

## V1: From drop to Triage, and a month later
`v1-drop-to-triage-and-a-month-later.html` · the realistic end-to-end flow the prompt asked for. ← → or 1–0 move between ten stages; the recipe as it stands and the tray are always in the right-hand rail.

*Idea.* One messy file, start to finish, then next month's. **October:** (1) arrives: the email, kept as it came (D-2291), goods-in checks including "its own count agrees: 26 lines − 1 copy = 25, as the TOTAL says"; a one-paragraph description of the mess. (2) First look: what the file settles by itself (day first, no year means 2026, five-digit dates are day numbers, line 18 is a copy) and the two questions only Ade can answer (the loan van; the Type column with no detail), each "heard" into the recipe. (3) Tidy: three readings of one fix, the line stopping once at `c.12k`, the sheet showing kept values with seams. (4) Map: the sentence, exact matches in ink, WF-09 weighed against WF-08 and proposed as new, one model link in pencil, inked. (5) The pass: 24 / 1 / 21 / 4 / 2 / 9, the balance, 7 plates tasted, what it moves (the overdue briefing goes from 7 of 18 to 2 of 18), sent as 46 proposals. (6) Triage: Priya keeps 44 and holds the new van with a question; the tray stays with Ade. **A month later:** (7) the file arrives and the saved recipe runs on its own: "Needs you: stopped at 2 lines; 21 ready behind the stops"; 8 of 12 lines ran as last month; one new spelling joined North depot for a one-time check. (8) Two answers (Vehicle is Reg now; set "Deferred - parts on order" aside and ask Lena for "deferred"), shown as version 1 → version 2 of the recipe. (9) The pass again: 21 land, 2 set aside, Technician left out; the WF-09 inspection joins the held proposal instead of proposing the van twice. (10) Kept: one inspection's van and depot, each with "why, and since when": was, from (document and cell), made by (recipe, version, line), run, kept by.

*Sources.* Bring-in V1, V4, V5; by-example V1, V6; mapping V1, V3, V6; pass V1, V2, V4, V5, V6; next month V4, V5, V6; grammar V3, V4, V5.

*What works.*
- The whole job reads as one story with two shapes: a careful first month (six stages, a few minutes of a person's time) and a quick second month (two answers). That is the argument for recipes in one screen.
- The rail makes the recipe the constant: it is written during October, saved at the pass, run in November, and changed by exactly the two answers. The tray is always visible and always counted.
- Every count on every stage agrees, because they all come from one run: 25 = 24 + 1 in October, 23 = 21 + 2 in November, 46 proposals, 44 kept.
- The second month shows the three kinds of change the prompt cares about: what broke (two stops), what changed but was handled (a new spelling, a moved TOTAL, a new column left out and said), and what didn't change (eight lines, quiet).

*What fails or risks.*
- Ten stages is a demo, not a product flow; the product is three places (the bench, the pass, Triage) plus Home. The stage strip is for this prototype only.
- Some stages are summaries of round-1 screens rather than the screens themselves; stage 4 in particular compresses mapping into four cards.
- At 1280×800 the rail's recipe scrolls and step counts hide; the tray truncates its reasons.
- The held WF-09 carrying into November ("joins the held proposal instead of proposing the van twice") needs Triage to know that a proposal is still open, which it doesn't.

*Principles.* Explain, never hide: strong (tray, left-out, waiting are always on screen). Calm: only stops and the open question light; a normal month would be dark. Consequence preview: the pass. Visible repair: recipe versions and value seams. Letterbox: not used (nothing here is urgent).

*Needs.* Everything in the shortlist's "data the shell doesn't have": a recipe store with versions and per-line ids, per-value provenance in Data Atlas, Triage bundles and holds, recipe runs on the jobs engine, a way for files to arrive.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 3 · Fit 5

## V2: The bench
`v2-the-bench.html` · the working surface. 1–3 pick a reading, Enter uses it, S answers the call.

*Idea.* The sheet as the file holds it, with kept values (Jost, seam) replacing raw ones (mono) as lines of the recipe apply. Ade has just changed `nv 03` to `NV-03`: the three readings appear beside that cell, each with its count and its residue ("1 can't be read this way: it will stop and ask"; "5 would still not be like NV-03"), previewed on the column in pencil. Using reading 1 writes recipe line 6 into the rail, and the line stops at `Spare/loan` with a call in the rail (its note, Kestrel counted it, "guessing would put a visit on the wrong van") and three answers. "Heard: recipe line 6 now also says: set aside a line with no van number. Next month it won't ask." The tray runs under the sheet. "Next: Result has 10 ways of writing 3 results."

*Sources.* By-example V1 (readings with residue), V5 (the recipe writes itself), V6 (stop the line); grammar V3 (raw and kept), V4 (calls and heard).

*What works.* Everything a person needs to tidy is in one view: the data, the proposal, the consequence, the recipe and the misfits. The call lives in the rail, next to the line that made it, not in a dialog. The "next" hint picks the column with the most shapes, so the bench leads without nagging.

*What fails or risks.* The readings popover covers columns B–E while it is open; it should dock beside the column instead. A 2,000-line sheet needs the sheet to scroll to misfits, and the popover's residue counts become the main signal. Only one call at a time is shown; several stops of one kind should group (next month V3).

*Principles.* Explain, never hide: strong. Calm: the call is the only warm thing. Pencil and ink: the preview is pencil until used.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V3: The pass at both ends
`v3-the-pass-at-both-ends.html` · B and V switch between Ade's bench and Priya's Triage; Y tastes the next plate.

*Idea.* The pass a person could ship: the ticket rail (make, make, change, link, set aside, not brought in, waiting), the balance under it, the taste (every plate an answer touched plus three at random, seeded by the file), and what it moves. Send is disabled until the taste is done ("Taste 3 more first"). Switch to Triage and the same bundle appears with the same rail, balance and taste ("the same 6 for you"), now with decisions on the tickets (23 kept · 1 held; new van held) and Priya's note.

*Sources.* Pass V1, V2, V4, V5, V6.

*What works.* "The pass is one object seen at both ends" is now literal: Priya sees exactly what Ade saw, including what he tasted. Making tasting a gate on Send is a small, cheap control that stops rubber-stamping. The held van holds its inspection, shown as a count.

*What fails or risks.* Three equal panes give the taste and the downstream the same weight as the balance; the balance matters most and should lead. "What it moves" needs every app to answer a "would change" query. A deployment where Ade and Priya are the same person needs the pass to say so.

*Principles.* Consequence preview: strongest. Explain, never hide. Calm.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 3 · Fit 5

## V4: Why, and since when
`v4-why-and-since-when.html` · ↑↓ pick a reading.

*Idea.* A month later, van NV-06 in Data Atlas. Its odometer, since when: 11,900 from the fleet register (March); "not known yet" on 3 Oct (D-2291, Oct!F9 said "c.12k", set aside by line 10); 12,010 on 6 Nov **by hand** (Ade, from the workshop job card JC-5512, when the new odometer was fitted; kept by Triage T-0601); 12,960 on 19 Nov from D-2417, Nov!G19, recipe R-0007 version 2. Pick any reading and the right pane says why: was, from, made by (recipe, version, line), run, kept by, the note, and under T the PROV terms.

*Sources.* Grammar V5 (the life of one value); next month V5 (versions); wear and time's visible repair and "why, and since when?".

*What works.* It answers the prompt's third question in the place people will actually ask it: on the record. Three hands (a register, a file read by a recipe, a person) are told apart by a word and a mark, and the hand-typed reading is a seam, not a silent edit. Answering the tray later is shown to be part of the same history, not a side channel.

*What fails or risks.* Per-value provenance is storage-heavy unless it is kept per run and per line (see grammar V5). The timeline is for one detail of one van; a record with twenty details needs "why" on demand, not a timeline per detail.

*Principles.* History as a material; visible repair; time is matter (no light on history). Calm.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 5

---

## Ranked
1. **V1** as the reference flow for the shortlist.
2. **V2 The bench** as the first thing to build.
3. **V3 The pass at both ends**.
4. **V4 Why, and since when**, once Data Atlas stores per-value provenance.

## Needs token
The run's new tokens (`--x-proposed-raw-ground`, `--x-proposed-seam`, `--x-proposed-aside-edge`, `--x-proposed-aside-wash`, `--x-proposed-stop`, `--x-proposed-stop-wash`, `--x-proposed-pass-edge`) and the carried ones. All rely on `--font-mono` for raw values.
