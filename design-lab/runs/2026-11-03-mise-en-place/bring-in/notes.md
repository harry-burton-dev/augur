# Surface 2 · Bringing a file in

**The moment:** Ade drops `Kestrel_Ridgeway_Oct26_FINAL v2.xlsx` on the bench. Before anything is changed, the bench says what the file holds in plain words: its columns, the kinds of value in them, and the problems it can see. The file is kept as it came (document D-2291 in the Supplier files library in Artifacts) and nothing is changed until Ade chooses to start tidying.

**Shared data:** the run's one sample (`_src/data.js`); every count is computed from the file's lines. A first look uses only what a profiler could know without a recipe (shapes, blanks, distinct values, which values read as dates, van numbers or miles), plus the TOTAL line. Keys: **R** replays, **T** admin words, plus each page's own.

---

## V1: In plain words
*Idea.* A short paragraph about the file, the way a reference librarian would describe a box of papers: "This file holds 26 lines of visits by Kestrel Fleet Services in October 2026, one line for each van they looked at. Above them are a title and two empty lines; at the bottom a TOTAL that says 25 visits." Every number in it is a button: focus it and its cells light in the sheet beside it. Below, the four things worth knowing (an exact copy, a line with no van number, an odometer that isn't a reading, two other sheets not brought in). "Nothing has changed yet."

*Sources.* Wrangler's and Trifacta's data profile; the reference librarian's first look at a donation; said-in-a-sentence (catalogue run).

*What works.* It is the fastest to read and the easiest to trust: every claim points at its cells. "Two other sheets: Rates (prices per visit, not visits) and Sheet2 (empty). Not brought in; say if they should be" is explain-never-hide applied to the parts of a file nobody asked about. The sheet shows the file exactly as it came, so the person can see the mess for themselves.

*What fails or risks.* The paragraph is written by templates, so it reads well only for files shaped like a list of things; a crosstab or a form-shaped sheet would need other sentences. "Probably pasted twice" is a guess in ink: it should be pencil, or left out.

*Principles.* Explain, never hide: strong. Calm: one light at a time, by the person's choice. Focus stacking: the lit cells are the near plane.

*Needs.* A profiler that returns per-column shapes and the lines behind each finding.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V2: The column shelf
*Idea.* One card per column on a shelf, like jars in a larder. Each card says the kind of value the bench thinks it holds ("van numbers", "names of places", "dates", "readings", "results", "free text"), how many are filled and different, and its shapes or values with counts and small bars, most common first. Columns with a dozen values or fewer are listed by value (every depot spelling); the rest by shape (`NV-01` stands for every `AA-99`). At the foot of each card, the one thing that is odd ("1 value isn't a van number: Spare/loan").

*Sources.* Wrangler and Trifacta column profiles and their pattern histograms; OpenRefine's text facet; a larder shelf.

*What works.* "Shapes, not errors": `nv 03` is a second way of writing the same thing, and each shape becomes one tidy step. It shows where the work is at a glance: Date has five shapes, Type has three values and is fine. The guessed kind is labelled as a guess.

*What fails or risks.* Seven columns fit; thirty would need a scrolling shelf and a way to sort by "most odd". Shape signatures (`AA-99`) are admin words: they must stay under T. Bars per shape are small on a 26-line file and only become useful at hundreds of lines.

*Principles.* Explain, never hide: strong (every shape listed, "and N more" counted). Calm: bars draw once.

*Needs.* Shape profiles per column.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V3: The x-ray
*Idea.* The whole sheet drawn as blocks by kind (van-like, date-like, number, words, empty, merged, names) before any word is read, with its structure named in the margin: a title across the top, the column names, 26 lines of visits broken by 2 empty lines, two lines the same, two values out of shape, a total at the foot. Pick a mark and a loupe shows those lines as cells.

*Sources.* Radiographs (structure before surface); spreadsheet "zoom to fit" views; Bertin's reorderable matrix.

*What works.* It finds layout problems words miss: the merged title, the empty lines, the total at the foot, the copy pair. For a file of thousands of lines it would scale better than any table, because each line is a sliver. Out-of-shape values sit exactly where they are in the file.

*What fails or risks.* Block textures carry the meaning (stripes for dates, solid for van-like), which needs a key and fails people who can't tell the textures apart. Pretty, but people don't think in blocks; it is a second view, not the first. Needs its own token for the cell width.

*Principles.* Explain, never hide: good. Calm: still. Focus stacking: the lit lines.

*Needs token.* `--x-proposed-xr-w`.

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V4: Goods in
*Idea.* The kitchen's goods-in check: the delivery against the docket before anything goes on the shelf. The email (from, to, when, subject, the attachment) beside a nine-line checklist, each with what was found and what it means: who sent it (a firm Data Atlas keeps), what arrived (three sheets, only Oct holds visits), kept as it came (D-2291), where the visits start, how many, **its own count** (26 lines − 1 exact copy = 25, which agrees with the TOTAL), hidden things (hidden columns and lines, formulas, a cell comment "excl. duplicates"), people's names, and whether a file like it has been seen before. Six as expected, three to look at, nothing refused.

*Sources.* Kitchen goods-in and HACCP receiving checks (temperature, packaging, use-by, docket); delivery notes; a receipt.

*What works.* "Its own count" is the best single check in the surface: the file's TOTAL is a free cross-foot, and here it explains the duplicate before anyone asks. The people's-names check is the right place for a privacy check. The receipt (kept as D-2291; whatever is made from it points back here) makes provenance start at the door.

*What fails or risks.* Nine checks every month will be skimmed; once a recipe exists, it should show only the checks that differ from last time. "Who sent it" depends on matching an email address to a firm, which AUGUR doesn't do.

*Principles.* Explain, never hide: strong (comments and other sheets are named). Calm: ticks deposit once; nothing refused means nothing lit.

*Needs.* File inspection for hidden lines, comments and formulas; the original kept in Artifacts; a personal-data scan.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V5: Decided by the file
*Idea.* The bench reads what the file settles by itself and shows the evidence, then asks only what would change what lands. Settled: dates like 01/10/2026 are day first (6 of 14 only make sense day first, 0 month first); dates with no year are 2026; five-digit numbers in Date are the spreadsheet's day numbers (`46297` is 2 Oct 2026); odometers are miles (one says `mi`, none say km); line 18 is the same visit as line 17. Each has "Not so". Asked: what was the loan van (set aside and ask Mo, a van with no number, not a visit), and what to do with Type, which Data Atlas has no detail for (ask Lena Ortiz for "kind of visit", keep it in the note, leave it out). Each answer shows its effect on what lands.

*Sources.* The reference interview; "ask only what changes" (reference desk run); Wrangler's predictive interaction (the system proposes, the person picks).

*What works.* It is the honest version of "auto-detect": the bench says *why* it is sure, so a wrong guess is easy to catch. Two questions for 26 lines. The rule "a question whose answer is already in the file wastes a person's time" belongs in docs/app-patterns.md. Each reading is written into the recipe, so next month's file must agree with it, which is how the rerun later catches a change of date format.

*What fails or risks.* "The file decides" only when it does: a file with every day ≤ 12 can't settle day-first, and the bench must then ask. The evidence lines are dense. "Not so" on five readings is five ways to get it wrong; they should be rarer to reach than the questions.

*Principles.* Explain, never hide: strong. Calm: the open question is the only lit pane. Ask only what changes.

*Needs.* Evidence-carrying detection (each reading with the values that settled it).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V6: Tasting spoons
*Idea.* Not the first twenty lines, but the fewest lines that show every shape in the file. A greedy cover picks seven lines; each shows which of its values are the first of their shape (lit) and how many other lines are like it. A bar counts shapes covered (25 of 34). What no spoon shows is listed by name ("Depot 'Harbor store'", "Odometer like 30 112"), never hidden.

*Sources.* A chef tasting every pot; stratified sampling; test-case minimisation.

*What works.* It picks the examples tidying-by-example needs: line 6 (`nv 03 · Nth Depot · 2026-10-02 · PASS`) carries five new shapes at once. "Honest about what it skipped" is the right habit for any sample.

*What fails or risks.* On a 26-line file the first twenty already show every shape, so the argument is weak here and strong only on long files; the page says so. "Shape" is an abstract idea for an operator. Seven spoons is an arbitrary number.

*Principles.* Explain, never hide: good (the uncovered list). Calm: spoons deposit once.

*Needs.* Nothing beyond the profiler.

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 5 · Fit 4

---

## Ranked
1. **V1 In plain words**, with the sheet beside it.
2. **V5 Decided by the file**: settle what the evidence settles, ask the rest.
3. **V4 Goods in**: keep "its own count", the receipt and the people's-names check.
4. **V2 Column shelf**, as the second view of V1.
5. **V6 Tasting spoons**, as the source of examples for tidying.
6. **V3 X-ray**, for very long files only.

**What I'd build first:** V1's paragraph and lit cells as the landing view, with V5's settled readings (each with its evidence and "Not so") under it, and V4's "its own count" check folded in. The original file goes to Artifacts on arrival, so provenance starts at the door. The two questions from V5 are the first calls of the tidy stage, not a separate step.

## Needs token
New: `--x-proposed-xr-w` (V3). Uses the run's raw, seam, aside and stop tokens (see grammar notes). Relies on `--font-mono` for raw values.
