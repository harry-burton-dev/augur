# Surface 5 · When the data can't answer

Honest gaps, partial answers that say what share they cover, "I don't know"
as an answer, and who to ask or what would need adding.

All six share one sample deployment (Halden Regional Services; Rosa Lind, an
operator on the Facilities Department floor) and three questions:

- **"Which suppliers have we not heard from since spring?"** (V1, V4, V5, V6):
  48 suppliers you can see plus some on the Finance team floor. 32 of the 44
  it applies to are answered (8 silent from the record, 2 that Priya Shah
  checked: "none"), 7 not known yet, 3 out of date, 2 no record (the lost
  depot inbox), 4 don't apply (contracts ended before March).
- **"Which of our vans are due their MOT next month?"** (V2): nothing can
  answer it; Data Atlas has no place for an MOT date.
- **"Has anyone reported damp at Upton care home this year?"** (V3): a search
  that finds nothing.

The data is one `DATA` object at the top of each page. `_src/build.py` makes
it and inlines `common.css` and `common.js` into each `v*.html`; swap `DATA`
and every name, count, keeper and floor follows. Every page: auto-demo at
1.2 s, `R` replays, `T` technical words, `G` turns the model gateway off and
on so you can see what still works without it.

## What runs under all six

**The six ways to be empty**, carried unchanged from the catalogue run, now
used at the level of an *answer* rather than a slot: each supplier the answer
can't speak for is one of not known yet (corner ticks, names who could say),
out of date (45° hatch), no record (wavy break, "nobody can close this"),
not yours to see (135° hatch, lock, whom to ask, count shown as "some"),
doesn't apply (quiet), or none (a person checked: it counts as answered).

**Ink and pencil.** Anything from the record is ink: solid, with its source.
Anything the model wrote or guessed is pencil: graphite (`--x-proposed-pencil`),
dashed underline or dashed box, a `GUESS · MODEL` chip, and it **never moves a
count**. Confirming a guess is what turns it into ink. Turning the gateway off
(`G`) removes the pencil and changes no number, which is the test that the
answer never depended on it.

**Which steps need the model gateway** (the same split in every variant):

| Step | Without the model | With it |
|---|---|---|
| Read "since spring", "next month", "this year" | Date words the deployment keeps (spring = 1 March; financial year from config) | Odder phrasing ("since the thaw") |
| Read "heard from" | The desk's word list, kept by an admin (invoice, meeting note, call log) | Suggests more kinds (emails), shown in pencil |
| Find each record | Keys, names and spelling (Data Atlas's own matching) | Matching by meaning in documents ("condensation" for damp, "Kelso DC Ltd") |
| Count, coverage, range, who could fill | Always without; never the model | Never |
| Draft a Mandate ask | A template that quotes the question | A friendlier draft, in pencil, editable |
| Guess a missing value | Not offered | Pencil only, not counted, not saved |

**A new finding: a seventh, question-level state.** The six marks describe a
slot. V2 needed one more for the *question*: **no place for it** (the
structure has no detail an answer would need; vans have no "MOT due"). It
borrows the not-known-yet corners because it is the same idea one level up
(the structure predicts its gaps), but its route is different: a Mandate ask
to an admin, not a question to a keeper.

**A second finding: not found is not none.** A search that finds nothing must
say how much it searched (V3). "None" is only earned when someone looked
everywhere it could be, or a person says so.

---

## V1: The base line
*Idea.* Every partial answer carries an opinion poll's base line: "It covers
32 of the 44 suppliers it applies to (73%). For 12 I can't say yet, and there
are some I can't see." Under it one strip, a cell per supplier, grouped by how
the answer stands, with each group in its empty mark; rows below say why each
group falls short and what would close it; the side panel names who could
fill each gap, with pencil guesses beside them.

*Sources.* Opinion-poll and survey "base" lines ("Base: all adults, n=1,024");
census response-rate reporting; the catalogue run's six marks.

*What works.* The answer and its edge arrive together: "10 suppliers ... Maybe
more: this answer doesn't cover every supplier." The base line is one
sentence an operator can repeat to a manager. The strip makes "73%" physical
and the hidden tail fades instead of showing a number. Cheap: one sentence
template, one strip, the six marks the kit would already have.

*What fails or risks.* The strip needs the rows to decode it; on its own it is
a barcode. "Covered" and "applies to" are two denominators; operators may mix
them. At 1,000 records a cell per record becomes a bar and loses "each one is
a supplier". Rows scroll at 1280×800.

*Principles.* Explain, never hide: every group says why and who. Calm: deposits
once, nothing loops. Focus stacking and letterbox not used (this is not
urgent).

*Needs.* Tokens: the six mark tokens, `--x-proposed-pencil`. Data the shell
doesn't have: per-record coverage state for an answer, keeper per record,
"some" counts across floors.

*New employee test.* **Passes.** The headline and the base sentence read
without help; the strip is learned from the rows in one look.

*Model gateway.* Needed only for the "read minutes and plans" step (3 pencil
guesses). Everything else, including every number, works without it.

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V2: Not supplied, yet
*Idea.* When nothing can answer, "I don't know." is the answer, set as large
as a number would be, on a slip modelled on an inter-library loan "unfilled"
notice: a fixed list of reasons with the ones that apply ticked (no place for
it, only an old copy, kept elsewhere), the nearest thing it can give (ink:
19 of 23 vans are in a 2025 register; pencil: the model thinks about 4 are
due), and three routes, quickest first: ask the Fleet coordinator today, make
a Triage job from the old register, or send a Mandate ask to add "MOT due".

*Sources.* ILL unfilled-request reason codes (ISO 10161 "not supplied"
reasons); the reference desk's referral; the catalogue's "structure predicts
its gaps".

*What works.* The strongest "I don't know" of the six: it reads as a real
answer, not an error page. The fixed reason list means the same reasons in
the same order every time, so an operator learns them, and unticked ones
still show what was ruled out ("Not found: the vans are there"). The routes
say what each changes ("Once added, all 23 vans show it as not known yet, and
Sam is asked to fill them"). The question is kept and re-answered when a route
lands. Gateway off: the pencil box becomes "2 rows say MOT" by spelling.

*What fails or risks.* The stamp is decoration and could feel cute by the
fiftieth time; keep it to the date. "Message Sam" sends the answer outside
Data Atlas, so the next person asks again (the slip says so, but it is the
easiest button). The reason list must stay short (six) or it becomes a form.

*Principles.* Explain, never hide at its fullest. Consequence preview on each
route. Calm.

*Needs.* A "no place for it" state at question level; a document-to-Triage
job ("read this spreadsheet in"); Mandate ask with a quoted question; a kept
question that watches for routes landing.

*New employee test.* **Passes best.** "I don't know" plus ticked reasons is a
form people have already met.

*Model gateway.* Reading the free-text Notes column (the "about 4" guess) and
drafting the ask. Finding the 19 vans by registration, the reasons and the
routes work without it.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V3: Where I looked
*Idea.* A search that finds nothing shows its search chart: places down,
months across, each cell marked looked-nothing, looked-maybe (a pencil ring),
out of date, no record, not yours to see or doesn't apply. The headline:
"No report of damp found. That isn't the same as none." The side says what
would turn "not found" into "none": ask the care home's manager to look in
her own log (then it becomes "none: Joy Mensah checked", a fact), re-read
the contractor's reports since June; the lost phone log can never be closed.

*Sources.* Search-and-rescue sector plots and probability of detection; an
archaeologist's trench plan (excavated / unexcavated / disturbed); the
catalogue's no-record mark.

*What works.* The single clearest picture of *how thorough* an empty answer
is. The time axis makes stale and lost visible as shapes (the hatch starts in
June; the break covers Jan to Mar). Gateway off is legible in place: the
Inspection notes row turns to "spelling only", the June maybe disappears, and
the sentence says "a note that says 'condensation' would be missed". Strong
for safety questions where "none" matters.

*What fails or risks.* The count is of place-months, analyst thinking; the
sentence says "checked 47 of 67 months across these places" instead. Only works for questions with a time range and a handful
of places; seven rows is near the limit. Grid cells as large as these cost
nothing here but the pattern invites a heatmap of hundreds of sources.

*Principles.* Explain, never hide; the-object-explains-itself (each cell has
its why). Calm: the sweep reveals once.

*Needs.* A list of "places a fact like this could be" per kind (Data Atlas
kinds plus Artifacts libraries), with each one's last read date and access;
a lost-window record per source (wear and time's no record).

*New employee test.* **Partly passes.** The headline lands at once; the grid
takes a minute and the legend is needed.

*Model gateway.* Matching by meaning in Inspection notes (the June
"condensation" maybe). The rest is keys and spelling.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit 4

## V4: Hand it on
*Idea.* The gap turned into work, previewed before anything is sent. Tick
asks (ask the contract managers, re-read the contractor reports, ask for
contact to be kept, ask Finance for access); see one round of small questions
per person ("When did we last hear from Ashdown Pest Control?") with the
model's hints in pencil; and a before/after strip: now 73%, if they answer
95%. "Still open after: 2 with no record, which nobody can close. Some stay
not yours to see."

*Sources.* The reference desk's referral slip; the cinematic run's consequence
preview; the catalogue's change-arrives-as-work rounds.

*What works.* It answers "who to ask" with a button, not advice, and the
operator sees exactly what each person will get. The preview strip makes the
value of asking concrete. The pencil hints help the person asked ("met in
June?") without being stated as fact. Gateway off: hints vanish, the ask
draft becomes a template; the round is unchanged.

*What fails or risks.* It is the place where a question becomes load on
colleagues: one curious operator could send 40 questions. Needs a limit and
"someone already asked this" merging. Less distinctive: it reuses known
patterns well.

*Principles.* Consequence preview, explain-never-hide (what stays open is
said before sending). Calm.

*Needs.* Triage jobs addressed to a keeper; a question-per-record template;
a share request scoped to one question; merging duplicate asks.

*New employee test.* **Passes for the action.** The strips are optional
decoration to a newcomer; the person cards carry it.

*Model gateway.* Hints on the questions and the Mandate ask draft. Rounds,
counts and preview work without it.

*Score.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V5: The answer is a range
*Idea.* A partial count is given as a range, "10 to 22 suppliers", the way
election nights give ranges: certain from the record (solid), can't say
(dashed bracket, each slot in its empty mark), ruled out, and a fading tail
for some hidden. The model's guess sits in its own lane above the line, a
pencil tick at "about 19: it thinks 3 of the 12 were heard from", and never
touches the line. Below: what would narrow it most, ranked by how much each
ask shrinks the bracket; the lost inbox says "never".

*Sources.* Election-night projections and "too close to call"; error bars and
interval reporting (IPCC likely ranges); the catalogue's six marks.

*What works.* Honest arithmetic in one phrase an operator can repeat: "at
least 10, maybe 22". The pencil lane is the clearest ink-versus-pencil
picture in the run: the guess is visibly *off the line of facts*. "What would
narrow it most" turns the gap into a ranked to-do with a payoff.

*What fails or risks.* Some people read a range as uncertainty about the
whole answer, not a known floor. The guess tick can still be read as "the
answer is 19" by a hurried reader; the chip and the lane label carry a lot.
Only works for counts.

*Principles.* Explain, never hide; calm.

*Needs.* Same as V1, plus a keeper per gap for the narrowing list.

*New employee test.* **Passes on the headline**, with a risk on the pencil
tick.

*Model gateway.* Only the pencil tick. The range is identical without it, and
the side says so.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V6: The weak word
*Idea.* The question parsed into its phrases, each hanging its reading under
it like a sentence diagram, so the gap is found in one phrase: "not heard
from" is drawn as a blank with corners (we keep invoices, meeting notes and
calls; for 12 suppliers none exist). "What counts as hearing from them" is a
row of chips that move the answer as you tick them (dynamic queries); emails
are pencil with the model and unavailable without it. Then the librarian's
"would one of these do?": rephrasings the data can answer in full ("not paid
since 1 March": 12, covers 100%), each saying how it differs from yours, and
"keep mine" with its gap said.

*Sources.* Reed and Kellogg sentence diagrams; "explain the SQL" studies of
natural-language interfaces; Shneiderman's dynamic queries; Dervin and
Dewdney's reference interview ("what do you mean by ...").

*What works.* It locates the gap in the person's own words instead of in the
data, which is how a librarian would say it. The rephrase cards are honest
about trade-offs (money is not contact). The chips make the meaning of a
word adjustable without a query builder.

*What fails or risks.* Parsing a question into phrases needs the model for
anything but the simplest grammar, so this layout degrades most without it
(the deployment's word list covers known phrases only). A newcomer may not
know why their phrase is "weak". It is closer to surface 2 (the ask) than to
the answer.

*Principles.* Plain words first, said in a sentence. Explain, never hide.

*Needs.* A phrase-to-meaning map per deployment ("heard from" = these kinds),
kept by an admin; coverage per record kind.

*New employee test.* **Partly passes.** The rephrase cards pass; the parse
needs one sentence of help.

*Model gateway.* Splitting free questions into phrases and suggesting emails
need it. Known phrases, the chips, counts and rephrasings work without it.

*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 4

---

## Ranked
1. **V1 The base line** (17): the base sentence and strip belong under every
   answer; cheapest and clearest.
2. **V2 Not supplied, yet** (17): the form for "I don't know", with fixed
   reasons and routes.
3. **V3 Where I looked** (17): the form for an empty search; "not found isn't
   none".
4. **V5 The answer is a range** (16): the best way to say a partial count,
   and the clearest pencil lane.
5. **V4 Hand it on** (15): the follow-through, built on V1's data.
6. **V6 The weak word** (15): belongs with the ask surface, not the answer.

## What I'd build first
V1's base line as a kit part: one sentence ("It covers 32 of the 44 it
applies to; for 12 I can't say yet; some I can't see") under every Data Atlas
answer, with V5's range wording ("10 to 22") when the answer is a count, and
each "can't say" group carrying its empty mark, who could fill it and one
button (V4's ask, kept to one round per keeper). Then V2's slip for the
zero-answer case, because "no place for it" is the only route to a Mandate ask
and the only one that grows the structure. All of it works with the model
gateway off; the pencil (guesses, hints, drafts) is added on top and never
moves a number.

**Where it goes beyond the ask:** the "no place for it" question-level state
and the not-found-versus-none search chart are new; both need a decision.

**Decisions for Harry:** (1) may a partial answer show its count without the
range ("10") or must it always say "10 to 22"? (2) does a person's "I checked:
none" count as a fact in answers (as built), and for how long? (3) limit on
how many asks one question may send.

## Needs token
All mixes of kit tokens, at the top of `_src/common.css`:
`--x-proposed-pencil` and `--x-proposed-pencil-wash` (the model's marks:
graphite, dashed); `--x-proposed-gap-ink`, `--x-proposed-gap-tick`,
`--x-proposed-gap` (not known yet), `--x-proposed-hatch`,
`--x-proposed-stale` (45°), `--x-proposed-unseen` (135°), `--x-proposed-quiet`
(carried from the catalogue); `--x-proposed-here`, `--x-proposed-here-wash`
(the floor you're on); `--x-proposed-fact`; `--x-proposed-type-micro`. All six
rely on `--font-mono` (still needs an ADR).
