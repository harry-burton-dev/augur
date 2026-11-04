# Surface 3 · Tidying by example

**The moment:** Ade fixes one messy value (`nv 03` → `NV-03`, `3 Oct` → `3 Oct 2026`, `12400 mi` → `12,400`) and the bench offers to fix the rest the same way. Nothing changes until Ade picks; every fix becomes one numbered recipe line with its count and its example.

**Shared data:** the run's one sample. Each page runs the first five recipe lines (title, names, total, empty lines, copies) so it starts from the 25 lines of visits, then applies only the fix it is about. Keys: **R** replays, **T** admin words, plus each page's own.

---

## V1: Fix one, see three readings
*Idea.* Ade changes line 6 from `nv 03` to `NV-03`. The bench offers three readings of what that meant, each previewed on the sheet in pencil: (1) write every van number like NV-03 (5 values; "Spare/loan" can't be read this way), (2) change only "nv 03" (1 value; 5 still not like NV-03), (3) make Reg upper case (4 values; 6 still not like NV-03, and SPARE/LOAN). Pick one; "heard" names the recipe line, and line 23 is left waiting.

*Sources.* Kandel, Heer et al., Wrangler (2011) and predictive interaction: select, see suggested transforms, preview, pick.

*What works.* Showing each reading's *residue* ("5 values still not like NV-03") is what makes the choice easy: the right reading leaves nothing but the one odd value. Pencil on the sheet is the preview, so the consequence is seen where the data is.

*What fails or risks.* Three readings for a van number is generous; for a free-text column there could be dozens, and ranking them is the hard part Wrangler solved with a model of likely transforms. The pencil preview in a 2,000-line sheet needs the residue count more than the cells.

*Principles.* Consequence preview: strong. Explain, never hide: the value that can't be read is named. Calm.

*Needs.* A small transform language with per-value results (could be compiled to SQL).

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V2: One more example where they differ
*Idea.* Before and after, as two columns. Ade's example (`3 Oct` → `3 Oct 2026`) fills every other date in pencil. Where the example can't decide, the row shows both readings: `01/10/2026` is "1 Oct 2026 or 10 Jan 2026". Eight dates have two readings; the bench asks for one more example on one of them, and that settles all eight. Spreadsheet day numbers say so; dates that only work day first say so.

*Sources.* FlashFill and programming by example (Gulwani): examples define a program; ambiguity is resolved by asking for the example that splits the candidates. The reference desk's "ask only what changes".

*What works.* It is honest about what one example can teach. The ask is exactly one question, on the row that splits the most, and it shows the two outcomes. "A guess that is wrong moves visits by months" is the reason given, which is why it doesn't guess even though six dates only work day first.

*What fails or risks.* Two readings side by side in warning colour on eight rows is busy. It overlaps with bring-in V5, which already settled day-first from the evidence; together the bench would never need to ask here. A person may give an example that is itself wrong; the second example should be checked against the first.

*Principles.* Explain, never hide: strong. Ask only what changes. Calm: the ask is the only warm pane.

*Needs.* Candidate programs per example and their disagreements.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V3: Spellings that belong together
*Idea.* Ten spellings in Depot, grouped three ways for a person to confirm: same letters (finds nothing here), shares a word (2 groups, 6 spellings; "depot" and "store" don't count), near spelling (2 groups, 4 spellings), and all three together (3 groups, 9 spellings). Each group is aimed at a depot Data Atlas already keeps. `W'field` is in no group; the bench offers "to Westfield depot" by hand. Joining is a person's choice; "heard" counts the lines.

*Sources.* OpenRefine's clustering (key collision with fingerprint keys, nearest neighbour with Levenshtein); Data Atlas's own matching by keys, names and spelling (`pg_trgm`).

*What works.* Showing that each method finds different groups teaches why there is a choice and why a person confirms. Aiming each group at a thing Data Atlas keeps turns clustering into matching, which is the real goal. "The recipe keeps every spelling it joined" means next month's `Nth Depot` goes straight to North depot without asking.

*What fails or risks.* Three method buttons is an admin's view; an operator should see "all three" and nothing else, with the methods under T. A "shares a word" rule would wrongly join "North depot" and "North depot workshop" if both existed; the target must always be shown. `W'field` needed a by-hand join; with the model gateway on, matching by meaning would propose it (in pencil).

*Principles.* Explain, never hide: strong (the ungrouped spelling is listed). Consequence preview: lines per group. Calm.

*Needs.* Clustering methods (OpenRefine's are documented and small); Data Atlas's spelling match as the target finder.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V4: Bowls by shape
*Idea.* The Reg values sorted into bowls by shape: "2 capitals, a dash, 2 digits" (the one you want), "2 small letters, a space, 2 digits", "2 capitals, 2 digits", and "a word, a slash, a word". Pour a bowl into the one you want; the poured values arrive as kept values with their seam. The odd bowl (`Spare/loan`) can't be poured and stays on the bench with "Set aside".

*Sources.* Mise en place bowls (group by what things are); Trifacta's pattern facets.

*What works.* Pouring a whole shape is one decision a person can check by eye, and the shapes in words ("2 small letters, a space, 2 digits") need no regex. The odd bowl makes "nothing silently dropped" physical.

*What fails or risks.* Charming, and wasteful of space. Shapes in words get long for real text. Works for columns of codes, not for names or notes. Overlaps with V1's reading 1, which does the same in one click.

*Principles.* Explain, never hide: strong. Calm: two pours, then still.

*Needs.* Shape profiles (bring-in V2).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 3

## V5: The recipe writes itself
*Idea.* Sheet left, recipe right. Each fix by example writes one line, live, with its words, its example (raw → kept), its count and who taught it on which line; the sheet's changed cells turn to kept values with a seam. Undo keeps the line, struck through ("kept struck through, so the next person sees it was tried"), and the values go back to raw. Keys 1–3 fix, U undoes.

*Sources.* Power Query's applied steps; Wrangler's transform history; knitting patterns (the pattern is the record of what was done).

*What works.* "You never write a line" is the core promise of the prompt, and it is visible here: three fixes, three lines, all in plain words with counts. The recipe and the sheet agree at every moment because both come from the same run. Undo as strike-through is visible repair applied to the recipe itself.

*What fails or risks.* The sheet is wide and the recipe narrow; on a 1280 screen the Notes column is cut. Line numbers jump (6, 7, 9) because they come from the saved recipe; a live recipe would number as it goes and renumber on reorder, which breaks "made by line 6" provenance unless lines have stable ids under their numbers.

*Principles.* Explain, never hide: strong. Visible repair. Calm: each line lands once.

*Needs.* Stable line ids (shown as numbers, kept as ids) so reordering doesn't break provenance.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 5

## V6: Stop the line
*Idea.* The example (`12400 mi` → `12,400`) runs down Odometer one value at a time. At line 9, `c.12k`, the line stops: an andon strip lights ("Stopped at line 9: c.12k can't be read as miles. 5 of 25 done. Nothing after it has changed"), the row is marked, and the bench asks with context (van NV-06, its note "odo not working") and three answers: set aside just this reading (the visit lands; odometer not known yet), type the reading (marked as yours), set aside the whole line. After an answer the line restarts and stops again at `—` on line 23.

*Sources.* Toyota's jidoka and the andon cord: stop the line at the first defect, fix the cause, restart; never pass a defect downstream.

*What works.* The strongest expression of "stop and ask, don't guess". The context in the question (the note) is what lets a person answer in seconds. Each answer becomes part of the recipe line, so a rerun only stops for something new. The andon strip is the only lit thing, and it goes dark when done.

*What fails or risks.* Stopping at every misfit on a 2,000-line file would be exhausting; the stop should gather all misfits of one kind and ask once ("2 readings can't be read: c.12k, —"). Animated running is theatre; in practice it would be instant. The warning-amber lamp is close to an error signal.

*Principles.* Explain, never hide: strong. Calm: the line is dark until it stops. Light as signal: the stop is the beacon. A good fit with the cinematic run's "dark when normal".

*Needs token.* Uses `--x-proposed-stop` and `--x-proposed-stop-wash`.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

---

## Ranked
1. **V1 Three readings**, with V2's rule: when the readings disagree, ask for one example where they differ.
2. **V6 Stop the line**, grouping misfits of one kind into one stop.
3. **V5 The recipe writes itself**: the recipe beside the sheet, always.
4. **V3 Clusters**, showing "all three" only, aimed at what Data Atlas keeps.
5. **V2 One more example**, as the ambiguity rule inside V1.
6. **V4 Bowls**, as a teaching view.

**What I'd build first:** the V5 layout (sheet left, recipe right) with V1's three readings appearing beside the cell you just changed, each with its residue. Misfits stop the line the V6 way, one stop per kind of misfit, with the row's own context. Clustering (V3) is the same pattern for name columns. The transform engine is a small, closed set of verbs (write like, read as, group, split, set aside), each compiled to SQL; the person never sees the SQL except under T.

## Needs token
Uses the run's raw, seam, aside and stop tokens. No new ones here.
