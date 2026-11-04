# Surface 1 · Kitchen sheet (grammar)

**The moment:** Ade Mensah, fleet administrator for Fleet and Facilities (Department floor), gets a spreadsheet from Mo Ridley at Kestrel Fleet Services every month: the inspections Kestrel did on the organisation's vans. October's file is a real mess: a merged title, two blank lines, an exact copy of one line, van numbers written five ways (`nv 03`, `NV05`, `wf 03`), dates in four shapes (day/month/year, year-month-day, "3 Oct", and spreadsheet day numbers like `46302`), ten spellings of three depots, results like `Pass - advisory: tyres` and `Fail – lights`, odometers like `12400 mi` and `c.12k`, a loan van with no number, and a TOTAL line that says "25 visits". The grammar sheets name the words the bench uses for all of it before any surface is designed.

**Shared data, one object (`DATA`) per page:** the whole run uses one sample (`_src/data.js`): the October and November files line by line, the 31 vans, 3 depots and 1 firm Data Atlas already keeps, the inspection kind and its details, the recipe Ade saved, and the two answers Ade gives in December. Every count on every page comes from running that recipe over those lines with the engine in `_src/lib.js` (it really parses the dates, groups the spellings and reads the odometers), so the pages can't disagree. October: 32 lines, 26 lines of visits, 24 land as inspections, 1 line set aside (the loan van), 1 exact copy, 1 odometer value set aside, 1 new van (WF-09), 21 odometers change. 25 = 24 + 1, which matches the file's own TOTAL.

**Files:** every surface's `v*.html` is built by `_src/build.py` (at the run's root) from `_src/common.css`, `_src/data.js`, `_src/lib.js` and `<surface>/_src/v*.src.html`. Keys on every page: **R** replays, **T** shows the admin words (two registers: the transform each line compiles to). Pages that touch the model add **G** (model gateway off).

**Words the run settled on (as people see them):** *bring in* (the bench in Data Atlas), *the file* (the ingredient; never changed), *tidy* (prep), *the recipe* and its *lines*, *the pass* (the check before Triage), *what lands* (the plate: proposals to Triage), *set aside* (didn't fit; kept, counted, with a reason), *stop* (the line can't go on without a person), *heard* (the recipe wrote down your answer). "Transform", "ETL", "pipeline" and "schema" never appear above the T line.

---

## V1: The station line
*Idea.* The five kitchen words as five stations left to right (ingredient, prep, recipe, pass, plate) with *set aside* as a tray **under** the line, never beside it. One line of the file (line 6: `nv 03 · Nth Depot · 2026-10-02 · PASS`) travels through the stations and changes form at each: raw cells, then pairs (raw → kept), then the recipe line numbers that touched each value, then the pass's check, then the inspection card that lands. The loan van line drops into the tray with its reason and still counts at the pass (25 = 24 + 1). Each station also says what it borrows from the kitchen and the one thing it never does ("never edit the file itself", "never send what wasn't previewed").

*Sources.* Escoffier's brigade and the station (*partie*) system; line-side stations on an assembly line; the light language (the station lights as the line passes, once).

*What works.* It is the clearest single picture of the whole job, and the "never" lines turn into product rules almost word for word. Putting the tray under the line says "not off the line" without words. The counts at each station already balance against each other.

*What fails or risks.* It is a poster, not a screen: nobody works in five columns. The ticket shapes differ per station, so the eye has to re-learn each. At 1280×800 the station text gets small.

*Principles.* Explain, never hide: strong (the tray is in view and counted). Calm: one pass of light, then still. Focus stacking: the lit station is the near plane. No letterbox.

*Needs.* Nothing new beyond the run's marks.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V2: The recipe card
*Idea.* The recipe as a recipe card (makes 24 inspections, sets aside 2 lines and 1 value, ingredients are the file's columns, method is 12 numbered lines) next to one line taken apart into its **eight parts**: number, one verb first, the column by name, the example it was taught, how many on this file, what it does with misfits, who taught it and how, and turn off / undo / teach again. ↑↓ walks the lines. A small panel shows the *same* line on next month's file stopping with "can't find Reg", which is why part 3 matters.

*Sources.* Recipe cards (yield, ingredients, method); Power Query's applied steps (each step named and selectable); knitting patterns (abbreviations defined once, then every row in the same format).

*What works.* "One verb, one column, one example, one count, one rule for misfits" is the format rule the rest of the run uses; it came out of this sheet. Naming the column as the file names it is what makes a rerun able to stop honestly. A line that is turned off stays, struck through, so the next person sees it was tried.

*What fails or risks.* Twelve lines is fine; a forty-line recipe needs grouping (prep, match, make). The anatomy callouts are teaching furniture, not product. "Teach again" is a promise that needs the by-example engine to remember its examples.

*Principles.* Explain, never hide: strong. Calm: still. No letterbox or focus stacking.

*Needs.* A recipe store with versions and per-line provenance ("taught by example by Ade, 3 Nov").

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V3: Marks on a value
*Idea.* A specimen sheet of the twelve marks a value can carry between the file and Triage, each with a real example from Kestrel's files: raw, kept, seam, pencil, set aside (line), set aside (value), stop, new, matched, merged, left out, word asked for. Three rules underneath: only a stop glows; set aside is a place, not a bin; raw is never lost.

*Sources.* Type specimen sheets; conservators' visible repair marks (the seam); the catalogue run's six ways to be empty (corner ticks for "not known yet"); the reference desk's pencil and ink.

*What works.* **Raw is typewriter, kept is set type** is the most useful single decision of the grammar: `nv 03` in mono on a ruled ground, `NV-03` in Jost with a dotted seam. Every later surface uses it and nobody needs a legend. Only the stop uses light, so a bench with nothing stopped is dark.

*What fails or risks.* Twelve marks is a lot; in practice people meet five (raw, kept, seam, set aside, stop). "Pencil" here covers both a rule's suggestion and a model's, which the mapping surface later splits. The stop mark is warning-coloured: it must not be read as an error.

*Principles.* Explain, never hide: every empty-looking value says which kind. Calm: only the stop glows. Time is matter: history (seam, merged) is ink.

*Needs token.* `--x-proposed-raw-ground`, `--x-proposed-seam`, `--x-proposed-aside-edge`, `--x-proposed-aside-wash`, `--x-proposed-stop`, `--x-proposed-stop-wash`.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 5

## V4: Calls and "heard"
*Idea.* The interaction grammar as call and response. The bench **calls** only when a guess would change what lands ("Line 23, `Spare/loan`, isn't a van number. Set it aside, or which van was it?"). The person answers. The recipe says **heard** by writing a numbered line ("heard · recipe line 6: write van numbers in Reg like NV-03"). Every call offers the other answers and who else could give one (Mo Ridley at Kestrel; Lena Ortiz, the Data Atlas admin who decides new words). The brigade down the side: Ade at the bench, the recipe, Priya Nair at Triage (the pass), Lena (new words), Mo (the supplier).

*Sources.* The kitchen's call and "heard" (orders called at the pass, acknowledged by the line); jidoka (stop and ask, never guess); the reference desk's "ask only what changes".

*What works.* Six calls for 26 lines: the count is the argument. "Heard" fixes a real problem in by-example tools: you answered something, but where did your answer go? Here it always names the line. The roles make it clear that Ade never decides what is kept; Priya does, at Triage.

*What fails or risks.* A transcript is the wrong main view; it reads like a chat. It is better as the history of a recipe ("how was this taught?") than as the working surface. Over a day of files, "heard" would be noise if it were animated; it must be a quiet word.

*Principles.* Explain, never hide: strong (other answers are always listed). Calm: the open call is the only lit item. Turn-taking from the room tone run.

*Needs.* Calls as data (the engine knows when a guess would change what lands).

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V5: The life of one value
*Idea.* Follow `nv 03` from cell A6 to the record it helped make, seven stages: in the file (kept untouched as document D-2291 in Artifacts), recipe line 6 wrote it `NV-03`, line 11 matched it to the van Data Atlas keeps, the pass, Triage T-0583 accepted by Priya, kept with its seam, and a month later the recipe moves to version 2 and this value keeps "made by version 1". Beside it, what the record keeps about this one value: was, from (document, sheet, cell), made by (recipe, version, line), run, kept by (Triage). T shows the W3C PROV terms.

*Sources.* Archival provenance and chain of custody; W3C PROV (`wasDerivedFrom`, `wasGeneratedBy`, `used`, `wasAttributedTo`); the wear-and-time run (visible repair, one seam per value).

*What works.* It answers the prompt's third question directly: **record provenance per value, not per record** (document + cell, recipe id + version + line, run, Triage decision). The December stage shows the right rule for recipe changes: values made by an older version keep their version and are not quietly remade.

*What fails or risks.* Storing five references per value is heavy: 24 inspections × 6 details × 5 references. It should be stored per run and per line (one "run 1 used R-0007 v1" row, and one cell reference per value), not repeated. A seven-stage timeline is too much for daily use; it belongs behind "why, and since when?" on a value.

*Principles.* Explain, never hide: strong. History as a material, visible repair. Calm.

*Needs.* Data Atlas observations to carry a recipe-run reference and a cell reference; the original file kept in Artifacts.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 5

## V6: Wordless steps
*Idea.* The twelve lines as a flat-pack sheet: each a tiny before → after picture of cells, with the tray when something is set aside, and a number (the count on this file) in the corner, as IKEA counts parts. W shows the words.

*Sources.* IKEA's wordless assembly instructions (pictures plus counts); knitting charts (symbols per stitch, a key once).

*What works.* Order, before and after, and "misfits go to the tray" read without words. As a small icon per recipe line it would help scanning a long recipe.

*What fails or risks.* It can't say which column, which example, or why a value didn't fit; lines 7 and 8 draw almost the same. A gimmick on its own. Needs its own token for a pictogram cell.

*Principles.* Explain, never hide: weak (the why is missing). Calm.

*Needs token.* `--x-proposed-pict-w`, `--x-proposed-pict-h`.

*Scores.* Clarity 2 · Distinctiveness 4 · Feasibility 4 · Fit 3

---

## Ranked
1. **V3 Marks** — raw typewriter, kept set type, seam, set aside, stop: the visual grammar everything else uses.
2. **V2 Recipe card** — the eight-part line and the format rule.
3. **V5 Life of a value** — the provenance answer (per value: document, cell, recipe, version, line, run).
4. **V4 Calls and heard** — keep "heard" and "call only when a guess would change what lands".
5. **V1 Station line** — the teaching poster, and its "never" rules.
6. **V6 Wordless** — only as line icons.

**What I'd build first:** the marks from V3 as kit parts (a raw value, a kept value with its seam, a set-aside tray, a stop), and the eight-part recipe line from V2 as the one shape every step takes. They are cheap, they carry the whole idea, and they make the later surfaces consistent. V5's provenance record is the data decision that has to be taken before Triage gets anything from a recipe.

## Needs token
New this run: `--x-proposed-raw-ground` (ruled ground for raw values), `--x-proposed-seam` (the dotted seam under a kept value and the ring of a recipe line number), `--x-proposed-aside-edge` and `--x-proposed-aside-wash` (the tray), `--x-proposed-stop` and `--x-proposed-stop-wash` (jidoka stop), `--x-proposed-pass-edge`, `--x-proposed-pict-w` and `--x-proposed-pict-h` (V6).
Carried: `--x-proposed-gap-ink`, `--x-proposed-unseen`, `--x-proposed-disagree`, `--x-proposed-disagree-wash`, `--x-proposed-quiet`, `--x-proposed-type-micro`, `--x-proposed-lit`, `--x-proposed-lit-wash`, `--x-proposed-pencil`, `--x-proposed-pencil-wash`.
Every variant relies on `--font-mono` (IBM Plex Mono) for raw values, which still needs an ADR. Raw-in-mono is load-bearing here, so this run adds weight to that ADR.
