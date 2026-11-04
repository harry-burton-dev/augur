# Surface 6 · Next month's file

**The moment:** on 2 December Mo Ridley sends `Kestrel_Ridgeway_Nov26.xlsx`. Ade's saved recipe ("Kestrel monthly visits", version 1) runs on it. Most of it runs as before, but the file has changed in two ways the recipe can't handle: **the Reg column is now called Vehicle** (and a Technician column was inserted before it), and **two lines have a result nobody knows, "Deferred - parts on order"**. One new spelling ("Nrth depot") is near enough to join North depot by the recipe's own rule, and is shown for a one-time check. The rerun should show only what changed or broke.

**Shared data:** the run's one sample. November: 27 lines, 23 lines of visits, TOTAL says 23. Without answers the run stops at recipe lines 6 and 11 (no column Reg; Vehicle is new and 23 of 23 of its values look like van numbers) and line 9 (lines 8 and 21, NV-18 and NV-09). With Ade's two answers (Vehicle is Reg; set the two lines aside and ask Lena Ortiz for "deferred"), 21 inspections are ready, 2 set aside, Technician left out, and 23 = 21 + 2. Keys: **R**, **T**, plus each page's own.

---

## V1: The run sheet
*Idea.* The saved recipe reruns line by line, with October's count and November's beside each line and a verdict: same, ran, check, stopped, with your answer. It stops at line 6 and waits, with the question beside it ("Is Vehicle the column that used to be called Reg?") and its evidence; one answer fixes lines 6 and 11. It runs on, stops at line 9 for the new result, and after the second answer reaches the pass: 21 ready, 2 set aside, 1 column left out, 23 = 21 + 2.

*Sources.* A production run sheet; jidoka; Power Query's refresh with step errors.

*What works.* Showing last month's counts beside this month's makes "same" checkable, and quiet. "Lines 6 and 11 read either name from now on" tells the person exactly what their answer changes in the recipe. Nothing after a stop has run, so nothing half-done is lying around.

*What fails or risks.* Twelve lines for two problems is a lot of reading; the operator has to scan for the lit ones. Running line by line is theatre; in reality it would be instant and the page would open at the first stop. Count columns side by side invite comparing numbers that should differ (23 lines, not 26).

*Principles.* Explain, never hide: strong. Calm: only stops light. Jidoka.

*Needs.* Recipe lines that name columns (grammar V2), so "can't find Reg" is possible at all.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V2: Month over month
*Idea.* This month's file held against last month's, column by column, worst first. Whole-file facts at the top (23 lines of visits, not 26; title in the same place; TOTAL moved one column but still starts with TOTAL; "Sheet2" gone; 1 formula). Then each column with October's and November's values or shapes: Result (`Deferred - parts on order` is new, 2 lines, no line of the recipe knows it; `Fail - lights` is new too and read as before), Reg (gone; Vehicle has the same shapes, probably renamed), Technician (new; looks like people's names, so not brought in), Depot (`Nrth depot` new, near North Depot, joined; check once), Vehicle (new name, old shapes). Date, Type, Odometer, Notes are dimmed as the same ("free text: new words every month, which is not news").

*Sources.* Diff; a tailor's fitting (hold the new cloth against the old pattern).

*What works.* It is the only view that finds the rename by *evidence* (the new column's shapes match the old one's) before the recipe even runs. "New values the recipe already reads are not news" keeps it quiet: Fail - lights with a hyphen instead of a dash is new, and correctly not a problem.

*What fails or risks.* It compares files, not the recipe's outcome, so it can say "new" about things that don't matter and needs the recipe's readers to know what's handled. Value chips get long for wide columns. The people's-names heuristic (an initial and a surname) is fragile.

*Principles.* Explain, never hide: strong. Calm: dimmed when same.

*Needs.* Profiles kept per run, to compare against.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V3: The andon board
*Idea.* Every recipe line is a station on a board. Normal is dark. A check is an amber edge; a stop is lit with the reason and the answer buttons on the tile. Station 11 says "same cause as station 6: no Reg", so one answer clears two stations. The header counts: 3 stations stopped, 1 to check, 8 running as usual. "The line waits. Nothing has gone anywhere; 21 inspections are ready behind the stops."

*Sources.* Toyota's andon board; the dark cockpit (only abnormal is lit); "dark when normal" from the cinematic run.

*What works.* The clearest "dark when normal" in the run: a normal month is a dark board. Linking stops by cause stops people answering the same question twice. Answers sit on the tile that stopped, so there is no separate question pane.

*What fails or risks.* A board of twelve tiles is a lot of furniture for a monthly file; it suits someone running many recipes at once. Counting a linked stop as a third stop overstates the work (two answers, not three).

*Principles.* Dark when normal: strongest. Light as signal. Explain, never hide.

*Needs.* Stops grouped by cause in the engine.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V4: Only what's new
*Idea.* Management by exception. "Kestrel's November 2026 visits: arrived 2 Dec, 07:58; the recipe ran to the pass and stopped short of it." A tally (21 ready, 2 stopped, 2 to look at, 8 recipe lines as last month), then four exceptions, each with its evidence and a suggested answer as the first button: Reg is called Vehicle now; a result nobody knows; a new spelling joined North depot (check once); a new column, Technician, isn't brought in. Everything else is one sentence ("Everything else ran as last month: …; counts moved with the file, which is not news").

*Sources.* Management by exception; a sous-chef's handover at the start of service.

*What works.* It is the literal answer to "see only what changed or broke", and it reads in thirty seconds. Suggested answers are what the evidence supports, so most months are four clicks. The "everything else" sentence keeps the rest visible without asking for attention.

*What fails or risks.* It hides the recipe; a person who wants to know *why* the suggestion is right has to go to V1. Suggested answers can become rubber stamps.

*Principles.* Explain, never hide: good (the rest is one sentence, not nothing). Calm: two stops lit, two checks quiet.

*Needs.* Exceptions as data with a suggested answer and its evidence.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 5

## V5: The pattern changes, not the cloth
*Idea.* Answering a stop changes the recipe, not the data. Version 1 and version 2 side by side, only the changed lines: line 6 reads "Reg or Vehicle", line 9 adds "set aside 'Deferred - parts on order' until 'deferred' exists", line 12 adds "leave Technician out", each with the stop and the answer that changed it. Beside it, the versions and the runs they made (October: 24 by version 1; November: 21 by version 2), and two rules: nothing knitted is unpicked (October's records keep "made by version 1"; version 2 gives the same answer for every October line, so no rerun is offered), and going back is itself a new version.

*Sources.* Knitting patterns and their errata; the wear-and-time run's visible repair.

*What works.* It makes the recipe's history readable, which is the prompt's third question: a value says "made by version 1, line 6", and the version diff says what version 2 would have done differently. Each change carries its reason, so a reviewer a year later understands why line 9 has a special case.

*What fails or risks.* Version numbers per answer could multiply (one per month); versions should be per run, not per answer. The claim "version 2 gives the same answer for every October line" must be computed by rerunning, which costs time on big files.

*Principles.* Visible repair: strong. History as a material. Explain, never hide.

*Needs.* Recipe versions with per-line reasons; a dry rerun of a new version over old files.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V6: Rehearsed to the pass
*Idea.* When a file arrives, its saved recipe runs on its own, up to the pass and never past it. Ade's morning: "Needs you" holds one item ("Kestrel monthly visits" stopped at 2 lines; 21 ready behind the stops); "Ready at the pass" holds the quiet ones (the fuel card statement, 212 fuel purchases; the tyre fitting log, 9 fittings, 1 set aside), each with "Check and send". Nothing has reached Triage. N shows a normal month: nothing lights, and Kestrel's run waits quietly with the others.

*Sources.* Dark when normal; a prep list (the morning's prep done before the chef arrives); Data Atlas's Triage ("nothing skips it").

*What works.* Automation that never decides: the recipe does the prep, a person always does the pass. Only a stop reaches "Needs you"; a normal month makes no noise at all. It answers where reruns live day to day.

*What fails or risks.* Matching a file to its recipe automatically (by sender and columns) can pick the wrong recipe; the match must be shown and changeable. A file that arrives by email needs an inbox AUGUR can read, which it doesn't have. "Check and send" on a 212-line file needs the taste step (pass V4) to be meaningful.

*Principles.* Dark when normal: strong. Calm. The urgent path is never used: a stopped recipe isn't urgent.

*Needs.* A way for files to arrive (email or upload), the jobs engine to run recipes on arrival (ADR 0027), and Home entries from apps.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 3 · Fit 5

---

## Ranked
1. **V4 Only what's new**, opened from **V6's "Needs you"**.
2. **V5 The pattern changes**: every answer is a recipe version with its reason.
3. **V3 Andon board**, for people running many recipes; its "same cause" grouping goes everywhere.
4. **V1 Run sheet**, as the detail behind V4.
5. **V2 Month over month**, as the evidence behind a rename.
6. (none dropped; V1 and V2 become detail views)

**What I'd build first:** recipes rerun on arrival up to the pass (V6), with only stops reaching anyone. Opening one shows only what's new (V4), each exception with its evidence and a suggested answer; stops with one cause are grouped (V3). Each answer becomes a new recipe version with its reason (V5), and the run sheet (V1) is the detail behind it all.

## Needs token
Uses the run's stop, aside and seam tokens; nothing new.
