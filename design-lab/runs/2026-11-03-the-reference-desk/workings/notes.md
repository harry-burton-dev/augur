# Surface 4 · The answer with its workings

One real-sounding question, asked by an operator on the Department floor:
*"which suppliers have we not heard from since spring?"*. Every variant shows
the result, the question said in a sentence, what was left out and why, how
sure it is, which steps used a model, and a way to change any step and watch
the answer move.

All six share one sample deployment and one answer engine. `_src/data.js` is
the single `DATA` object (21 suppliers with their contacts, five sources, one
call-log gap, a Team floor you can't open, a keeper for gaps, an intent in
Mandate), `_src/engine.js` runs the question, `_src/chrome.js` holds the rail
and the choices for each step (each choice shows the answer it would give), and
`_src/build.js` inlines them with `base.css` into each `v*.html`. Swap `DATA`
and every name, date, count, keeper and reason follows.

**The default answer:** 7 not heard from since 1 March 2026; 2 more if the
model's matches are wrong; 1 we can't tell (no contact ever recorded); 1 less
sure (they phone, and the call log has a gap); 2 left out (finished, paused);
"some" on Coast works crew, not yours to see.

## What every variant shares (the rules this surface found)

- **A guess is drawn in dots, never in a colour.** Facts are solid. A model's
  guess has a dotted underline or dotted border plus the `bot` icon and the
  word "guess" or "a model". This works in greyscale and for colour-blind
  readers, and it doesn't use up a floor or status colour.
- **Who set each step** is a chip: *you chose*, *the desk's default*, *a
  model's reading, you confirmed*.
- **The plain-words query is built from the steps by a template, never
  written by a model.** So the sentence can't claim more than the query does,
  and it reads the same every time (V3 says this out loud).
- **G turns the model gateway off** in every variant. Only two steps change:
  reading "heard from" (without a model, the desk shows the list unticked and
  asks you) and linking by meaning. Everything else runs on keys, names and
  spelling, as Data Atlas already does.
- **The six ways to be empty** carried over: corner ticks (not known yet, with
  who could fill it), wavy break (no record: the call-log gap), 135° hatch with
  a lock (not yours to see, shown as "some").
- **T** shows the technical query one step down (two registers).

### Which steps need the model gateway (the same in all six)
| Step | Without the gateway | With it |
|---|---|---|
| Where to look (floors, access) | works | no change |
| Contracts that count | works | no change |
| "Heard from" means… | you tick what counts | a model proposes the kinds, you confirm |
| Since spring | works: the desk offers the deployment's date words (1 Mar, 20 Mar, 1 Apr financial year) | no change |
| Linking contacts to a supplier | number, exact name, close spelling (pg_trgm) | adds matching by meaning (a guess) |
| Saying the answer | template | template, never the model |

---

## V1: The method card (`v1-method-card.html`)
*Idea.* The answer on the left and a numbered method on the right, one line per
step: the question it answers, the setting (a word you click), who set it, and
what the step did ("leaves 19, 2 left out, why"). Every choice in a step's
popover shows the answer it would give. After a change, a strip says who
joined or left, with Undo. Demo: opens "since", picks 1 April, and Brightwater
Labs joins (7 → 8).

*Sources.* Recipe and method cards; "explain the SQL" studies (show the
generated query back in steps); Shneiderman's dynamic queries for the
previewed counts.

*What works.* The most familiar of the six: it reads like instructions. The
counts make each step accountable. The change strip answers "what did my
change do?" without the reader having to compare lists. The new employee test
passes: you can follow it top to bottom without knowing the data.

*What fails or risks.* At 1280×800 the method scrolls, and the final "what
that leaves" line falls below the fold. Two parallel columns split the eye.
Left-out records hide behind a "why" link, so they are one click from view
(not hidden, but quiet).

*Principles.* Explain-never-hide: strong. Calm: the only motion is the rolling
count and one lit row after a change. Focus stacking: not used. Letterbox: not
relevant.

*Needs.* `--mark-guess` (dots), `--lit` and `--lit-wash`, `--type-micro`. The
engine needs every step to be re-runnable alone so it can preview each choice.

*New employee test:* **pass.**
*Model gateway:* step 3 (reading "heard from") and step 4 (meaning) only.

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V2: The reconciliation (`v2-reconciliation.html`)
*Idea.* The answer is a sum. Start with 21 kept here, take out each group on
its own line (no running contract, heard from, heard only by a model's match,
can't tell), and finish on a double rule with the answer. Each "less" line
names its members and has a checkbox. Untick the model line and the two
guesses come back into the answer. A "check" line shows the arithmetic. Demo:
the lines print like an adding-machine tape, then the model line is unticked
(7 → 9).

*Sources.* Bank reconciliation; tax-return lines ("less:"); the
adding-machine tape.

*What works.* Nothing can drop out silently: every supplier is accounted for
on exactly one line, and the sum proves it. "Trust the guess or not" becomes
one tickbox, the most direct control in the six. It is ideal for an auditor or
a manager who wants to check the answer.

*What fails or risks.* Arithmetic framing suits counting questions but not
"what do we know about this port". The order of lines matters (heard-from
before guess) and isn't obvious. Operators who fear numbers may balk.

*Principles.* Explain-never-hide: the strongest, because the sum forces it.
Calm: yes.

*Needs.* A double-rule total style. Every step must report its "out" set, not
only what's left.

*New employee test:* **pass**, provided they can read a statement.
*Model gateway:* only the "heard only by a model's match" line. With G off,
its checkbox is disabled and says why.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 4

## V3: The reply with notes (`v3-reply-with-notes.html`)
*Idea.* A reference librarian's written reply: "Seven suppliers with a running
contract… Ridge Roofing is the least certain… Two more would be on the list if
a model's matching is wrong…", with numbered side notes holding the workings
(records read and their sources, the call-log gap, the model's guess with
Confirm / Not them, the gap and who could fill it, what was left out, the
floor you can't see). Words in the prose can be changed in place. Choosing a
note focuses its sentence and dims the rest (rack focus, no scrim). Demo: the
notes arrive, then note 4 (the model's guess) is focused.

*Sources.* Reference-desk replies (the reference interview); Tufte's side
notes; a critical apparatus.

*What works.* The most human and the best at nuance: "less certain", "no
telling", "would be on the list if…" read naturally. A banner states that the
sentences come from a template, not a model, so the prose never carries a
model's guess as fact. Good to paste into an email or an intent in Mandate.

*What fails or risks.* Prose doesn't scale past about 15 names. Lists in
sentences are slow to scan. The template wording must be written for each kind
of question (cost). A first-person tone could be mistaken for a chatbot; I kept
it impersonal on purpose.

*Principles.* Focus stacking: yes, the note focuses its sentence. Explain:
strong. Calm: yes.

*Needs.* Sentence templates per question shape (the catalogue already asked
for one per detail). Superscript-note pattern in the kit.

*New employee test:* **pass, best of six** for "what does this mean?";
weakest for "is X on the list?".
*Model gateway:* note 1 (reading) and note 4 (matching). The prose never.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 5

## V4: The line you move (`v4-line-you-move.html`)
*Idea.* Each supplier is a row, each contact a dot on one time line (solid for
a record, dotted ring for a model's match, hollow for one that doesn't count).
"Since" is a lit vertical line you drag or nudge with arrow keys. Rows are
sorted by their last contact, so the answer is the block to the left of the
line. The call-log gap is a wavy band across all rows. Chips on the right
change the other steps, each showing the change it would make. Demo: the line
slides from 1 March to 1 April and Brightwater crosses.

*Sources.* Shneiderman's dynamic queries and HomeFinder; strip plots.

*What works.* "Since spring" stops being an argument: you can see Harrow two
days before the line and Brightwater three days after. It is the only variant
where the evidence is the answer. Gaps in sources show where they bite.

*What fails or risks.* Only works for questions with one time axis. With 200
suppliers rows get thin, and it needs grouping or an "only near the line"
view. Dots by kind are told apart only on hover (no shape per kind). Dragging
must stay keyboard-reachable (done with arrows and Shift).

*Principles.* Explain: strong. Calm: still at rest. Light language: the line
is the one lit thing (a beacon).

*Needs.* The lit-line token. A time-axis component in Quill. The engine must
return every contact, not only the last.

*New employee test:* **pass** for this question; unclear for questions that
aren't about time.
*Model gateway:* the dotted rings (meaning matches) and the "what counts"
card; the line, rows and sort need no model.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V5: The edges of the answer (`v5-edges.html`)
*Idea.* Each step is a fence: show the cases nearest it on both sides ("just
inside: Harrow Electrical, email 27 Feb, 2 days before"; "just outside:
Brightwater Labs, meeting 4 Mar, 3 days after"), then every what-if as a chip
with its effect (+1, −1). Point at a chip and the answer on the left previews
it (dashed ghost rows), and click to make it so. A last card is "on the
fence": the cases the record can't settle (less sure, can't tell, not yours to
see). Demo: the fences appear, then "From 20 March" is previewed.

*Sources.* Distinguishing cases in law; boundary-value testing; consequence
preview (cinematic run).

*What works.* It shows only where the question is fragile. An operator learns
which choices actually matter (dates do, meetings do; status barely does).
Previewing on hover is the cleanest consequence preview of the six. "On the
fence" is a new, honest place for the not-sure answers.

*What fails or risks.* It is abstract: "just inside / just outside" needs a
sentence of teaching on first use. Choosing which cases are "near" is
per-step logic (cheap for dates, harder for categories). Hover previews over a
long working day could feel twitchy, so they could be limited to focus/Tab.

*Principles.* Consequence preview: the strongest. Explain: strong. Calm: only
on pointing.

*Needs.* A ghost-row style (dashed lit). Engine diffs for every alternative
(the shared engine already does it). A "nearest case" rule per kind of step.

*New employee test:* **partial.** They grasp it after the first preview, not
before.
*Model gateway:* fences 2 (reading) and 3 (meaning cases dotted); the
"just inside/outside" logic is plain comparison.

*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 4 · Fit 4

## V6: Two hands (`v6-two-hands.html`)
*Idea.* The answer is worked twice, from the record alone (9) and with the
model's help (7), and the screen shows only where the two differ. Each
difference sits between the two columns with the model's evidence and two
buttons: "It's them: propose" (sends the match to Triage; it stays a guess
until accepted) or "Not them" (both hands now agree). Above it, a lane of all
six steps marks which used the model. A footer logs the gateway: calls for
this answer, written to the audit log before each call, 14 of 500 used today.
Demo: the lane builds, the first difference is proposed to Triage, the second
is focused.

*Sources.* Double reading in breast screening (two readers, a third settles
disagreements); tracked changes.

*What works.* It answers the prompt's hardest question directly: you tell a
model's guess from a fact because the guess is the *difference* between two
answers. A confirmed guess goes through Triage, the path every proposal
already takes in Data Atlas, so the model never writes a fact. The lane is the
clearest map of what needs the gateway. Calm: with no differences, the middle
says so and nothing asks for you.

*What fails or risks.* It doubles the compute (two runs), which is cheap here
but not for big graphs. Agreed rows are pushed down; at 1280×800 they need a
scroll. Only the model's effect is compared, not other step choices.

*Principles.* Explain: strong. Calm: strong. Dark when normal: if the two
agree, there's nothing lit.

*Needs.* "Proposed from an answer" as a Triage source; a gateway call count
per app and day (the gateway already enforces the 500 limit; the shell would
need to read it); a dotted evidence box in the kit.

*New employee test:* **pass.** "Here's what a computer guessed, is it right?"
is understood at once.
*Model gateway:* lane steps 3 and 5. The record-only column never uses it.

*Score.* Clarity 5 · Distinctiveness 5 · Feasibility 4 · Fit 5

---

## Scores
| Variant | Clarity | Distinct | Feasible | Fit | Total |
|---|---|---|---|---|---|
| V6 Two hands | 5 | 5 | 4 | 5 | 19 |
| V1 Method card | 5 | 3 | 5 | 4 | 17 |
| V3 Reply with notes | 4 | 5 | 3 | 5 | 17 |
| V2 Reconciliation | 4 | 4 | 5 | 4 | 17 |
| V4 Line you move | 5 | 4 | 3 | 4 | 16 |
| V5 Edges | 3 | 5 | 4 | 4 | 16 |

## Ranked
1. **V6 Two hands**: the answer to "how do I tell a guess from a fact".
2. **V1 Method card**: the default layout for any answer.
3. **V2 Reconciliation**: the checking view, one tab away from V1.
4. **V3 Reply with notes**: the shareable form, for pasting into Mandate or
   an email.
5. **V4 Line you move**: a special view for time questions.
6. **V5 Edges**: keep its hover preview and "on the fence"; drop it as a
   screen.

## What I'd build first
V1's method card as the body of every answer, with three parts taken from the
others: V6's step lane and "where the two differ" block on top whenever the
gateway is on (empty and dark when the two agree), V2's one-line check
("21 − 2 − 9 − 2 − 1 = 7") under the total so nothing can drop out unseen, and
V5's hover preview on every choice. V3's reply is the same data run through
templates, so it comes nearly free as the "share" view. The engine is the real
work: each step must run alone, report what it took out, and say whether it
used the gateway. That is what the shared `_src/engine.js` sketches. I went
beyond the brief by saying that **the answer's sentences must never be written
by a model**. A template keeps the plain-words query and the actual query the
same thing, and it is the rule I'd ask Harry to adopt.

## Needs token (all `--x-proposed-*` in `_src/base.css`)
`--mark-guess` (dots and dotted wash) · `--lit`, `--lit-wash` (the answer's own
light) · `--type-micro` · the catalogue's gap, stale and unseen marks, plus a
no-record wave · `--here`, `--here-soft` (floor alias) · `--quiet`.
`--font-mono` is used throughout (still needs an ADR).

## Data the shell doesn't have yet
Contacts as Data Atlas observations with their source and match method; source
coverage (from-date, gaps); per-supplier "usual channel"; a daily gateway call
count readable by apps; a "proposed from an answer" path into Triage.
