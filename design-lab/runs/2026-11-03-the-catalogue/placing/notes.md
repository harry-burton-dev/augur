# Placing a new thing: critique

Surface 4 of the catalogue run. An operator on a Team floor (Ashby Road Crew,
under Highways and Depots) adds something to Data Atlas and finds its kind by
answering questions instead of picking a class from a list. Every path ends in
Triage; nothing skips it.

All six share one sample (`DATA`, top of each page's script, built from
`_src/data.js`): a regional services deployment with seven kinds (Site,
Vehicle, Equipment, Person, Supplier, Contract, Incident), their details,
counts, near matches, and Artifacts / Mandate as the honest redirect for
written things and asks. Two demo things:

- **Fits:** "Welfare cabin WU-07", a towed cabin. It keys out as Equipment,
  and the matcher finds "Welfare unit WU-7" already in Triage (one character
  off, same owner, different depot): probably the same thing.
- **Nothing fits (N):** "A614, Ollerton to Blyth", a stretch of road. No
  kind fits; it waits in Triage under **Unplaced**, the admin is asked for
  "Route or area", and the ask joins one Highways and Depots made earlier.

Shared parts on every page: a four-step strip (Say what it is, Find its
kind, Is it one of these?, Triage; on the no-fit path the last two become
Ask for a kind, Waits in Triage, drawn dashed); "Is it one of these?" cards
that say what matched (✓) and what differs (✗), and say plainly that matching
by meaning is off; the Triage slip, with every detail the kind expects (known
values, or a dashed gap naming **who could fill it**), who checks it, and the
links proposed; the waiting slip, with who decides, what's kept, what still
works (attaching documents) and what doesn't (linking); **S** shows the studio
words one step down (rail footer says so); **N** swaps paths, **R** replays,
`#misfit` and `#studio` load straight into those states.

Built by `_src/build.js` (common CSS/JS + one `.src` per variant);
`_src/keys-check.js` drives the keys and checks for console errors. No console
errors on any path at 1600×900 or 1280×800.

---

## V1: The key (`v1-key.html`)

*Idea.* A dichotomous key printed as one page: seven couplets, each with lead
a and lead b, leader dots running to "go to 4" or to a kind. The whole key is
always visible; your path lights up, the leads you didn't take are struck
through, unreachable couplets dim. The right column counts down "Still
possible" kinds until the key ends at one, or at a dashed "no kind yet".

*Sources.* Lamarck's *Flore françoise* (1778), the first dichotomous key;
Collins and FSC fold-out identification keys (leader dots, couplet numbers).

*What works.* Total honesty: you can read ahead and see why you'd end up
anywhere. "No kind yet" is a printed leaf of the key, not an error, so the
no-fit path feels designed for. The trail "1a → 2b → 4b" is a compact,
shareable reason for the steward and the admin.

*What fails or risks.* The key is authored by hand; with 30+ kinds it is
many couplets deep and the whole-page view stops fitting. One wrong early
answer sends you down the wrong half with no "not sure". Leads must be
written as true opposites, which is a real writing skill for admins.

*Principles.* Explain, never hide: strong (every couplet stays visible).
Calm: static at rest. Focus stacking: dims couplets off the path, a mild
version of rack focus. Letterbox: not relevant.

*Needs.* A key per deployment (authored in the studio, or generated from
kinds' distinguishing details). "Unplaced" Triage state.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4.

*New employee test.* **Yes**, with one caveat: "go to 5" reads instantly to
anyone who has used a field guide or a flowchart; others need one couplet to
get it.

*Words.* the key / decision tree over class axioms · kind of thing / class ·
no kind yet / unmatched individual · still possible / candidate classes.

## V2: Twenty questions (`v2-questions.html`)

*Idea.* One question at a time, yes / no / **not sure**, each picked to halve
what's left and saying so ("it splits the 9 left into 3 and 6"). Every kind,
plus Artifacts and Mandate, stays on the table as a tile that says what ruled
it out ("No to Q1"). When one kind is left, the game makes its guess as a
check ("Is it like this: carried, towed or set up?"); a no means nothing fits.

*Sources.* The parlour game; Shannon's halving question; a vet's
differential diagnosis (rule out, don't rule in).

*What works.* No authored tree: the questions come from what each kind "is"
(traits), so a new kind added by an admin just works. "Not sure" keeps
everything open, which is how operators actually answer. The ruled-out
reasons become the admin's evidence when nothing fits. Fastest of the six to
a result (3–4 answers).

*What fails or risks.* Least visual idea: it's a quiz. Questions need
careful wording per deployment ("Does it stay in one place?" is ambiguous for
a towed cabin parked for months). Adaptive order means two people placing the
same thing may see different questions, which is harder to teach.

*Principles.* Explain, never hide: strong (tiles never vanish, each says why).
Calm: one change per answer. Focus stacking: ruled-out tiles drop back.

*Needs.* Per-kind traits (yes/no facts) in the ontology, with plain question
wording; a confirm sentence per kind.

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4.

*New employee test.* **Yes.** Nothing to learn; reads like a conversation.

*Words.* question / class restriction · ruled out / disjoint class ·
still possible / candidate classes · not sure / unknown (open world).

## V3: Like this one (`v3-example.html`)

*Idea.* Choose what it's most like from a shelf of one example per kind
(from your floor). Then hold yours up to it detail by detail: has one (with
value), has one but not known (dashed gap, with who could fill it), or
doesn't have one (struck). All details could apply: same kind. Some can't:
"Not really a Site: 3 of 4 details don't apply", and the ask is worded from
the comparison ("like a Site, but along a line on the map").

*Sources.* Herbarium type specimens (the holotype a name hangs on);
Eleanor Rosch's prototype theory; the paint chip held up to the wall.

*What works.* Operators think in examples, not definitions; "it's like WU-03"
is how they'd say it. The comparison table previews the record's gaps before
it exists, which serves "every record shows what it could hold". The ask to
the admin writes itself.

*What fails or risks.* The shelf only works with a handful of kinds; at 30
it needs grouping or search, and picking from it is close to "pick a class
from a list". A badly chosen example (a weird record) teaches the wrong kind.
The demo assumes the operator knows which details their thing can't have.

*Principles.* Explain, never hide: good (the reason is a table of details).
Calm: rows fill in one by one, then stop. Object explains itself: yes.

*Needs.* A chosen type specimen per kind (admin picks, or most complete
record on the floor). Per-detail "can this kind lack it?" (cardinality).

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4.

*New employee test.* **Yes.** The most natural first move of the six.

*Words.* like this one / exemplar (type specimen) · detail / data property ·
doesn't have one / cardinality 0 · not known yet / expected property, no value.

## V4: Sorting frame (`v4-trays.html`)

*Idea.* A post-room sorting frame: nine labelled trays (seven kinds, "Written
down → Artifacts", and a dashed "No tray fits"). The thing travels as a parcel
tag; held over a tray, the tray's label checks the details it expects (✓ has,
dashed could have, struck can't). Tried trays keep their verdict. Dropping
into a kind shows what's already in that tray; dropping into "No tray fits"
sends the ask and the thing waits.

*Sources.* Royal Mail sorting frames; museum accession trays; the returns
slot.

*What works.* Physical and immediate; the fit check is the most concrete
explanation of "why this kind" in the run. "No tray fits" being a real tray,
the same size as the others, makes asking for a kind feel normal.

*What fails or risks.* Busy: nine trays of chips at once is a lot for a
day-one operator. Doesn't scale past ~12 kinds. You need to guess a tray to
try before anything helps you, so it rewards people who already know the
kinds. Drag (if added) is costly for keyboard users; arrows work today.

*Principles.* Explain, never hide: good. Calm: busiest at rest of the six,
though static. Conflicts mildly with hierarchy-without-containers (it's all
containers, deliberately).

*Needs.* Per-kind expected details with "can't apply" knowledge per thing,
which Data Atlas would have to infer from the operator's answers.

*Score.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 3.

*New employee test.* **Partly.** They get the metaphor at once but stall on
which tray to try first.

*Words.* tray / class · label / class definition · fits / satisfies
restrictions · no tray fits / ontology change request.

## V5: Slot finder (`v5-table.html`)

*Idea.* A periodic table of kinds: columns are what it is (Place, Thing,
Someone, Agreement, Happening), rows its shape (one, in one spot; along a line
or over an area; many counted as one). Two answers find the slot. Two kinds
can share a slot (Vehicle and Equipment, like group VIII) and a third question
splits them. Empty dashed slots are kinds the table **predicts** ("Route or
area", "Network", "Estate"), with how many asks each has; slots that can't
exist are hatched. Landing in a predicted slot *is* the ask.

*Sources.* Mendeleev's 1869 table and his gaps (eka-aluminium, found as
gallium); group VIII's shared cell.

*What works.* The best no-fit story in the run: the structure shows that
something is missing before anyone hits it, and "1 ask" on the slot tells you
you're not the first. The same table can be Data Atlas's front page (surface
2), so placing and browsing teach each other.

*What fails or risks.* Two abstract axes; "its shape" needs a moment's
thought for a day-one operator. The axes must be chosen per deployment and
not every ontology splits cleanly into a grid (the hatched cells are the
honesty tax). Predicted slots could read as promises.

*Principles.* Explain, never hide: very strong. Calm: one lit cell at rest.
Light language: the hit cell uses a soft bloom (`--glow-blur`), the only light
in the run, used once.

*Needs.* Two axes per kind (genus, shape) in the ontology; admin-curated
predicted slots; ask counting per predicted kind.

*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 4.

*New employee test.* **Partly.** "What is it?" is instant; "Its shape?"
needs one example. Admins and stewards will love it.

*Words.* what it is / superclass · its shape / dimensionality · predicted
kind / unpopulated class slot · nothing could go here / disjointness axiom.

## V6: A ___ that ___ (`v6-sentence.html`)

*Idea.* Say it as one sentence: "Welfare cabin WU-07 is **a thing** that
**gets carried, towed or set up**, and **is kept at Ashby depot**." The first
blank is what it is (genus), the second what sets it apart (differentia);
together they name the kind. Kinds with no maker yet appear in the second
blank as "no kind yet". Extra clauses become links. Near matches are shown as
the same sentence, with differences struck and replaced. With studio words
on, the sentence is also shown as the triple an admin would read.

*Sources.* Aristotle's genus and differentia; Linnaean diagnoses (one-line
Latin definitions); Mad Libs.

*What works.* The sentence is the definition, the explanation and the record
summary at once, and it's what the operator would say aloud. Near matches as
sentences make "same or different?" a reading task, not a comparison grid.
Links come for free. It's the only variant where the studio view (a triple)
sits naturally one step down.

*What fails or risks.* The blanks are still lists, though short ones (5 then
2–4). Differentia phrases must be authored well per deployment; bad ones
("is a material artifact") break it. Long sentences wrap awkwardly at 1280.

*Principles.* Plain words first: the clearest of the six. Explain, never
hide: good. Calm: very (text only). Hierarchy without containers: yes, weight
and underline do the work.

*Needs.* Per kind: a genus and a differentia phrase in plain words; links
phrased as verbs ("is kept at"); a sentence template per kind for near
matches.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit 4.

*New employee test.* **Yes.** It reads like filling in a form someone wrote
for you in English.

*Words.* what it is / superclass (genus) · what sets it apart / differentia ·
clause / object property (link) · the sentence / triple (subject, predicate,
object).

---

## Ranked

1. **V6 A ___ that ___**: the sentence becomes the operator's whole grammar
   of a kind.
2. **V2 Twenty questions**: the robust engine; no authored tree, "not sure"
   allowed.
3. **V5 Slot finder**: the best no-fit story; doubles as the shape page.
4. **V3 Like this one**: the most natural first move; weak at scale.
5. **V1 The key**: honest and printable, but authored and brittle.
6. **V4 Sorting frame**: tactile, but busy, and you must guess a tray first.

## What I'd build first

V2's question engine underneath V6's sentence. Each kind carries three things
in plain words: what it is (genus), what sets it apart (differentia) and a few
yes/no traits. The operator answers adaptive questions (V2, with "not sure"),
and the answers fill in the sentence as they go (V6), so the result is read
back, not announced. Near matches show as sentences with differences marked.
When the questions run out, the no-fit path borrows V5: the thing lands in a
predicted kind if the admin has drawn one ("Route or area: 1 ask, yours makes
2"), otherwise a free-worded ask built from the answers. It waits in Triage
under Unplaced, with who decides, what's kept and what still works. V3's "hold
it up against an example" is the fallback for people who get stuck: one
button, "it's like…".

## Answers for the shortlist

- **Gap mark vs "no record".** Different. Here a gap is a detail the kind
  expects that this thing doesn't hold *yet*, drawn as a dashed outline with
  who could fill it. Wear and time's "no record" is hatched and is about
  time (the record itself has a hole). A record can show both; they shouldn't
  look alike.
- **Ontology words for operators.** Kind, detail, link, near match, Triage,
  "no kind yet" and the genus words (place, thing, someone) are safe. Class,
  property, superclass, differentia, disjoint, cardinality and triple stay
  behind **S**.
- **Where it pushes back.** "Nothing skips Triage" is right, but the
  waiting thing has to stay *useful*: attach documents to it, find it, see
  who's deciding. Otherwise operators will force things into the closest kind
  to avoid the wait (each slip names that cost: "Address would be a gap
  nobody can ever fill").

## Needs token

- `--x-type-micro` (.6875rem; wear-and-time asked for it too)
- `--x-accent`, `--x-accent-soft`, `--x-accent-edge`: the current floor's
  accent as one alias, so a page doesn't hard-code which floor it's on
- `--x-gap-edge` → `--mark-gap`: dashed edge for an expected detail not held
- `--x-wait` → `--mark-waiting`: a thing waiting on a person, never alarming
- `--x-out` → `--dim-ruled-out`: opacity for a ruled-out option
- `--x-col-side`, `--x-cell` (layout only)

## Data Data Atlas doesn't give today

Per kind: a plain word and studio word, a genus and differentia phrase,
yes/no traits with question wording, a shape, a type specimen, expected
details with "can it lack this?", and counts. Per detail: who usually fills
it (the source or team). Predicted kinds with asks merged and counted. An
"Unplaced" Triage state that keeps answers and allows document attachments.
The matching basis (keys, spelling, meaning on or off) for each near match.
