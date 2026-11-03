# The ask: critique

Surface 2 of the reference desk. One box on the Data Atlas front page turns a vague question into a sharp one through a short exchange. Every variant uses the same question ("which suppliers have we not heard from since spring?"), the same sample deployment (one `DATA` object in `_src/data.js`: a regional services organisation, 20 suppliers, contacts from Artifacts and Data Atlas, a Mandate intent called "Spring supplier review") and the same engine (`_src/engine.js`). Build with `python3 _src/build.py`.

**Shared across all six**
- The question has four **loose words**: "since spring", "heard from", "suppliers", "we". A loose word stays in the person's own words, amber with a wavy underline, until it is settled. "Keep it loose" is always allowed.
- Three looks for where a word came from: **ink** (the record, or you said it: solid, floor-coloured underline), **pencil** (the model's guess: dotted edge, cool tint, italic, labelled "guess" or "model's reading"; becomes ink only when the person says yes), and a **tag** on every step: `from the record`, `by name and spelling`, `model gateway`, `you`.
- **Counts never come from the model.** Each choice shows how many suppliers it would leave before you pick it (consequence preview).
- **Neutral by construction:** choices are listed in the record's own order (dates in date order, floors smallest first), none is ticked for you, and the line says so. The model may find what is loose and may shortlist; it never picks.
- Honest edges from the catalogue's six ways to be empty: suppliers with no contact recorded at all (corner ticks, with who could check), "some" on a floor you can't open (135° hatch, lock, whom to ask), and what is never recorded (phone calls, inboxes: wavy break).
- **G** turns the model gateway off and the page keeps working; the gateway line says who can turn it on. **T** shows the technical line one step down. **R** replays.

---

## V1: The interview (`v1-interview.html`)
*Idea.* The classic reference desk. The desk asks one neutral, open question at a time ("When you say spring, which day should it start from?"); answered questions fold into one line with "change"; the sharpened sentence, count and the steps taken sit beside it. There are at most four questions, and each one says how many are left.
*Sources.* Dervin and Dewdney's neutral questioning (1986); the "explain the SQL" studies, for the steps list.
*What works.* It's the easiest to read of the six: question, choices, count, sentence. The steps list says plainly which step used the model and which didn't. Undo is cheap (⌫, "change").
*What fails or risks.* It's a wizard. It asks the same four questions even when one makes no difference, so over a working day it feels slow for repeat askers. The order is fixed, not chosen by what matters.
*Principles.* Explain, never hide: strong. Calm: one glow on the open turn, nothing loops. Focus stacking: the open turn is the only lit plane. No letterbox (not urgent, correct).
*Needs.* `--x-proposed-guess`, `--x-proposed-loose`; Data Atlas: dated details per kind ("contact" kinds), a deployment calendar (seasons, financial year start).
*New employee test.* **Pass.** It reads like a person asking you things.
*Model gateway.* Finding the loose words (on: the model; off: any word not matched to the record by name is treated as loose, which here finds the same four) and shortlisting the "heard from" choices (on: four, with two set aside that you can bring back; off: all six). Without it: reading "suppliers" and "spring", finding the review by name, every count.
*Score.* Clarity 5 · Distinctiveness 2 · Feasibility 5 · Fit 4

## V2: Author queries (`v2-author-queries.html`)
*Idea.* The question is set large like a proof, and each loose word gets a numbered mark. Numbered queries in the margin, like a copy-editor's author queries, can be answered in any order. Below the proof, "Set as" shows the sharp sentence and its count.
*Sources.* Copy-editors' author queries and proof marks; the reference interview.
*What works.* The person's own words stay big and central, and the system's questions sit in the margin. Any order, all visible at once. The marks line names who raised each query (by name, or the model gateway).
*What fails or risks.* Proof-reading is a specialist's metaphor; operators may not see the margin as "talk to me". Four open slips at once is more to read than one question. Big type costs height at 1280×800.
*Principles.* Explain, never hide: good. Calm: very. Focus: the open slip is raised and its word in the proof is lit.
*Needs.* As V1. A link between a word's position in the text and its query (the engine finds it by substring; a real parser would need spans).
*New employee test.* **Partial pass.** They get it once they click a mark. The margin alone doesn't invite them.
*Model gateway.* Raising queries on words that don't match any name ("we", "heard from"); shortlisting choices. Without it: the same queries, raised because nothing matched them, and longer choice lists.
*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V3: Situation, gap, use (`v3-bridge.html`)
*Idea.* Dervin's sense-making bridge drawn literally. Left bank: where you are (your question, and optionally what brought it up). Right bank: what the answer is for. The loose words are planks across the gap. The model reads the situation text into a use ("You want to chase them, before contracts renew in December"), shown in pencil until you say yes. The use then changes **which plank comes first**, never which choice is preferred.
*Sources.* Brenda Dervin's sense-making (situation, gap, use); Dewdney's neutral questions. "What will the answer help you do?" is the most authentic reference-interview move of the six.
*What works.* It's the only variant that asks about the need, not the words. The tie line ("You mentioned renewals. This is the question renewals touch.") shows why a question is asked. "Save with what it's for" gives a saved question its purpose, which the saved-questions surface will want.
*What fails or risks.* The bridge drawing is decoration and costs a third of the height. Asking "what's going on?" can feel nosy at work, so it must stay optional. This variant leans on the model most: without it the situation is kept as text and the use is picked from chips. Free text read by a model is the riskiest place for a wrong guess.
*Principles.* Explain, never hide: good (pencil until yes, "Not that" drops it). Calm: fine. Light language: the lit planks are a lit path.
*Needs.* A place to store "what it's for" with a saved question; `--x-proposed-guess-wash`.
*New employee test.* **Pass for the use question, fail for the bridge** ("is that a chart?").
*Model gateway.* Reading the situation into a use (pencil, needs yes), ordering the planks by it. Without it: the situation is kept verbatim, uses come from fixed chips, planks keep the default order, and every count still works.
*Score.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 3

## V4: The key (`v4-key.html`)
*Idea.* An identification key. Each loose word is a couplet of two or three leads, each with a count and "go to n", and the chosen lead lights (lit path). The **next couplet is the one whose leads split the answer most**, worked out from the record, so you choose least. A couplet whose leads all leave the same number is taken for you and says "makes no difference here".
*Sources.* Dichotomous identification keys (field botany); Twenty Questions.
*What works.* It uses no model at all, and says so ("no step needs a model"), so it is the honest baseline for deployments with the gateway off. The ordering rule is a real algorithm, not a guess. The keyed-out list on the right moves as you go and shows corner ticks and the unseen row.
*What fails or risks.* The couplet typography is foreign to most operators. Dotted leaders and "go to 3" read as a book index. Splitting most first can put a technical-feeling question ("we") before a natural one. Leads are hand-made per word (couplet templates per detail would be needed).
*Principles.* Explain, never hide: very good (a skipped step says why). Calm: yes. Light: the lit path matches the cinematic grammar.
*Needs.* Couplet templates per kind of thing (in the ontology); fast counts per lead (a few queries per keystroke; fine at Data Atlas sizes, but needs a count endpoint).
*New employee test.* **Partial pass.** The counts carry it even if "couplet" means nothing to them.
*Model gateway.* None. Matching by name and spelling, plus counts. The page says the gateway is on but unused.
*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V5: The draft answer (`v5-draft-answer.html`)
*Idea.* Answer first, as a draft: every supplier is a row on a timeline of contacts (icons for invoice, delivery, letter, incident, contract change, site visit). "Since spring" is a band of readings with numbered handles (1 Mar, 1 Apr, 14 Apr); picking one drops a cut line. Contact kinds are tick boxes that redraw the marks at once. Each loose word is asked about **only if it would change a row**: "suppliers: 1 row would change", "we: 2 rows would change", and rows that depend on a loose word say "depends".
*Sources.* Shneiderman's dynamic queries (HomeFinder, FilmFinder); spreadsheet filters.
*What works.* It is the strongest rule of the six: **don't ask what doesn't change the answer.** It's also the one place where the person sees why "spring" matters: the suppliers whose last contact falls inside the band are the ones the choice moves. Ticking and unticking feels like a spreadsheet filter. The model's shortlist shows as dashed tick boxes, not hidden ones.
*What fails or risks.* It is dense at 1280×800, and the timeline only works for date questions. A question with no time axis needs another draft shape (a table with the same "depends" column). Twenty rows is fine; two thousand needs grouping. Operators may read the band as a chart, not a question.
*Principles.* Explain, never hide: strong (every row says why it's in or out). Calm: the cut line moves once, nothing loops. Focus: quiet rows lit with a floor edge, others step back.
*Needs.* Dated contacts per supplier across Artifacts and Data Atlas (an events-style "last heard" index); `--x-proposed-type-micro`.
*New employee test.* **Pass with a nudge.** "Depends" and the count make sense; the handles need the numbered line above to be understood.
*Model gateway.* Only shortlisting what counts as contact (dashed boxes). Without it: every dated thing is a tick box. Rows, cut, "depends" and counts all work without it.
*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V6: Readings side by side (`v6-readings.html`)
*Idea.* Don't ask, show. Three readings of the question side by side, smallest answer first and none marked as right. Rows that are not in every reading are edged in amber with "only in B, C". "What separates them" lists each loose word's reading per column. You take one, and its sentence turns from pencil to ink.
*Sources.* "Explain the SQL" studies (show the generated query back); Query by Example; the reference desk's "is this what you need?".
*What works.* It answers "how do I tell a guess from a fact" inside one card: the reading is pencil, the count and rows are ink. Choosing by seeing the difference suits people who can't say what they mean but know it when they see it. It's also the natural answer to "keep it loose" in V1, V2 and V5.
*What fails or risks.* Three lists is a lot to compare, and the eye has to hunt for amber rows. It is the variant most open to leading: whoever drafts the three readings frames the choice, which is why it orders them by size and offers rule-built readings without the model. Combinations grow fast with more loose words.
*Principles.* Explain, never hide: strong. Calm: fine. Focus stacking: the taken card is lit and the others dim, a rack focus without blur.
*Needs.* A reading generator (model, or corners of the choice space); diff rows across answers.
*New employee test.* **Pass.** "Pick the one that looks right" needs no teaching.
*Model gateway.* Wording three plausible readings (pencil). Without it: three spread-apart sets of the record's own choices, labelled "from the choices". Rows, counts and diffs come from the record either way.
*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

---

## Ranked
1. **V5 The draft answer**: asks only what changes the answer.
2. **V1 The interview**: clearest, the base component.
3. **V4 The key**: works fully without a model, and orders by what splits most.
4. **V6 Readings side by side**: the right fallback for a word kept loose.
5. **V2 Author queries**: elegant, any order, a specialist's metaphor.
6. **V3 Situation, gap, use**: keep the "what's it for" question, drop the bridge.

## What I'd build first
V1's exchange as the kit part (one neutral question, choices in the record's order, the count each would leave, "keep it loose"), driven by two rules from elsewhere. From V5 and V4: **ask only about loose words whose readings change the answer, the most-splitting one first.** A word that makes no difference is settled for you and says so. From V6: a word kept loose isn't an error; the answer shows the readings side by side with the rows they disagree on. The model gateway does two jobs only: finding words that don't match the record by name, and shortlisting choices (shown, never dropped). It never picks and never counts. With it off, the same exchange runs on name and spelling matches and longer lists. That fits the existing Data Atlas promise ("Triage matches by keys, names and spelling without it, and says so"). Add V3's optional "what is it for?" later, as a field on the saved question rather than a step in the ask.

## Needs token (all are mixes of kit tokens, declared in `_src/common.css`)
- `--x-proposed-guess`, `--x-proposed-guess-wash`: the model's pencil (info mixed toward ink, dotted edge).
- `--x-proposed-loose`: a loose word, still in the person's words (warning mixed toward ink).
- `--x-proposed-here`, `--x-proposed-here-soft`: the floor accent as one alias.
- `--x-proposed-type-micro`, `--x-proposed-quiet`, `--x-proposed-gap*`, `--x-proposed-hatch`, `--x-proposed-unseen`, `--x-proposed-lit*`: carried from the catalogue and wear-and-time.
- `--font-mono` (IBM Plex Mono) is relied on for counts and tags; it still needs an ADR.

## Data the shell and Data Atlas don't have yet
A deployment calendar (seasons, financial year start) as data; which dated details of a kind count as "contact"; a count endpoint fast enough to price every choice before it's picked; "last heard from" across Artifacts and Data Atlas; and somewhere to keep a loose word, and what the question is for, on a saved question.
