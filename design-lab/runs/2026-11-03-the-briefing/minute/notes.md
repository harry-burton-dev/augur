# Surface 3: the one-minute briefing

Six briefings on one topic, made from the same sample data: should the North waste collection contract with Clearway be renewed, extended or retendered? Sam Achebe (contracts officer, Waste and Streets, a Team floor) briefs Morgan Hale (Head of Operations, a Department floor). The decision is an intent in Mandate, due 1 Dec. The briefing is a document in Artifacts. The facts come from Data Atlas records: 83 incident records, 11 inspections, the contract, the renewal offer, Clearway's own monthly report (which disagrees), and the procurement timetable guide.

Every page has the same sample data (one `DATA` object in `_src/data.js`, built into each page by `_src/build.py`). Each page has the same keys: **G** turns the assistant (the model gateway) off, **T** shows technical words, **R** replays, and **Esc** closes the records drawer. Each runs its moment about 1.2 s after load. I checked every page at 1600×900 and 1280×800 with G and T on and off and the records drawer open (`_src/check.js`). None scrolls sideways and none logs a console error.

The "new employee test" verdicts below are my own judgement of a first read. I haven't tested them with people.

## What all six agree on

- **Bottom line first, then the facts, then what we don't know, then the ask.** That is the BLUF order, in every variant.
- **Facts are ink and come from templates.** Each fact is a sentence template filled from records ("Missed collections rose from {first} in {m0} to {last} in {m4}."). The model never writes or rewords a fact, a number or a gap. So with G off, every count, picture and fact is identical.
- **The model may write three things, all in pencil:** the bottom line, a suggested cut or order, and a suggested question. Each phrase in a pencil bottom line points at the fact that holds it up. A phrase with nothing behind it ("Clearway has served us well for years") is struck with a wavy line, and the page won't ink the line until it is gone.
- **Inking keeps who drafted it:** "Inked by Sam Achebe, 3 Nov · drafted by the assistant". This answers the reference desk's V1 problem, where inking erased provenance.
- **Confidence words are given by rule, not by the model.** They use the UK probability yardstick (`DATA.yardstick`, with the percentage range one step down under T) and `DATA.sureRules` (for example "sources disagree but the larger figure is our own log" gives *likely*). A person may lower a word but not raise it past the rule.
- **The six ways to be empty all appear**, with the catalogue's marks:
  - not yours to see: resident complaints, with whom to ask
  - not known yet: CW-11's inspection, and whether Clearway would take an extension
  - stale: the Eastgate audit
  - no record: the log outage from 8 to 21 Aug
  - none: safety incidents
  - doesn't apply: the Riverside transfer station

  A gap or a disagreement can't be cut to save time.
- **Sources that disagree are shown side by side, never averaged:** our log counts 27 for October, Clearway's report counts 14.

---

## V1: Staff note with sidenotes
*Idea.* A one-page staff note: To and From, the intent it answers, then four sections in BLUF order. Each section shows its own reading time, and the left rail adds them up (59 s). Each fact's records, confidence word and yardstick sit in a Tufte margin beside it. The bottom line is the assistant's draft in a dotted pencil lane. The moment: the draft arrives, the unbacked phrase is struck in red with "nothing in the records says this", Ink lights up, and the line becomes ink with its provenance kept.

*Sources.* BLUF and staff writing (bottom line, background, decision needed); Tufte's sidenotes; pencil and ink from the reference desk.

*What works.* A manager has read this form all their career. The margin answers "how do you know?" without breaking the line of reading. The reading time per section makes "a minute" something you can check. Striking the unbacked phrase is the clearest single picture of where the model's licence ends.

*What fails or risks.* At 1600×900 "What we don't know" falls below the fold, so the sheet scrolls. A one-minute brief should not need that, and an operator writing more will break it sooner. The sidenote column doubles the width, which a phone can't do (no phone layout yet anyway). The margin repeats each fact's confidence word, which makes it busy.

*Principles.* Explain-never-hide: strong, because every gap has its mark and owner. Calm: the page is still after its moment. Letterbox and focus stacking: not used.

*Needs.* Pencil tokens (`--x-proposed-pencil`, `-edge`, `-wash`, `-unbacked`); a sheet surface `--x-proposed-sheet`; a reading speed setting (`DATA.readWpm`, per org); a sentence template per kind of fact; an "inked by / drafted by" pair on every document block in Artifacts.

*New employee test.* **Pass.** It reads top to bottom like a memo, and pencil versus ink needs no legend.

*Where a model may write.* Only the bottom line, in pencil. Everything else is a template.

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4.

## V2: Counted in pictures
*Idea.* The briefing as Isotype panels. Each panel's title is its finding ("A retender would run 3 months past the contract's end"). Each picture counts with repeated symbols: one bin is one missed collection, and each one is a record you can hover. One truck is one vehicle. One £ is £100k, and a cut symbol is part of one. One calendar is one month of retendering. Clearway's lower count is a second, amber row under October. The two lost weeks are a wavy break inside the August row. Each panel credits its "transformer" ("Picture by Sam Achebe from 83 records"). The moment: the symbols are set down row by row.

*Sources.* Otto and Marie Neurath's Isotype and the transformer's role; Rosling and Our World in Data (the title is the finding).

*What works.* "27 bins against 11" is understood before it is read, and the disagreement is two rows you can count, not a footnote. Because each symbol is a record, the picture and the records are the same thing, which is the strongest kind of traceability. The transformer credit names a human role for "who turned the data into this".

*What fails or risks.* Counting only works up to about 50 per row. Past that, a symbol has to stand for a group, which needs a rule and a legend. Each kind of thing needs a symbol from Lucide (bin, truck, £, calendar), and some kinds have none. The page is picture-heavy: the four panels take 30–40 s to read, so it is a "minute" only for a reader who trusts the titles. At 83 symbols plus their records the DOM is fine, but at thousands it isn't.

*Principles.* Explain-never-hide: strong, because the gap is drawn inside the count. Calm: still after the count. Gimmick risk: low, because the counting is the content.

*Needs.* `--x-proposed-tick` (the step between counted symbols); a symbol per kind in Data Atlas (an admin picks a Lucide name per kind, which is new); a rule for "one symbol = N"; partial symbols drawn by clipping.

*New employee test.* **Pass** for the pictures. **Partial** for the bottom line, which sits apart from the pictures at the top.

*Where a model may write.* The bottom line only. Panel titles are templates ("{fail} of {all} vehicles failed inspection"). A model must not write a chart title, because the title is a claim.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4.

## V3: The minute meter
*Idea.* The author's view. A timing bar sets the draft against a 60 s budget (an org setting). Each segment is a sentence, coloured by who wrote it (from records, your words, the assistant's pencil), and any segment past the budget line gets an amber underline. Press F and the assistant proposes cuts in pencil, each with a reason ("repeats fact 1; a word-sized picture says it"). A gap or a disagreement shows a lock: "can't be cut: a gap is never cut". The moment: 89 s with 38 s of proposed cuts, then the cuts move down. They aren't deleted: they land in "One step down · if Morgan asks", and the bar turns green at 51 s. The model's invented sentence is the one thing not kept.

*Sources.* The inverted pyramid in news writing (cut from the bottom); broadcast timing sheets; Strunk's "omit needless words" made measurable.

*What works.* It makes "readable in a minute" a number the author can see while writing. It is the clearest statement of the model's licence in any variant (the rules list on the right). "Cuts move down, never away" keeps the details one step from the brief. It works fully with G off: the meter still runs and you move sentences yourself.

*What fails or risks.* Words-per-minute is a crude proxy, because pictures and numbers take longer than words. It is an editor, not what Morgan sees, so it needs a reader view (V1 or V5) beside it. Authors may write to the meter rather than to the reader.

*Principles.* Explain-never-hide: strong, because cut text stays visible with its reason. Calm: the meter only changes when you edit.

*Needs.* A budget per kind of document (an org setting in Artifacts); the "kind" of each sentence (template, own words, pencil) stored with the document; a "workings" section in Artifacts documents for text moved down.

*New employee test.* **Pass** for the author: "89 s, budget 60" needs no teaching. The manager never sees this view.

*Where a model may write.* The bottom line, plus cut and order proposals with reasons. It may never rewrite a template sentence, cut a gap or a disagreement, or add a sentence of its own that has no record behind it.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit 4.

## V4: Say, show, know
*Idea.* A two-column TV script grown to three columns. Each line of the briefing is a row, and the columns are its three heights: **Say** (the sentence), **Show** (the picture) and **Know** (the records, the confidence word, the disagreement split in two). A narrow column on the left says who wrote each row (pencil and the assistant, or template from records). Keys 1–3 choose how many heights to show, and ↑ and ↓ move a read head down the rows. The moment: the read head steps to fact 1, where Know splits into "27, our incident log" and "14, Clearway's own report".

*Sources.* The two-column A/V script used in TV and documentary; Bret Victor's ladder of abstraction; Tufte's small multiples.

*What works.* It is the honest whole: all three heights for every claim side by side, so a reviewer (an auditor, a lead who doubts a figure) can check the briefing row by row. "Say" alone is a clean one-minute brief, and the same page grows into the evidence.

*What fails or risks.* At "All three" it is a dense table, not something a manager reads in a minute. It is a reviewer's tool. With three columns of equal weight the bottom line loses its primacy. The pictures are small, and at 1280 the Show column is cramped.

*Principles.* Explain-never-hide: the strongest, because nothing is one click away; it is all on the page. Calm: yes. Focus stacking: the read head is a light form of it.

*Needs.* A picture template per kind of fact (bar by month, count of things, two bars, timeline); the record sample shown in Know (the latest record, the records that disagree, the records that failed).

*New employee test.* **Fail at "All three", pass at "Say".** The default should be Say, with Show and Know as steps down.

*Where a model may write.* The bottom line row only (pencil, with the "who wrote it" column saying so).

*Score.* Clarity 3 · Distinctiveness 4 · Feasibility 4 · Fit 4.

## V5: If asked
*Idea.* The brief on the left is only the bottom line, four headlines with their confidence words, and the ask. On the right are the questions Morgan is likely to ask, each folded with its answer ready. Sam's questions are ink. The assistant may suggest questions (pencil, with a different icon), but every answer comes from records by template, or says which way it is empty:
- "What are residents saying?" gets "some, kept on Customer Services. Ask Priya Nair."
- "Have other councils extended a contract like this?" gets "Nothing in the records answers this. Jo Reyes could find out. The assistant suggested the question; it may not answer it", with Ask Jo or Drop.

The moment: three questions unfold in turn.

*Sources.* Press-office Q&A briefs ("lines to take"); staff papers' "anticipated questions" annex; BLUF.

*What works.* It is the shortest brief of the six (four headlines) and the deepest backup. "How do you know?" is literally a question with its answer under it. It cleanly separates what a model may do (raise a question) from what it may not (answer it). The unanswerable question becomes an errand for a named person, which is the reference desk's "the empty knows its errand".

*What fails or risks.* Folded answers hide detail until someone opens them. That's acceptable because the questions are visible and say what they hold, but a printed copy needs them unfolded. Choosing which questions to keep is editorial work for the operator. Seven questions is the most I'd allow.

*Principles.* Explain-never-hide: strong, because the questions announce what's behind them. Calm: yes. Fits the honest blank: an unanswerable question is drawn as a gap, not left out.

*Needs.* Question templates per kind of fact ("How do you know {head}?"); a "question" block in Artifacts documents that links to a claim, an empty or an option; "Ask {person}" sends a share request.

*New employee test.* **Pass**, with the best result of the six: a manager reads the left in 20 s and opens only what they doubt.

*Where a model may write.* The bottom line, and suggested questions (pencil). Never an answer.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 4.

## V6: The appreciation in the letterbox
*Idea.* For a decision with a deadline, the briefing is a military appreciation: the aim, the courses open, the choice. Because the recommendation is due in 11 days, it is framed in the 2.39:1 letterbox (PDR-009). The top bar carries the intent, its owner and the due date. The bottom bar carries what the briefing can't see. Inside the frame, the three courses are small multiples with the same rows: cost, in place by 31 Jan?, what it risks, what we don't know, and the facts it rests on. The assistant's lean is drawn in pencil on course 2. The moment: Sam recommends course 2. It turns to ink ("chosen by Sam Achebe, as the assistant drafted"), and the consequence preview shows what Send does: the document is kept in Artifacts, it is added to the intent in Mandate, Jo is asked about the extension, and the four facts are watched until 1 Dec.

*Sources.* The military appreciation (aim, factors, courses open, plan); the letterbox for urgent and important things (PDR-009); small multiples; consequence preview from the cinematic run.

*What works.* It is the only variant where the reader's real question, "which one?", is the layout. The comparison rows make the "retender only" course show its own flaw (no, not in place by 31 Jan) without anyone saying it is bad. The consequence preview answers "using it is one step" and shows the reach (whose floor it goes to, and what it changes in Mandate) before anything is sent.

*What fails or risks.* It only fits briefings for a decision with options. A briefing that is "for information" has no courses. The letterbox will lose its force if every decision brief gets it. It should frame only when the intent is near its deadline, and the shell should decide that from the intent, not the author. The frame leaves empty space at 1600×900.

*Principles.* Letterbox: yes, driven by the intent's deadline, with the bars carrying information. Explain-never-hide: the bottom bar keeps the gaps in view. Consequence preview: yes. Calm: still after the choice.

*Needs.* A rule for when a briefing is framed (intent due within N days, set in Mandate); "options" as a block kind in Artifacts with fixed rows; watching facts (below).

*New employee test.* **Pass** for a decision brief, because three columns and "recommend this" need no teaching. Not applicable to other briefs.

*Where a model may write.* The lean (pencil, on one course), and the bottom line for the course it leans to. Every cell is ink. The choice is always a person's.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5.

---

## Scores

| Variant | Clarity | Distinct. | Feasibility | Fit | New employee test |
|---|---|---|---|---|---|
| V1 Staff note | 5 | 3 | 5 | 4 | Pass |
| V2 Counted in pictures | 4 | 5 | 3 | 4 | Pass (pictures) |
| V3 Minute meter | 4 | 5 | 4 | 4 | Pass (author's view) |
| V4 Say, show, know | 3 | 4 | 4 | 4 | Fail at three heights, pass at one |
| V5 If asked | 5 | 4 | 5 | 4 | Pass (best) |
| V6 Appreciation | 4 | 4 | 4 | 5 | Pass (decision briefs only) |

## Ranked
1. **V5 If asked**: the shortest brief and the deepest backup, and the cleanest line on what the model may do.
2. **V1 Staff note**: the default form; the struck phrase is the clearest picture of the model's limit.
3. **V3 Minute meter**: the author's side of V1 and V5; makes "a minute" a checkable number.
4. **V6 Appreciation**: the form for decision briefs, and the best "from finding to action".
5. **V2 Counted in pictures**: the strongest pictures; keep it as the picture vocabulary rather than a page.
6. **V4 Say, show, know**: the reviewer's and auditor's view of any briefing, one step down.

## What I'd build first
One briefing block in Artifacts with a fixed order: the bottom line, then the facts as headlines, then "what we don't know", then the ask. This is V1's sheet with V5's "if asked" folded under each headline.

Every fact is a template filled from a Data Atlas query, and carries its confidence word by rule and its records one click away. The model gets one pencil slot, the bottom line. It is drawn as V1 draws it: each phrase linked to a fact, an unbacked phrase struck, and inking kept with "drafted by". V3's meter sits in the editor, measured against an org budget, and what the author cuts moves into "if asked".

V6's courses-open block is an optional section for decision briefs. It is framed only when the intent it answers is near its deadline. V2's counting rules become the picture each fact may use, and V4's three columns become the reviewer's view.

This order needs only the pencil tokens, sentence templates per kind of fact, and the sure rules. Everything else is layout.

## Answers to the prompt's questions (from this surface)
- **Where may a model write the bottom line, and how do its claims stay tied to records?** In one pencil slot per briefing. Each phrase must point at a fact on the page. A phrase that points at nothing is struck and blocks inking. Inking keeps "drafted by". Facts, numbers, chart titles, confidence words and answers are templates, never the model. With G off, the slot becomes the template sentence plus a not-known-yet gap: "your recommendation: you write it".
- **Which charts?** This surface used only four: a bar or sparkline by month, a count of things with repeated symbols, two bars, and a timeline. None needed more. Never pies (no part of a whole was asked), never dual axes, and never a scaled single symbol.
- **What "watch for change" needs.** V6's "the four facts are watched" needs each fact stored as a saved Data Atlas query plus its template. It also needs an event when a source behind a fact gains, loses or changes an observation (`atlas.observation.changed`, filtered by the query), and a rule for what counts as a change (the count moves, the confidence word moves, a gap closes). The watch also needs an end date taken from the intent's deadline.

## Needs token (all mixes of kit tokens)
- `--x-proposed-pencil`, `--x-proposed-pencil-edge`, `--x-proposed-pencil-wash`: pencil and ink.
- `--x-proposed-unbacked`: a phrase with no record behind it.
- `--x-proposed-sheet`: the paper of a briefing.
- `--x-proposed-reader`: the reader's floor colour, as an underline on their name.
- `--x-proposed-tick`: the step between counted symbols.
- Carried over from the catalogue: the gap, stale, unseen and disagree marks, `--x-proposed-quiet`, `--x-proposed-type-micro`, and the lit next step.
- All six variants rely on `--font-mono` for numbers and labels, which still needs an ADR.

## Data the shell doesn't have yet
- A sentence template and a picture template per kind of fact.
- Sure rules: the confidence word chosen from sources, their agreement and their age.
- A reading speed and budget per kind of document.
- Per-block provenance in Artifacts: template, own words, or pencil, with "inked by".
- A question block linked to a claim.
- An options block.
- A Lucide symbol per kind in Data Atlas (for counting).
- An intent's "ask due" separate from its decision due date.
- Watched facts with events from Data Atlas.
