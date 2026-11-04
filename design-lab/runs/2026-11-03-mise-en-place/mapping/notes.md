# Surface 4 · Mapping to what we keep

**The moment:** the file is tidy. Now each line has to become something Data Atlas keeps: an **inspection**, with its details (van, depot, inspected on, result, odometer, inspected by, note), linked to a **van**, a **depot** and a **firm** it already has. Near matches to things it keeps are grouped for a person to confirm, and nothing becomes new without a person saying so.

**Shared data:** the run's one sample. Data Atlas keeps 31 vans, 3 depots and the firm Kestrel Fleet Services (O-0031). After tidying, 22 of the file's 23 vans match exactly, one (WF-09) has no match, all three depots match, and one column (Type: Annual, Interim, Re-test) has no detail to go to. The model gateway, when on, proposes two links between lines (a re-test following up a failure; a loan van's note pointing at the failure that caused it). Keys: **R**, **T**, plus each page's own.

---

## V1: Each line, in a sentence
*Idea.* The mapping is a sentence with blanks: "Each line is an inspection of a [van] at a [depot] on [inspected on], [result], with [odometer] miles and a [note], by [inspected by]." Under each blank, the column that fills it (↑ Reg, ↑ Depot …) or "the same for every line". Below, the sentence read for one line ("An inspection of van NV-04 at North depot on 2 Oct 2026: failed (brakes; rear pads; rebooked 9/10), 61,402 miles on the clock, by Kestrel Fleet Services. Annual, kept in the note until 'kind of visit' exists.") with its raw cells under it. ↑↓ reads another line. Three short lists: what each blank links to, what each blank expects (and how many fit), and columns with no blank.

*Sources.* Said in a sentence (catalogue run); Query by Example (Zloof); Mad Libs.

*What works.* A non-expert can check a mapping by reading it aloud. The read-back for a real line catches mistakes a wiring diagram hides (a result that reads "failed (brakes…)" is obviously right). "The same for every line" handles the firm, which isn't in any column, without a special screen.

*What fails or risks.* Sentences get long with fifteen details; the template needs optional clauses. Changing a mapping by dragging a column onto a blank in a sentence is fiddly; the sentence is better for checking than for editing. Blank labels like "inspected on" read awkwardly in the template.

*Principles.* Explain, never hide: strong ("columns with no blank" is a list, not a silence). Calm.

*Needs.* A sentence template per kind (Data Atlas already reads kinds back as sentences in the catalogue run).

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 5

## V2: Two shelves
*Idea.* The file's columns on the left (with tidy sample values), the inspection's details on the right (with what each expects and "24 of 24 fit"), and a thread between each pair. Type's thread is dashed and goes to a dashed "kind of visit, asked for" slot; "who sent the file" threads to "inspected by". Threads draw once.

*Sources.* Schema matchers (the two-list-and-lines pattern in ETL tools); patch bays.

*What works.* It is the most familiar mapping view, and the fit counts on the right make it a check, not just wiring. The dashed thread to a slot that doesn't exist yet is a good picture of a gap.

*What fails or risks.* Threads cross (Type's line crosses three others), which is noise. It reads as a technical screen; an operator sees "wiring". Thirty columns would be spaghetti.

*Principles.* Explain, never hide: good. Calm: threads draw once.

*Needs.* Nothing new.

*Scores.* Clarity 3 · Distinctiveness 2 · Feasibility 5 · Fit 3

## V3: Near matches to confirm
*Idea.* What the file names, matched to what Data Atlas keeps. Exact matches are ink chips that need nothing (22 vans, NV-04 ×2; 3 depots with their spellings; the firm). The one van with no match, WF-09, is weighed: eight vans it keeps are one character away (WF-01 to WF-08); the last in the series, WF-08, is laid side by side with it (depot same, odometer 8,412 vs 34,800 miles, note "new to fleet", not in this file). Verdict, worked out: "Probably a different van: an odometer doesn't go back 26,388 miles." Three answers: propose a new van, it is WF-08 (a typo, with a seam), not sure (set aside and ask Mo). Choosing "new" shows exactly what Triage will get, with the verdict as its reason.

*Sources.* Record linkage (Fellegi–Sunter: weigh agreement field by field); OpenRefine's reconciliation; the reference desk's "the answer has a base".

*What works.* It only asks about the one thing with no exact match, and it asks with evidence. The odometer check is the kind of reasoning a person would do and a spelling matcher can't. The proposal carries its reason into Triage, so Priya doesn't have to redo the weighing.

*What fails or risks.* "Eight vans one character away" shows how weak spelling is for codes; the evidence fields matter more than the name. Choosing which fields to compare is per kind and needs configuration. A floor problem this sample avoids: **matching can only see what Ade can see.** If WF-08 were kept on a floor below Ade's, the bench would call WF-09 new while a match exists. Data Atlas must be able to say "a near match is kept somewhere you can't see; the Westfield crew decides" without showing it.

*Principles.* Explain, never hide: strong (and see the floor risk). Consequence preview: the Triage line. Calm.

*Needs.* Per-kind comparison fields for near matches; a "kept where you can't see" answer from Data Atlas's matcher.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V4: Plated
*Idea.* Map by looking at the plate: four of the 24 inspections as Data Atlas will show them (a failure; its re-test a week later; a new van; a reading not known yet), each as a record card of seven statements in a fixed order, with a small tag on each saying which column and which recipe line made it, and the raw line under the card. A short "why this plate" under each.

*Sources.* The pass (the head chef checks the plate, not the recipe); the catalogue run's statements for one record; product page previews.

*What works.* People check outcomes faster than rules. The re-test plate makes a real gap visible: two inspections of the same van a week apart, and nothing joins them. The missing odometer shows its kind of empty. The same seven statements in the same order on every plate is the rule that makes plates comparable.

*What fails or risks.* Four plates out of 24 is a sample; the choice of plates matters (here: one of each kind of difference). It doesn't let you change the mapping; it's a check. Large cards leave white space.

*Principles.* Explain, never hide: strong. Consequence preview: the plate *is* the preview.

*Needs.* Record card rendering from a proposed (not yet kept) record.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V5: The gap in the tree
*Idea.* The kinds Data Atlas keeps as a tree (an event → inspection → its seven details; a thing → van, depot, firm), each column sitting on the detail it fills. Type has nowhere to go, so a dashed gap sits where it would belong, with its values and counts (Annual 11, Interim 12, Re-test 1) and "kept in the note until then". Beside it, the request: "kind of visit", for inspection, waiting: 24 inspections from this file, asked by Ade, decides Lena Ortiz, also asked by no other source yet. A key (A) shows the admin adding the word: only recipe line 12 reruns, for the 24 that waited; Triage sees 24 changes, not 24 new records. T shows the Common Core Ontologies terms.

*Sources.* The structure predicts its gaps (catalogue run); Data Atlas's studio, where admins decide the words sources asked for; Mendeleev's table with gaps.

*What works.* It turns "this column doesn't fit" into a request with a reason (24 waiting records) addressed to the person who can fix it, and it says what will happen when they do. Rerunning only the waiting line is the payoff of a recipe made of lines.

*What fails or risks.* A tree of kinds is an admin's picture; operators don't think in "an event". The tree should show only the branch the file touches. "Also asked by no other source" needs a count across sources that Data Atlas doesn't keep yet.

*Principles.* Explain, never hide: strong. Waiting is a place (catalogue). Calm.

*Needs.* Words-asked-for entries that carry their waiting records; partial rerun of one recipe line.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 5

## V6: Matched in ink, proposed in pencil
*Idea.* Two lanes. Ink, always on: 22 vans matched by number, 1 with no match, 9 spellings joined into 3 depots, 1 spelling joined by a person (W'field; with the model on, it was proposed in pencil and inked by Ade), the firm by name. Pencil, by meaning, only with the model gateway on: "line 20 (NV-04, 9 Oct 2026) follows up line 7" (its note says "brakes re-test"), and "line 23's note points at line 22" (the loan van). Each can be inked, which names who did it. G turns the gateway off: the pencil lane says Data Atlas matches by keys, names and spelling only, and says so; the counts row (24 land, 23 vans, 1 new, 2 set aside) doesn't move.

*Sources.* Pencil and ink (reference desk run); docs/atlas.md ("Without it, Triage matches by keys, names and spelling, and says so").

*What works.* It shows the right job for the model here: not matching codes (rules do that better) but reading notes and proposing **links between lines** that no rule would find. G proves the counts don't depend on the model. Inking names a person, so provenance never washes out.

*What fails or risks.* The links proposed need a kind of link Data Atlas has ("follows up"); the loan van one has none and can only be a note. A model reading notes may see personal data; the gateway must get only the columns the recipe allows.

*Principles.* Pencil and ink: strong. Explain, never hide: the off state explains itself. Calm.

*Needs.* Gateway calls scoped to named columns; proposals as data with reasons.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

---

## Ranked
1. **V3 Near matches**: exact in ink, weigh only what has no exact match, with evidence.
2. **V1 In a sentence** as the mapping you read, with **V4 Plated** as the check.
3. **V6 Ink and pencil**: the model proposes links between lines, never codes.
4. **V5 The gap in the tree**: a column with no place becomes a request with its waiting records.
5. **V4 Plated** (folded into 2).
6. **V2 Two shelves**: only under T, for admins.

**What I'd build first:** the sentence (V1) as the mapping, with one plate (V4) read back under it. Exact matches go through in ink, and the only things a person is asked about are the few with no exact match, weighed field by field (V3). A column with no place becomes a words-asked-for request (V5) and its values wait in the note, so nothing is lost. The model's job, when the gateway is on, is links between lines, in pencil (V6).

## Where this pushes back
- **Matching across floors.** Data Atlas shows a floor what's kept on it and above. A recipe run by someone on the Department floor can't see team-kept vans, so it would propose duplicates. The matcher must be able to answer "a match exists where you can't see; its keeper decides" without leaking the record. Needs Harry's decision on whether that answer may say *which* floor.

## Needs token
Uses the run's tokens; nothing new here.
