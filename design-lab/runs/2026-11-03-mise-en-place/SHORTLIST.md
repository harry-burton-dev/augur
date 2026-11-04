# Shortlist: mise en place

Ranked by what I'd build first. The headline: **an operator can turn a messy file into Triage proposals without knowing what ETL is, if the recipe stops instead of guessing and nothing the file holds leaves the count.** The person fixes one value; the bench proposes the rule, shows what it would change and what it can't read, and writes it down as a numbered line. Next month the same lines run on their own up to the pass, and only what is new asks for anyone.

| # | Build | Look at | Why it ranks here |
|---|---|---|---|
| 1 | **Raw and kept, and the recipe line**: a value as it came is typewriter on a ruled ground; as it is kept, plain type with a dotted seam and the number of the line that made it. Every line has the same parts: one verb, the column by name, the example it was taught, the count on this file, what it does with misfits, who taught it | [Marks](grammar/v3-marks.html), [Recipe card](grammar/v2-recipe-card.html), [The recipe writes itself](by-example/v5-recipe-writes-itself.html) | Every other screen uses these. Naming the column is what lets next month's file stop with "can't find Reg" instead of reading the wrong column. |
| 2 | **The bench: tidy by example, stop, don't guess**: fix one value; three readings appear beside it with what each would change and what it can't read (its residue), previewed in pencil; using one writes a line. The first value a line can't read stops it, with the row's own context and the other answers; the answer is written into the line ("heard") | [The bench](combined/v2-the-bench.html), [Three readings](by-example/v1-suggestions.html), [Stop the line](by-example/v6-stop-the-line.html) | 26 lines of visits, six questions. The residue ("1 can't be read this way: it will stop and ask") is what makes the right reading obvious. |
| 3 | **Map by sentence, weigh only what has no exact match**: "Each line is an inspection of a [van] at a [depot] on [inspected on]…", read back for a real line; exact matches go through in ink; the one with no exact match is weighed field by field with evidence; a column with no place becomes a word asked of an admin, its values kept in the note meanwhile | [In a sentence](mapping/v1-in-a-sentence.html), [Near matches](mapping/v3-near-matches.html), [The gap in the tree](mapping/v5-the-gap-in-the-tree.html) | 22 of 23 vans match exactly; WF-09 is weighed against WF-08 ("an odometer doesn't go back 26,388 miles") and proposed as new with that reason. |
| 4 | **The pass, and it balances**: one rail of what will be made, changed and linked, and what is set aside, not brought in or waiting; a balance against the file's own TOTAL (25 = 24 + 1); a taste of every plate an answer touched plus three at random; sent to Triage as one bundle that the decider sees exactly as the sender did | [The pass at both ends](combined/v3-the-pass-at-both-ends.html), [Ticket rail](pass/v1-ticket-rail.html), [It balances](pass/v2-balance.html), [Two keys](pass/v5-two-keys.html) | "Nothing silently dropped" is only believable when the count closes. The file's TOTAL is a free cross-foot; here it also explains the duplicate. |
| 5 | **Rehearsed to the pass, then only what's new**: a saved recipe runs when its file arrives, up to the pass and never past it. Lines that run as before stay quiet; only a stop reaches "Needs you". Opening it shows only the exceptions, each with its evidence and a suggested answer; stops with one cause are grouped | [Rehearsed to the pass](next-month/v6-rehearsed-to-the-pass.html), [Only what's new](next-month/v4-only-whats-new.html), [Andon board](next-month/v3-andon-board.html), [Combined V1, stages 7–9](combined/v1-drop-to-triage-and-a-month-later.html) | November: 8 of 12 lines as before, two answers, done. A normal month makes no noise at all. |
| 6 | **Every answer is a line; the recipe changes, not the data**: an answer to a stop becomes a new recipe version with its reason. Values keep the version that made them; nothing is quietly remade. On the record, every value says why, and since when: was, from (document and cell), made by (recipe, version, line), run, hand, kept by | [The pattern changes](next-month/v5-the-pattern-changes.html), [Why, and since when](combined/v4-why-and-since-when.html), [Life of a value](grammar/v5-life-of-a-value.html) | It is the answer to the prompt's provenance question, and it makes a late answer from the tray (NV-06's odometer, typed from a job card) a visible repair rather than an edit. |

**Worth keeping as options:**
- [Decided by the file](bring-in/v5-decided-by-the-file.html): settle what the evidence settles (day-first dates, spreadsheet day numbers), show the evidence, ask the rest. It belongs inside the first look.
- [Goods in](bring-in/v4-goods-in.html): "its own count agrees", the receipt, and the people's-names check.
- [Tasting spoons](bring-in/v6-tasting-spoons.html): the fewest lines that show every shape, as the source of examples on long files.
- [Month over month](next-month/v2-month-over-month.html): the evidence behind "Reg was renamed Vehicle" (same shapes).
- [Ink and pencil](mapping/v6-ink-and-pencil.html): the model proposes links between lines from their notes, never codes.
- [Before and after](pass/v3-before-and-after.html) and [What it moves](pass/v6-what-it-moves.html) as tabs on the pass.
- [Plated](mapping/v4-plated.html), as the read-back under the mapping sentence.

**Not worth pursuing:**
- [The x-ray](bring-in/v3-x-ray.html), except for very long files.
- [Bowls by shape](by-example/v4-shape-bowls.html): charming, and the same as reading 1 in one click.
- [Wordless steps](grammar/v6-wordless.html) on their own (keep only as line icons).
- [Two shelves](mapping/v2-two-shelves.html) as the default mapping view (under T for admins at most).
- [The station line](grammar/v1-station-line.html) as a screen; keep its "never" rules.

**Answers to the prompt's questions:**
- *Where does this live?* **In Data Atlas, as "Bring in", next to Triage.** Everything it makes is a Triage proposal, matching needs Data Atlas's matchers (keys, names, spelling; meaning with the gateway), and a column with no place is a request to Data Atlas's own studio. Its own platform app would duplicate Triage and the ontology and invite a second way in, which breaks "nothing skips Triage". The pieces around it:
  - the source file is kept as it came in **Artifacts** (a document in a library), so withdrawal already means "what was read from it stays, marked, and stops counting";
  - recipe runs, including runs on arrival, go on the **jobs engine** (DBOS through the service kit, ADR 0027);
  - stops reach people through **Home** and the notifications contract, never as toasts;
  - the marks (raw value, kept value with seam, set-aside tray, stop, recipe line) become **Quill kit parts once a second app needs them** (an Artifacts metadata import, a Mandate bulk intent load). Until then they stay in Data Atlas.
- *Which established open-source tools could do the transforms, and what must AUGUR own?* Each needs an ADR; none has been checked against current versions in this run (no network).
  - **Transform engine:** DuckDB (MIT), in-process, with a CSV sniffer, `strptime` with several formats, regular expressions, and spreadsheet reading through its excel extension. Recipe lines compile to SQL (the T line on every page is that compilation, in words). Air-gapped deployments (ADR 0023) need the extension bundled rather than downloaded at run time. The alternative with no new dependency: compile to Postgres SQL inside Data Atlas's own schema, plus a spreadsheet reader (ExcelJS, MIT). I'd pick DuckDB for the bench and keep Postgres as the place results land.
  - **Clustering and matching:** OpenRefine's methods (fingerprint keys, n-gram keys, Levenshtein, metaphone) are small and documented; Postgres already gives `pg_trgm` (Data Atlas uses it) and `fuzzystrmatch` (Levenshtein, metaphone). Don't run OpenRefine itself: a Java server with its own UI.
  - **Describing what a column should hold:** Frictionless Table Schema (types, constraints, missing values) as the stored form of a column's expectations, or W3C CSV on the Web. Either is a standard Harry can point at.
  - **Provenance:** the W3C PROV-O vocabulary (it is OWL, which Data Atlas already exports) for the per-value record.
  - **AUGUR must own:** the recipe line vocabulary and its plain words; the recipe store (versions, stable line ids, examples, answers, reasons); the run record (a role for every line, the tray, the balance, the taste); stop semantics (when a guess would change what lands); the pass and its bundle into Triage; mapping to the ontology and words asked for; per-value provenance in Data Atlas; and Home entries.
- *How is a recipe recorded so the result's history can say which recipe made each value?*
  - **Recipe**: id, owner, floor, name, and versions.
  - **Version**: an ordered list of lines. Each line has a stable id under its display number, a verb, the columns it reads by name (and aliases added by answers, "Reg or Vehicle"), its parameters, the example it was taught, its rule for misfits (stop, set aside the line, set aside the value), how it was taught (example, confirmed group, written), who and when, and the reason it changed (the stop it answered).
  - **Run**: recipe id at version, the source document id in Artifacts and a hash of it, who and when, the answers given, per-line counts, a role for every line of the file, the tray, the balance, the taste and its seed, and the Triage bundle id.
  - **Value in Data Atlas**: an observation with *from* (document, sheet, cell), *made by* (the line ids that changed it, in order, at their version), *run*, *hand* (file, person, register) and *kept by* (the Triage decision). Store it per run and per line, with one cell reference per value, rather than repeating the chain on every value. In PROV terms: `wasDerivedFrom` the cell, `wasGeneratedBy` the run, `used` recipe@version, `wasAttributedTo` the person.
  - **History**: values keep the version that made them. A new version never remakes old values quietly; rerunning old files under it previews what would change first. A late answer from the tray is a seam with its own who and how ([Why, and since when](combined/v4-why-and-since-when.html)).

**Where these push back:**
- **"Show the data, not the operation" is half right.** People should fix values, not write operations. But the recipe has to be readable as operations, and some lines (skip the title, use line 3 as names, check against TOTAL) are better settled from the file's evidence than taught by example.
- **Not everything left out belongs in the tray.** Title lines, empty lines, the TOTAL and an exact copy are "not brought in, said"; a loan van with no number is "set aside". Mixing them would bury the misfits that need a person. Two lists, one balance.
- **Triage needs bundles.** A recipe run's 46 proposals balance against one file and should be kept, held and sent back as a unit, with partial holds that carry their dependants (a held van holds its inspection). Triage today is item by item.
- **Matching only sees your floor.** Data Atlas shows a floor what is kept on it and above. A Department-floor operator can't see team-kept vans and would propose duplicates. The matcher must be able to say "a match exists where you can't see; its keeper decides", without showing it.
- **Keep the kitchen out of the product.** "Recipe", "set aside" and "the pass" travel well. "Mise en place", "plate", "ticket" and "heard" stay in the lab; in the product, "heard" reads as "noted in the recipe, line 6".
- **A stop is not urgent.** It is amber and the only light on the bench, but it never uses the Letterbox and never interrupts: it waits in "Needs you".

**Decisions for Harry** (none taken):
1. Bring in lives in Data Atlas, next to Triage, rather than in its own platform app or as a kit part? I recommend Data Atlas.
2. The transform engine: DuckDB (one ADR, bundled extension for air-gapped deployments), or compile to Postgres SQL plus ExcelJS (no engine, one smaller ADR)? I recommend DuckDB.
3. Should Triage accept a run as one bundle, with partial holds that carry their dependants? I recommend yes.
4. On small deployments the operator may also be the Triage decider. Should that be allowed, with the pass saying "you are deciding your own run"? I recommend allowed and recorded.
5. Should saved recipes run on their own when a file arrives, up to the pass and never past it? If yes, how do files arrive: upload only at first, or an inbox (a new service)? I recommend yes, upload first.
6. When a near match is kept on a floor the operator can't see, may the bench say so, and may it name the floor? I recommend saying so, without the floor, naming the keeper.
7. Should Data Atlas observations carry per-value provenance (cell, recipe line, version, run)? It is the only way to answer "which recipe made this value". I recommend per run and per line, with a cell reference per value.
8. Should the model's job in Bring in stay limited to proposing links between lines from their notes, and matches by meaning, always in pencil? The gateway would get only the columns the recipe names. I recommend yes.

**Gaps:**
- **Needs token:** `--x-proposed-raw-ground`, `--x-proposed-seam`, `--x-proposed-aside-edge`, `--x-proposed-aside-wash`, `--x-proposed-stop`, `--x-proposed-stop-wash`, `--x-proposed-pass-edge`; also `--x-proposed-pict-w`, `--x-proposed-pict-h` (wordless) and `--x-proposed-xr-w` (x-ray), both not recommended. Carried from earlier runs: gap ink, unseen hatch, disagree, quiet, micro type, lit, pencil.
- Raw values in IBM Plex Mono are load-bearing here (raw versus kept is the core grammar), which adds weight to the `--font-mono` ADR.
- docs/app-patterns.md entries to write if adopted: raw and kept; a recipe line's parts; stop, don't guess; the tray versus "not brought in"; the pass balances against the source's own total.

**Data the shell doesn't have yet:**
- A recipe store (versions, stable line ids, examples, answers and their reasons) and a run store (roles, tray, balance, taste seed).
- Per-value provenance on Data Atlas observations (cell, recipe line and version, run, hand).
- Triage bundles, partial holds with dependants, and a proposal that stays open across runs (WF-09 is proposed once, not every month).
- A matcher answer for "exists where you can't see".
- A "would change" query across apps (briefings, intents, watches), and due rules (an inspection interval) as configuration.
- A way for files to arrive and a link from a file to its recipe (by sender and columns), shown and changeable.
- Words asked for that carry their waiting records, and partial rerun of the one recipe line that waited.
- A people's-names check on incoming files.
