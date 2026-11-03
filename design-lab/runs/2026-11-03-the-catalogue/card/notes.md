# Surface 3: The record card

One entity showing every detail its kind could hold. Each detail is either filled or drawn as a gap that says who could fill it. Sources show as references (a document in Artifacts or a person), disagreements sit side by side, and Used by lists intents and documents.

All six prototypes share one sample object, `DATA`, at the top of the script, which `_src/build.py` inlines from `_src/common.js`. The sample deployment is a regional services org: sites, contracts, organisations, people, vehicles and incidents. **K** switches to a record of a different kind (a Site, then a Contract), and every variant redraws from that kind's ontology entry. No layout knows the name of a detail: box widths, field marks, comb shapes and sentence order all come from the detail's `type`, `key`, `many`, `fill`, `reach` and `say` fields and from the kind's `groups`.

States drawn on every variant, using the same CSS marks (`_src/common.css`):

| State | Plain words | Technical, one step down | Mark |
|---|---|---|---|
| filled | (the value) + where it came from | fact backed by observations | plain ink, source as reference |
| gap | Not known yet · *who* could fill this | expected (minCount 1), no assertion | dashed open box, never hatched, with the filler's name |
| disagree | Sources disagree | ≥2 conflicting observations, no fact | warning-tinted pair, side by side |
| withdrawn | Source withdrawn, no longer counts | retracted observation (`folio.document.withdrawn`) | struck through, muted danger tag |
| reach | Kept on *floor* · ask *who* | kept on another workspace, or restricted (403 `kept`) | lock and a sentence, no value |

**Gap versus wear and time's "no record"** (shortlist question): these are different marks. A gap is a detail the kind expects and nobody has said yet. It has an owner and a next step, so it is drawn as an empty box with a dashed edge, open and waiting for an answer. "No record" means the system lost a stretch of time, nobody can fill it, and it keeps the stale hatch. If both used the hatch, operators would read "nobody can fix this" on every gap.

---

### V1: Catalogue card
**Idea.** The record is a library unit card in a drawer. The call mark sits in the left margin (kind, region, floor, year), every detail gets a ruled line in the kind's order, and the links appear as numbered tracings (I., II., …). Sources are footnoted with superscript numbers. Used by is the pocket slip tucked behind the card. An empty ruled line carries a pencilled note saying who could fill it. Enter opens an index note over the slip.
**Sources.** Library unit cards (3×5 in, the punched rod hole); ISBD punctuation and tracings; Dewey and UDC call marks; circulation slips.
**What works.** Every record of a kind really does have one fixed shape, so an operator learns where "Address" lives once. The superscript references are the lightest way of citing sources of anything here. The tracings make links feel like part of the card, not a separate graph.
**What fails or risks.** Footnote numbers make people look down and back, so for a detail with two sources the eye jumps twice. The call mark is charming but means little to anyone who has never used a library, and it is invented from data that may not be meaningful in every deployment. The drawer and the stack of card edges are mild skeuomorphism that costs vertical space.
**Principles.** Explain-never-hide: strong (the gap line, lock line and withdrawn source are all present). Calm: yes, nothing moves at rest. Focus stacking: none. The index note is a plain overlay. Letterbox: not relevant.
**Needs.** `--x-rule`, `--x-margin`, `--x-slip-w`; a call-mark rule per deployment (which facets make the mark) that Data Atlas doesn't have.
**New employee test.** Mostly passes. The lines read at once, but "I. Run by" and the superscripts need a second look.
**Word pairs.** Kind of thing / class; Detail / datatype property; Links / object properties (tracings); Sources / observations; Not known yet / no assertion.
**Score.** Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4 (**15**)

### V2: Statements in plain words
**Idea.** The record is a Wikidata item page written as sentences: "It is run by **Corvane Facilities Ltd**." The qualifiers and references sit on one small line under each sentence. A gap is a sentence with its missing word drawn as a box (a cloze test): "Its fire risk was last checked on [ ]." Disagreement forks the sentence into two side-by-side answers, each with its source. **T** shows each statement as a triple (`ent_… vrs:floor_area "2400"`) under the sentence, which is exactly one step down. Enter opens "Finish this sentence" with Propose and Ask.
**Sources.** Wikidata item pages (statements, qualifiers, references, ranks); cloze tests; Wikipedia infobox prose.
**What works.** This is the one an operator reads fastest. A sentence needs no column headers, and the blank in a sentence is the most self-explaining gap mark here, because the sentence already says what is missing. The triple view under each sentence teaches admins and operators the mapping without a separate page. Used by is in sentences too ("reads its energy rating and floor area").
**What fails or risks.** It needs a sentence template (`say`) per detail, which the ontology doesn't have, and admins must write and translate them. Sentences cost about 1.6 times the height of a table row: 18 details need scrolling at 1280×800. Repeating "It is …" gets monotonous on kinds with 40 details, so groups must stay short. Some values don't fit inside a sentence ("It serves as a vehicle depot and stores" only reads well because the sample value is lower-case).
**Principles.** Explain-never-hide: strongest of the six, because every state is a sentence that explains itself. Calm: yes. Focus: the selected statement is lifted (raised surface) with no blur, which suits a table-like read (wear and time warned that blur fights comparison). Letterbox: no.
**Needs.** `--x-side`, `--x-blank`; **`say` per detail in the ontology** (sentence template, with the value slot); per-language templates later.
**New employee test.** Passes cleanly. Nothing on the page needs explaining.
**Word pairs.** Statement / triple; Said / asserted; Accepted / fact; Sources disagree / conflicting observations; Not known yet / expected, no assertion; Used by / Mandate binding.
**Score.** Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4 (**17**)

### V3: Field guide account
**Idea.** The record is a species account. On the left is a plate: the kind's emblem with numbered field marks (the identity keys first, then the firmest details) and a small "found with" constellation of its links, where an unfilled link is a dashed node. On the right is dense run-in prose under the kind's group headings. A disagreement is "reports differ", like a size range. A **Status** scale (Barely, Sparse, Patchy, Well known, Complete) works like a conservation status. **Observers wanted** lists the gaps with who could fill them, Records lists each source with how many details it backs, and Similar records lists possible duplicates.
**Sources.** Collins Bird Guide and Peterson field guides (plates, field marks, "similar species"); IUCN Red List status scale; biological records centres ("records by observer").
**What works.** "Observers wanted" is a strong frame for gaps: it makes them an invitation, not a failure. Records with counts ("Asset register: 6") show at a glance which source the record leans on. Similar records puts Triage's possible matches where people actually look. The Status word is more humane than a percentage.
**What fails or risks.** Run-in prose is the slowest to scan for one value: finding "Vehicle spaces" means reading a paragraph. The plate's field marks repeat what the prose says, so it is half decoration on a kind without a natural picture. The constellation gets crowded past about 8 links. This is the most distinctive variant and the least practical one for daily work.
**Principles.** Explain-never-hide: good. Calm: yes. Light: the "observers wanted" box takes a beacon-like lit ring once, during the demo, as "needs you". It should only stay lit when an intent waits on a gap. Focus: none.
**Needs.** `--x-plate`; a per-kind status rule (thresholds); duplicates from Triage (`also`); per-source counts (derivable today).
**New employee test.** Partial. The Status words and "Observers wanted" read at once, but finding one detail in the prose is slow.
**Word pairs.** Field marks / identity keys + key details; Found with / links; Records / observations by source; Reports differ / conflicting observations; Status / completeness against expected details.
**Score.** Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 3 (**14**)

### V4: Specimen label and determination slips
**Idea.** The record is a herbarium label: fixed ruled boxes whose widths come from each detail's type, with the record number as the last box. Disagreements and withdrawn readings appear as **determination slips** pinned beneath the label, oldest first and newest on top, and are never removed, as museums do when a specimen is re-identified. The right side is a museum object record in plain words: Provenance (kept on, added, possible duplicates), Condition (a bar of the record's states and the wanted details), Associations (links), On loan to (Used by) and References.
**Sources.** Herbarium sheets and annotation labels ("det." slips); museum object records (SPECTRUM: provenance, condition, loans, references).
**What works.** The slip stack is the clearest picture of *history in a disagreement*: you can see the 2019 lease said 2,400, the 2025 survey said 2,650, and the newer one sits on top. "Added, never removed" says Data Atlas's rule (observations are never changed) in four words. "On loan to" is a memorable word for Used by. The Condition bar works as a glanceable summary.
**What fails or risks.** The label pushes the actual disagreement off the box ("see 2 slips"), so people look away to read it. The slight tilt of each slip is a gimmick that stops being useful by day two. Museum words ("provenance", "on loan") are themselves a little technical for operators, so they are headings here with the plain term beside them. Long text boxes wrap and make rows uneven.
**Principles.** Explain-never-hide: good. Calm: slips settle once, nothing loops. Focus: none. Letterbox: no.
**Needs.** `--x-tilt`; observation history ordered by `observedAt` (exists); a condition summary per record.
**New employee test.** Passes for the label. The slips need one sentence of explanation, and the page gives it.
**Word pairs.** Label / entity; Determination slip / observation; Added, never removed / immutable observations; Provenance / owning workspace and history; On loan to / Mandate bindings; Condition / completeness.
**Score.** Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 3 (**14**)

### V5: The honest form
**Idea.** The record is a paper form, and every box the kind expects is drawn. An empty box **keeps the shape of the answer it expects**: a date gap is comb cells (DD MM YYYY), a rating is letter cells (A to G), a count or measure is digit cells, and a missing link is a slot reading "pick an organisation" with the kind's icon. Under each empty box is the person who could fill it and any intent waiting on it. **N** jumps to the next empty box, which opens "I know this / From a document / Ask …". **E** folds the filled boxes away to leave only the gaps. A "for office use" margin gives every box a numbered tick in its state, and lists Relied on by and Attached.
**Sources.** Paper forms (tax returns, customs declarations), comb fields, office-use margins; Isotype's habit of making the shape of a quantity visible.
**What works.** The typed blank is the best gap mark of the run: an operator sees *what kind* of answer is missing (a date, a grade, an organisation) before reading a word, and it can't be mistaken for "no data". The office-use ticks give an 18-box record a one-glance state map. "Next empty box" turns the card into a to-do without a separate task list. "From a document" ties a gap to Artifacts as the expected source.
**What fails or risks.** A form says "fill me in" even to people who can't, so the buttons must read as *propose* (Triage), never *edit*. The page says so, but the visual language of a form is strong. Comb cells for free text don't work, so text falls back to a dashed line. Two columns of boxes need scrolling at 1280×800.
**Principles.** Explain-never-hide: strong. Calm: one box lifts on demo, nothing else moves. Focus: lift, no blur. Letterbox: no.
**Needs.** `--x-cell`, `--x-margin-w`; the detail's **type and format** in the ontology (date, band with its allowed values, count, unit), most of which OWL datatypes already give; `fill` (who fills it) per detail.
**New employee test.** Passes. The fastest of the six at answering "what's missing here and what kind of thing is it".
**Word pairs.** Box / detail; Empty box / expected, no assertion; I know this / observation with a person as source; From a document / observation from an Artifacts document; Relied on by / Mandate binding.
**Score.** Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4 (**16**)

### V6: A card with a back
**Idea.** One card with two faces, opened like a folded card. The **front**, for operators, is plain words: detail, value, state. **B** turns it over and the **back** opens beside it, row for row: property, range (`xsd:date`, `→ Organisation`), cardinality, and assertions (`2 obs ⟂ · no fact`, `0 · expected (minCount 1)`, `kept: team · 403`). The two faces scroll together, so a row always faces its row. The back's footer names the events behind Used by (`mandate.intent.entity-bound`, `folio.document.withdrawn`). Anyone may turn the card over, because the ontology is readable by all. **A** switches viewer: as an operator, "Change this kind" is shown disabled with the reason and the admin's name. As an admin, it opens the studio and exports OWL.
**Sources.** Museum catalogue cards with accession data on the reverse; index cards; OWL and SHACL as the back's vocabulary.
**What works.** It answers the brief's "technical names one step down" literally and spatially: plain words never share a line with `vrs:fire_risk_assessed_on`, but the mapping is one key away and row-aligned. It is the best teaching tool for admins and the best bridge between the studio and the record. It is also the cheapest to build, because the back is a second renderer over the same rows.
**What fails or risks.** On its own the front is a plain table, so it adds nothing to how operators read data. Its value is all in the back. Rows aligned across two faces break if one side wraps, so rows are clipped with an ellipsis and long IRIs truncate. The page-turn is a nice moment the first time and must stay on demand (B), never automatic in the product.
**Principles.** Explain-never-hide: strongest for governance (the disabled control names who can change it). Calm: the turn happens only on B. Focus: row highlight on both faces. Letterbox: no.
**Needs.** `--x-row`, `--x-perspective`; cardinality and "expected" per detail (SHACL-style `minCount`); ontology version and pack per kind (exists in `/ontology`).
**New employee test.** The front passes. The back isn't meant for operators, but it says so ("Only Data Atlas admins can change the back. Ask Jo Reyes.").
**Word pairs.** Front / back; Kind / class (`cco:Facility`); Detail / property; What it holds / range; Expected / minCount 1; Accepted / fact; Read from / observation source.
**Score.** Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4 (**16**)

---

## Ranked
1. **V2 Statements in plain words** (17): reads fastest, and the blank in a sentence explains itself.
2. **V5 The honest form** (16): the typed blank (comb cells, slots) is the best gap mark, and "next empty box" is the best gap workflow.
3. **V6 A card with a back** (16): the right home for technical names. Cheap, and it fits governance.
4. **V1 Catalogue card** (15): one fixed shape, light references. Solid but familiar.
5. **V4 Specimen label** (14): determination slips are the best picture of a disagreement's history. Keep that one idea.
6. **V3 Field guide** (14): keep "Observers wanted", Status words and Records-by-source. Drop the plate.

## What I'd build first
A Quill `RecordCard` with V2's statement rows as the default read: one sentence per detail, from a new `say` template on each detail in the ontology, falling back to "Detail: value" where none is written yet. Its gaps would use **V5's typed blank** inside the sentence: comb cells for a date, letter cells for a band, a kind slot for a link. Each gap would carry the filler's name and the intent that waits on it, with **N** for the next empty one. Disagreement would be V2's side-by-side fork, with V4's "added, never removed" order (oldest beneath) when more than two observations exist. The technical names live on **V6's back**, a toggle that renders the same rows with property, range, cardinality and assertions, which anyone may read and only admins may change. Beyond the ask, I'd also add V3's per-source Records counts and the Status word to the header, because they answer "can I trust this record?" in one glance.

## What Data Atlas would need (that it doesn't give today)
- **Expected details per kind** (a minCount or "expected" flag). Without it a gap can't be drawn, only an absence.
- **Who fills each detail** (a team, role or person per detail per floor), so a gap names someone.
- **A sentence template (`say`) per detail**, and **groups and order** per kind, written by admins in the studio.
- **Value format per detail** (date, band with allowed values, count, unit) to draw the typed blank. OWL datatypes cover most of it.
- **Detail-level Used by**: Mandate binds an intent to an entity with a role, not to a detail, so "waits on the fire risk check" needs the role mapped to details.
- **Restricted details** that say they exist without showing their value (`reach.restricted`), as distinct from "kept on a floor below".

## Proposed tokens (all `--x-*`, combinations of kit tokens)
Shared: `--x-type-micro` (also proposed by wear and time), `--x-gap-ink`, `--x-gap-fill` (the **gap mark**, distinct from the stale hatch), `--x-disagree`, `--x-withdrawn`, `--x-kept` (set from the record's floor). V1: `--x-rule`, `--x-margin`, `--x-slip-w`. V2: `--x-side`, `--x-blank`. V3: `--x-plate`. V4: `--x-tilt`. V5: `--x-cell`, `--x-margin-w`. V6: `--x-row`, `--x-perspective`. Every variant relies on `--font-mono` (IBM Plex Mono, still needs an ADR).
