# Surface 1 · The label sheet (grammar)

**The moment:** one labelled value, the Marlow Star pilot's time on duty (13 h 40 min), is taken apart into the parts every label in AUGUR would carry: marking, permitted use, origin, keep until, caveat and custody. Each part has a plain word, a symbol and a deed behind it.

**Shared data, one object (`DATA`) for the whole run:** Halden Estuary Ports, a public port authority. Org 640 people; Marine Operations (Department, 86) with Pilotage (Team, 14) and Vessel traffic services (Team, 22) under it; Commercial (Department, 31). The marking scheme, descriptors, uses, keep rules, clauses and the minimum group size all live in `DATA.policies[0]`, a deployment policy built on the UK Government Security Classifications. `DATA.policies[1]` is a second, made-up deployment (INTERNAL, CONFIDENTIAL, RESTRICTED; ISO 27001 wording; minimum group 5). Every value points at a label object; nothing in a page names a marking word.

**Keys on every page:** R replays, T shows the admin words (label ids, rule ids, event names), **S swaps in the other deployment's policy**, and every marking or portion mark is a button that opens its deed (plain words, the clause, who may loosen it). Esc closes the deed.

**Files:** `v1-annotated-specimen.html` … `v6-phrase-book.html` are built by `../_src/build.py` from `../_src/common.css`, `data.js`, `lib.js` and `../_src/grammar/v*.src.html`. Built pages link the kit as the brief says.

---

## V1: Annotated specimen
*Idea.* The label laid out once, the way a reference sheet annotates a specimen: one value with a GSC banner at head and foot, a portion mark on the value, and six numbered cells (marking, permitted use, origin, keep until, caveat, custody). The list on the left names each part with the question it answers ("How careful must I be?"). The moment opens the deed of the marking, so "explained in a click" is the first thing you see.

*Sources.* UK Government Security Classifications (banner at the top and bottom of the page, portion marks); Creative Commons (badge with a deed behind it); evidence chain of custody.

*What works.* The six parts and their order are learnable in one look, and the questions make them readable by someone who has never seen a classification scheme. The deed answers "who can change it" with a name and a rule ("Anyone may make it stricter. Only Anita Shah may make it less strict"), which is the explain-never-hide test. S proves the words are data: the same page reads INTERNAL/CONFIDENTIAL with no code change.

*What fails or risks.* Six parts is too many to show on every value at once; this is a sheet, not a component. The custody chain at cell size is decoration until you open it. The double rule for OFFICIAL-SENSITIVE reads as "more serious" only once it has been learned.

*Principles.* Explain, never hide: strong (every part opens its deed). Calm: nothing moves at rest. No letterbox, no focus stacking.

*Needs.* `--x-proposed-mark-rule-1`, `--x-proposed-mark-rule-2`, `--x-proposed-mark-ink`, `--x-proposed-mark-weight` (needs token). A label object per value (see SHORTLIST).

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V2: Allergen panel
*Idea.* The food label. Front of pack: four boxes in a fixed order (Care, Reach, Uses, Kept), each with a fill of three steps and a word, so two values can be compared like two packs on a shelf. Back of pack: "Contains" in bold (PERSONAL, COMMERCIAL) the way allergens are bolded in an ingredient list, "Not for", "Made from" and the caveat. C switches on the food colours for comparison.

*Sources.* EU/UK Food Information to Consumers rules (allergens emphasised in the ingredient list); UK front-of-pack traffic-light labelling.

*What works.* "Contains PERSONAL" and "Not for appraisal, model use and outside use" in bold is the fastest read in the run. People already read this format. The comparison across three values (the hours, the tug's charge, the time and place) makes the difference between them obvious.

*What fails or risks.* The boxes are worked out by thresholds (14 people = "one team" = most careful), and thresholds are policy: a deployment has to set them, or they mislead. Colour (C) is a trap: red and green already mean states in AUGUR, and a red "Reach" box for a 14-person team reads as an error. A pack per value is far too big for a record; it belongs in a deed or a collection.

*Principles.* Explain, never hide: good. Calm: monochrome by default. Pushes back on nothing.

*Needs.* Box thresholds as policy data. No new tokens beyond the shared ones; the colour mode uses `--success`/`--warning`/`--danger` and should not ship.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 3

## V3: Badge, deed, policy
*Idea.* Creative Commons' three layers, side by side and row-aligned: the badge you read in a second, the deed in plain words, the clause of the deployment's policy it rests on. A machine layer (T) shows the label as data. A strip at the foot shows this deployment's markings against another's; S swaps them. The moment lights "Not for appraisal" across all three layers.

*Sources.* Creative Commons licences (icon, human-readable deed, legal code, machine-readable metadata).

*What works.* It answers "why?" all the way down: the badge says not for appraisal, the deed says "may not", the clause says "§6 Just culture … safety reports are never used for appraisal or discipline". It is the clearest picture of "every marking scheme comes from the deployment's own policy". Admins would use this view to check a policy.

*What fails or risks.* A reference view, not an operator one. Clauses here are short sample text; real policies are long and would need someone to write the one-line clause for each rule. "No clause: allowed unless something says otherwise" is honest but invites the question of who decided the default.

*Principles.* Explain, never hide: the strongest of the six. Calm: yes.

*Needs.* A clause per rule in the policy (data AUGUR doesn't hold yet). Admin owns it.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V4: Six questions
*Idea.* The label as six fixed questions with one-line answers, the datasheet way. Next to a fully labelled value sits one that arrived this morning from the tide gauge with no label: its unanswered questions are gaps with a name ("Ruth Okoye could answer this"), it is handled as OFFICIAL-SENSITIVE until labelled (the policy's default), and a label is suggested **by rule** in pencil (its siblings on the record are OFFICIAL and nothing names a person) until Ruth inks it (A).

*Sources.* Datasheets for Datasets (Gebru and others, 2018); the Dataset Nutrition Label; pencil and ink (reference desk run); six ways to be empty (catalogue run).

*What works.* It found two rules the others don't show: **unlabelled is strict, not open**, and **a suggested label is pencil until a person inks it**. The questions are the same words in every app, so they translate once.

*What fails or risks.* Six full sentences per value is long; it is the deed, not the badge. Strict-until-labelled will annoy on day one of a new feed (everything arrives locked), so imports need a default label per source.

*Principles.* Explain, never hide: strong (gaps name a person). Calm: yes. Pencil and ink carried over.

*Needs.* A default label per import source; a "suggest a label" rule set (not a model).

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V5: The tag
*Idea.* An evidence tag tied to the value. The front says what it is and how to handle it, readable across a room; the back (it turns at the moment, F) is the continuity: every hand-over signed. A hand is a person, an app or a feed, and AUGUR signs. The break where Kofi typed the hours from the paper roster stays on the tag, with the mend below it.

*Sources.* Police and forensic evidence continuity labels; chain of custody.

*What works.* "Front for handling, back for history" is a strong split, and the physical metaphor makes it obvious that the label goes where the value goes. Reads are a single counted line, never names (mine versus ours).

*What fails or risks.* The flip is a gimmick on a screen, and 3D transforms fight the calm water language. The back is a log in disguise; custody V1/V3 tell it better.

*Principles.* Explain, never hide: good. Calm: one turn, then still; reduced motion crossfades.

*Needs.* Custody events with hands that can be apps and feeds.

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 2

## V6: Phrase book
*Idea.* The GHS chemical label anatomy: a signal word (the marking), pictograms (descriptors and forbidden uses), "what it is" statements and "what to do" statements, each a **numbered phrase from a fixed book** that the deployment words once. The book is shown beside the label, with the phrases in use lit. Picking another value (1–4) re-assembles the label from codes.

*Sources.* UN Globally Harmonised System (GHS) labels: signal word, hazard pictograms, H and P statements, supplier identification.

*What works.* Nobody types a label's wording, so labels read the same in every app and translate per deployment as a phrase list. The codes give admins and auditors a short form (T). The anatomy is strict and learnable.

*What fails or risks.* Diamonds borrow the look of hazard warnings, which is too loud for "OFFICIAL" and reads as danger at rest. Codes mean nothing to operators; they must stay in the admin register. The book grows with the number of uses times the verdicts.

*Principles.* Explain, never hide: good. Calm: the diamonds fail it.

*Needs.* A phrase book per policy (data); translation per phrase.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 2

---

## Ranking
1. **V1 Annotated specimen**: the reference sheet the kit and the docs need.
2. **V4 Six questions**: the deed's shape, plus strict-until-labelled and the pencil label.
3. **V3 Badge, deed, policy**: the admin's view and the proof that schemes are data.
4. **V2 Allergen panel**: "Contains" and "Not for" in bold, for collections and the deed.
5. **V6 Phrase book**: the phrase codes, not the diamonds.
6. **V5 The tag**.

**What I'd build first.** The label as a value-level object with six parts, the badge as one line (marking, uses as small symbols, keep), and the deed as V4's six questions with V3's clause underneath. The wording of every part comes from a phrase list in the deployment's policy (V6's idea, without its pictograms). From V2 keep only "Contains" and "Not for" in bold.
