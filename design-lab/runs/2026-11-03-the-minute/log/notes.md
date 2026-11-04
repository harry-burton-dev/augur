# Surface 6 · The decision log

**The moment:** the Fleet and Facilities leadership meeting's decisions over a year: 21 decisions from 11 meetings (one from November 2025), 11 of them in force today, one reversed, two amended, two lapsed, the rest complete. Each variant is a different way to find a decision and to know whether it still stands: by words, by date, by its life, by a question, by subject, or by the book the minutes are kept in.

**Shared data:** as in the grammar notes. Status on every page is computed from the record's dates on the date being shown; nothing is stored as a status. `subjects` are the decisions' catchwords.

**Keys:** / searches (V1), arrows move between meetings (V2, V6) or decisions (V3), 1 to 3 ask a question (V4), letters jump (V5), G turns the model off (V4), T shows the record fields, R replays.

---

## V1: The register
*Idea.* The register of resolutions: every decision of the body this year, grouped by meeting (with each minute's confirmed date, or "draft minute" for today's), each row with its id, status mark and title. A search box finds by words, subject or number. A **sentence counts what it found**: "“Kestrel” is in 2 of 20 decisions this year: 1 in force and 1 reversed", and each count in the sentence is a filter. The moment types "Kestrel".

*Sources.* Registers of resolutions (company secretary practice); said in a sentence (catalogue run: the facet sentence).

*What works.* It is the obvious, necessary view and the cheapest to build. The facet sentence does the job of a filter panel in one line and says how much is hidden. "Draft minute" on today's meeting is honest: these decisions are made but their record isn't confirmed yet.

*What fails or risks.* Plain search misses synonyms ("contractor" vs "Kestrel"), which is why V5's subjects matter. Grouping by meeting is right for a secretary and wrong for someone asking "what's in force about X?" (V2, V4). Reversed rows sit among live ones with only a mark to tell them apart.

*Principles.* Explain, never hide: reversed and lapsed decisions are listed, quieter. Calm. No letterbox.

*Needs.* Full-text search over decision words and subjects in Mandate.

*Scores.* Clarity 5 · Distinctiveness 2 · Feasibility 5 · Fit 4

## V2: In force on a date
*Idea.* The log opened at a date shows exactly the decisions in force then, with a rail of meetings to step along and an address (`mandate / ffl / decisions @ 2026-08-01`) to send. Rows that have changed since say so ("today: reversed by D-131"). A side panel lists every change between that date and today, from the records' own dates. The moment moves from 15 April to 1 August, the middle of the trial.

*Sources.* legislation.gov.uk's point-in-time versions; time as an address (wear and time).

*What works.* It answers the audit question ("what was decided and in force when that call was made?") in one step, and the address makes it shareable. D-118 on 1 August shows "worth revisiting", because a line was crossed that very day, so the past view is honest about what was known then. The change list is the "what happened since" for someone back after a month.

*What fails or risks.* "In force" depends on accurate end dates (complete, lapsed), which people forget to set. Spent decisions need a nudge. The meeting rail is fine for a year of monthly meetings and crowded for a weekly stand-up.

*Principles.* Time as an address: the strongest of the six. Explain, never hide. Calm. No letterbox.

*Needs.* `@date` routes in the shell; status computed from dated events; a prompt to mark one-off decisions complete.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V3: Lifelines
*Idea.* The year as a strip: each decision a line from the meeting that made it until it ended (complete, amended, reversed, lapsed dotted), with warning stretches where a revisit line was crossed. When one decision reverses or amends another, a dashed hand-on runs from the old line's end to the new decision's start. Meetings are faint verticals; one now line. The moment draws the year once, left to right.

*Sources.* Marey's train graph; one-now; Gantt charts.

*What works.* The body's year reads at a glance: a cluster of rules made in spring that still stand, the telematics pilot handing on to its extension, D-118's line with its two amber stretches handing on to D-131. Long white lines are the body's standing rules, which is a useful thing to see and hard to get from a list.

*What fails or risks.* Twenty-one rows fit; a busy body's two hundred won't, so it needs the overview rung (one row per subject, or a density strip). Titles truncate. It shows shape, not content, so it is a view to explore from, not to read.

*Principles.* One-now: strong. Calm: draws once. Explain, never hide.

*Needs.* The shared time scale (wear and time); end dates on every decision.

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V4: Ask the log
*Idea.* Ask a question in plain words ("What did we decide about Kestrel, and is it still in force?"). Fixed rules read a subject and a time from it, and the answer is built from the records by template: "3 decisions mention Kestrel. One is in force today: D-131", then the in-force words and every hit with its status on that date. The workings are listed beside it (subject, when, status read on that date, only decisions you can open). The model may add a short summary in pencil, with pointers, labelled "not part of the answer". G turns it off and nothing else changes.

*Sources.* The reference desk run (the workings show, pencil and ink, the answer has a base); question and answer.

*What works.* It is the view most people will actually use: they don't know the decision's number or its meeting, only its subject. **The answer never comes from the model**, so it reads the same in every deployment and turns the same way when a decision changes. The third question ("on 1 August") shows that time words become an "as at" date, which is time as an address in plain language.

*What fails or risks.* The question parser is a small fixed grammar (subject plus "still", "on <date>", "in <month>"); anything outside it needs a fallback ("I found these by words"). The pencil summary for the in-force decision can over-simplify; pointers help, and it is optional.

*Principles.* Pencil and ink: strong. Explain, never hide: the workings. Calm. No letterbox.

*Needs.* Catchwords (subjects) on decisions; the reference desk's query planner, reused for decisions; access checks per decision.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 5

## V5: The subject index
*Idea.* The log as a back-of-book index: every subject a heading, in alphabetical order with a letter bar; each **locator is a decision that carries its own status mark** (hatched when reversed); subjects with three or more decisions say which are in force; "see also" links subjects that share decisions. The moment looks up "Kestrel".

*Sources.* Back-of-book indexing (ISO 999, Society of Indexers); law digests and Hansard indexes; the index prompt (P).

*What works.* It finds by subject, not by the words used, and it shows a body's concerns at once: nineteen subjects, with "North depot" and "inspections" heaviest. Status on the locator means a reader can tell from the index alone that most Kestrel decisions no longer stand. "See also" from shared decisions is computed, never curated.

*What fails or risks.* It depends on good catchwords, and catchwords drift ("fitters" vs "staffing"). The index needs an authority list per deployment, which is the catalogue run's controlled vocabulary again. A three-column index is a reading view, not a working one.

*Principles.* Explain, never hide. Calm. No letterbox.

*Needs.* `subjects` on decisions from a controlled list (Data Atlas could hold it).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V6: The minute book
*Idea.* The minutes as a bound book: each meeting a page, two pages to a spread, tabs for every meeting along the foot. Each page lists who was present, its items and decisions (with status marks), and a stamp: "Confirmed as a true record on 9 Jun 2026 · signed Marcus Hale, chair", or "Draft" for today's. When the next meeting confirms a minute with a correction, the correction shows on both pages as a seam ("reduced to breakdown cover ~~from 1 August~~ → when it renews on 1 September 2026; asked by Dana Whitlock"). The moment turns from April and May to May and June.

*Sources.* Minute books (signed, numbered, kept); visible repair (wear and time).

*What works.* It makes the minute's own lifecycle visible: drafted, agreed item by item, confirmed by the next meeting, corrected without erasing. The correction seam is the best demonstration in the run that **a record is corrected, never edited**. It is also a familiar, trustworthy form for boards and auditors.

*What fails or risks.* Page-turning is a skeuomorph; the wear and time run warned against "handled sheets". The useful parts (confirmation stamp, correction seam) survive without the book. Two pages at 1280 is tight.

*Principles.* Explain, never hide: corrections stay. Calm: one turn. No letterbox.

*Needs.* Minutes as a record (in Artifacts, as a document that transcludes the decisions), confirmation and corrections on meetings.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 3

---

## Ranking
1. **V4 Ask the log**: how most people will look; the answer never comes from the model.
2. **V2 In force on a date**: the audit view, with a shareable address.
3. **V1 The register**: the necessary list, with a sentence that counts.
4. **V5 The subject index**: finds by subject; locators carry status.
5. **V3 Lifelines**: the body's year at a glance; an exploring view.
6. **V6 The minute book**: keep the stamp and the correction seam, drop the book.

## What I'd build first
The register (V1) with V4's question box at its top and V2's "as at" date as a control on the same page: one log, three ways in. Subjects (V5) are the data that makes V4 and the index work, so they come with the record type. Lifelines (V3) are the log's overview rung once a body has more than a year of decisions.
