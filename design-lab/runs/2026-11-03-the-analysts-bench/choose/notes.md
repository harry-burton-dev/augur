# Choosing a technique

Six ways for a person to say what they are trying to decide and be offered **one** technique, with why, its price said first, and what it leaves behind. All six run on the renewal (INT-208, Facilities, Vale Regional Services) and share the offer card (`offerHTML` in `_src/lib.js`): the technique's plain name, minutes and people, why this one, what you get, where it is kept, Start and Not now. **R** replays, **T** shows trade names, **G** turns the model off.

The rule under all six: **one offer at a time, in the order a decision needs them** (why before what next, test before commit). Other techniques that also fit are named quietly as "later" or "also fits", never offered as a menu.

---

## V1: Say it plainly
*Idea.* A text box: "What are you trying to decide? Say it as you would to a colleague." Sam types "We need to decide whether to renew Calder on the North round, now that collections have got so much worse since July." The model reads the sentence **in pencil**, underlining the phrases it heard ("decide whether to renew" sounds like *about to commit*; "got so much worse" sounds like *why did this happen*). AUGUR offers competing explanations first, because you can't test a plan to fix something until you know why it broke, and queues imagine it failed for before signing. The six questions sit underneath, so the person can correct a misreading in one press.

*Sources.* Cynefin's point that method follows situation; the reference desk's "ask only what changes".

*What works.* The person never names a technique. Showing what the model heard, as underlines in their own words, makes a misreading obvious and cheap to fix. The "then" line handles the commonest real case: one sentence holding two questions.

*What fails or risks.* Free text invites long, mixed sentences; the reading will be wrong often enough that people learn to skip to the six questions. With the model off it falls back to those six, which is fine, but then V1 is just the key with a text box. The underline colour (lit) for the chosen reading competes with focus colour.

*Principles.* Explain, never hide: strong (the model's reading is shown). Pencil and ink: the reading is pencil; the offer is chosen by rule from the picked question. Calm: types, reads, offers once.

*Needs.* A short classifier in the model gateway that returns phrase spans and a kind, never a technique. The six kinds as product grammar.

*Test.* On 50 real sentences, the model's top reading should match the person's corrected choice at least 80% of the time; if not, lead with the six questions and keep the box as a shortcut.

*Score.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4.

## V2: One question
*Idea.* AUGUR asks almost nothing. It lists what it already read, with where from: the intent's kind and due date, the notice date on the contract, the missed-collection fact and its word, Calder's explanation cited in the draft, the drafted plan, and the gap ("No explanation is recorded on the intent"). Then it asks the **one question that changes the offer**: "Has anyone worked out why service fell?" Each answer shows where it leads before it is chosen; two answers leading to the same place say so.

*Sources.* The reference desk's ask-only-what-changes; clinical triage questions; the Tradecraft Primer.

*What works.* It is the cheapest start in the run: one click. Showing what was read (and its source) is honest and lets the person correct a wrong premise. The answer "We think so, but nobody has checked" is the one most people would pick, and it leads to the right technique.

*What fails or risks.* It depends on the intent being rich (kind, due date, cited facts, a draft plan). On a bare intent there is nothing to read, and it degrades to the key. Choosing *which* question changes the offer is itself a rule per kind of intent that someone has to write.

*Principles.* Explain, never hide: very strong (six things read, each sourced). Calm: one question.

*Needs.* Per intent kind, a short decision table: which records to read, which single question splits the offers. Data: intents that carry their kind, due date and cited facts (Mandate has most of this).

*Test.* Median clicks from opening to a started technique should be 2 or fewer. If people often change the pre-read lines, the reading is wrong and the page says which line.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5.

## V3: Pause points
*Idea.* The decision's own timeline, from the question being set to the notice date, carries **three pause points**, as the WHO surgical checklist has sign in, time out and sign out: *sign in* when the question is set (how it usually goes; why it went wrong), *time out* when a plan is on paper (check the assumptions; check the sources), *before signing* (imagine it failed; the case against). Today's pause point is lit with its offer; past ones show their results; later ones say "queued, not offered yet". ← → moves today.

*Sources.* WHO Surgical Safety Checklist (2009); Klein's premortem as a pre-commitment step; Mandate's intent timeline.

*What works.* It answers "when?" as well as "which?", and it is calm: nothing is offered between pause points. Each pause point names its fallback ("or check the sources, 10 min, if time is short"). A skipped technique says so on the intent rather than vanishing.

*What fails or risks.* Pause points per decision kind are a process someone must agree, and they can feel bureaucratic for small decisions. Dates come from the intent; if a decision moves fast, pause points stack up on one day.

*Principles.* Explain, never hide: strong (skipped and queued are both shown). Calm: very (one offer, at one time). Focus: the lit pause point is the lit path.

*Needs.* Pause points per intent kind in Mandate (three, named, each with a default technique and a fallback). A "skipped, with reason" state.

*Test.* For decisions of a kind with pause points, at least two of three should have a result or a skip reason by the decision date. Below that, the pause points aren't reaching people.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5.

## V4: In the margin
*Idea.* Nobody asks. While Sam writes the briefing in Artifacts, **rules on the records** spot sentences a technique would test, and offer one in the margin, one at a time: "Calder says most were road closures" rests on one source written by the supplier, so *check the sources*; "Recommendation: renew" on a contract decision, so *imagine it failed*; "back by June" is a forecast with no starting count, so *how things like this usually go*. Other spotted sentences sit as quiet dots. A dismissed offer doesn't come back for that sentence.

*Sources.* Clinical decision support's just-in-time prompts (and their alert fatigue); the Tradecraft Primer.

*What works.* It is the only variant where the technique arrives at the point of work without being sought. The rules are records rules, not the model, so G changes nothing, and each offer can say exactly what triggered it. One offer at a time keeps it calm.

*What fails or risks.* Margin prompts are where alert fatigue starts; three per briefing is the limit before people stop reading them. Rules like "one supplier-written source" need source authorship in Data Atlas. It needs Artifacts to tell which sentence cites which fact.

*Principles.* Explain, never hide: strong (each offer names its trigger). Calm: one at a time, dismissals stick. Shell owns loudness: the margin is the app's, never a toast.

*Needs.* Sentence-level citations from Artifacts to Data Atlas facts (the briefing run's need). Source authorship ("written by the subject"). A small rules table per technique.

*Test.* Dismissal rate per rule: a rule dismissed more than 70% of the time over a month is switched off for that floor, and the bench says so.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4.

## V5: What paid before
*Idea.* The offer comes from the organisation's own record: eight bench runs on "renew or end a contract" decisions since 2025, grouped by technique. A filled square **paid** (changed a term, a date or a condition), an empty one changed nothing, and one run on the Housing floor is hatched: *not yours to see*. Imagine it failed has paid 2 of 2 visible runs; it is offered, with a note on what "paid" means and doesn't.

*Sources.* Tetlock and Gardner's keeping score; case-based reasoning.

*What works.* It turns the bench into something that learns, without a model. "Paid" is defined as changing a line, which is checkable; the page says plainly it does not mean the decision went well. A run on a floor you can't open still counts in the tally and says why it is hidden.

*What fails or risks.* Small numbers: eight runs is anecdote, and a tie (2 of 2 for two techniques) is broken by order, which looks arbitrary. It favours techniques that were used, not ones that would have helped. The record needs a year of use before it means anything.

*Principles.* Explain, never hide: strong (hidden runs counted and marked). Calm: one offer.

*Needs.* The bench's result records with "changed a line" and the intent kind; floor access applied to them.

*Test.* The record is only used to choose when a technique has two or more runs you can see; otherwise the key decides, and the page says so.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4.

## V6: The time you have
*Idea.* The person says how long they have (5, 10, 15 or 30 minutes) and who can join (just me, two of us, the team). For "We sign on 10 Dec. What could go wrong?", the preferred technique is imagine it failed; with 15 minutes alone, check the assumptions fits instead, and a warning-edged line says **what you give up**: "Nobody else imagines it failing, so reasons only the depot or Finance would think of are missed, and you get no watches from them." With 5 minutes, nothing fits; the page says so and offers to hold a slot before the due date.

*Sources.* Klein; the cinematic run's consequence preview.

*What works.* It respects the operator's real constraint and is honest about the trade. Nothing that doesn't fit is hidden; each says what it needs. "Nothing fits" is a real answer with a next step.

*What fails or risks.* It could train people to always pick 15 minutes alone. The give-up sentences are hand-written per pair of techniques, which doesn't scale beyond six.

*Principles.* Explain, never hide: strong. Consequence preview: the give-up line. Calm: one offer.

*Needs.* Per technique, a minimum time and number of people. The give-up sentences as product copy.

*Test.* If more than half of commit-stage runs pick a cheaper technique than the preferred one, the page is being used to avoid the premortem; show the give-up line before the choice, not after.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 4.

---

## Ranked
1. **V2 One question.** Read the records, ask one thing. The default way in from a Mandate intent.
2. **V3 Pause points.** When to offer, not only which; the calmest variant.
3. **V4 In the margin.** The way in from a document, by rules on records.
4. **V6 The time you have.** The fallback when the preferred technique doesn't fit, with its cost said.
5. **V1 Say it plainly.** Useful as a shortcut once the six questions are learnt.
6. **V5 What paid before.** Keep it for when the record exists (a year in).

## What I'd build first
**V2's one question on top of V3's pause points**, in Mandate: each intent kind declares three pause points, and at each AUGUR reads what it can and asks the one question that splits the offer. V4's margin rules come next, from Artifacts, once briefings cite facts by sentence. V6's give-up line goes into the offer card whenever the person picks something cheaper than offered. I went beyond the ask in V3: pause points per decision kind are a new idea for Mandate, and need Harry's decision.

## Needs token
Nothing new beyond the grammar's list. The offer card uses lit, pencil and disagree (for the give-up line).
