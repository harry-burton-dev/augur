# Combined V3: Placing and waiting (`v3-placing-and-waiting.html`)

Built from `_src/b/` (`node combined/_src/b/build.js`): `data.js` is the one
sample shared with V4 (Northvale Regional Services: Ashby Road Crew, a team
under Highways and Depots, seven kinds in five families), plus `common.css`,
`common.js` and one `.src` per screen. Welfare cabin WU-07, placed here, is
the record an operator meets in V4.

**Combines:** placing V2 (twenty questions) under placing V6 (the
"A ___ that ___" sentence), placing V5 and shape V2 (the table of kinds, its
predicted slots), grammar V6 (two registers), card V2 (statements) and the
settled six ways to be empty.

## What it shows
1. **Operator (Dee Okafor, Ashby Road Crew).** One yes / no / not-sure
   question at a time, each saying how it splits what's left ("yes leaves
   Sites; no leaves Vehicles, Equipment"). Each answer fills the sentence:
   *Welfare cabin WU-07 is **a thing** that **gets carried, towed or set
   up**, and **is kept at Ashby depot***. Under it, every kind stays visible,
   saying which answer ruled it out. On the right, things already kept that
   match by name appear as sentences too, and drop back when an answer
   contradicts them ("Not yours: it has a registration; your answer 3 says
   otherwise").
2. **Case 1 (fits).** Welfare unit WU-7, already waiting in Triage, is
   flagged as *likely the same thing*. Dee says it's different. The record
   lands in Triage as a new Equipment with every detail it could hold: values
   with their source, **Not known yet** (corner ticks plus who could fill it),
   **None** (who checked, when) and **Doesn't apply**. Priya still sees both
   records side by side, because the tags are one character apart.
3. **Case 2 (fits nothing, key 2).** A614, Ollerton to Blyth answers "a place",
   then "no" to "has an address". The next question comes from the predicted
   slot: "runs along a line, or covers an area?". The sentence completes in
   the waiting colour as **no kind yet**. It becomes **Waiting in Triage**: it
   names who decides (Tom Rees, who looks after the kinds of thing), the slot
   it waits on (Route or area, asked for 4 times, 2 other things already
   there), and what's kept (the sentence, 4 answers, the note, the source and
   proposed links). It also says what still works (find it, attach documents)
   and what doesn't yet (linking). Forcing it under Site is offered only as a
   disabled button that says why.
4. **Admin (A).** The table of kinds: families across (Someone, Place, Thing,
   Agreement, Happening), floors down (Org, Department, Team), then a
   **Not kept yet** row of dotted predicted slots. Each waiting thing sits on
   the slot its answers point to, with the waiting count and the ask count.
   An empty team row explains itself. A margin row holds the honest leftovers:
   a waiting thing that fits no predicted slot, and Finance's own Triage,
   shown hatched and locked as "some things wait", never a number. The drawer
   shows the slot's waiting things as sentences and **Make it a kind, from
   Dee's sentence**. Name, family, "sets it apart" and the question come
   straight from her words; the starting details come from what people said,
   with counts. Enter makes the kind: the slot turns solid, the three waiting
   things become records with gaps marked, and their askers are told. Back
   on O, Dee's slip says it was placed.

Keys: Y / N / U answer, Enter "it's new", 1 / 2 the two cases, A / O switch
viewer, ← → move between slots, T technical words, R replay. Hashes:
`#misfit`, `#admin`, `#admin-made`, `#tech`.

## Critique
*Idea.* Placing is a conversation that writes a definition. The questions are
the engine; the sentence is what people read. When the conversation ends
with no kind, the thing doesn't fall into a generic queue: it lands on the
**slot the table predicted**, so the admin sees demand gathered in the same
place an operator would look for the kind.

*Sources.* Shannon's halving question and the parlour game; Aristotle's genus
and differentia; Linnaean diagnoses; Mendeleev's 1869 table and its gaps;
Wikidata statements; Isotype's transformer (two registers).

*What works.*
- One grammar runs end to end. The operator's sentence becomes the kind's
  definition, its placing question and the near-match wording, so the admin
  never has to translate "what did they mean?".
- Near matches as sentences, ruled out by named answers, make "same or
  different?" a reading task. The likely duplicate already in Triage is
  surfaced before a second record exists.
- Gathering on predicted slots turns scattered "no kind fits" asks into
  evidence: 3 things and 4 asks on Route or area, 0 on Estate. The table's
  layout is the argument for the kind.
- Waiting is a state with a person and a place, not an error. Everything
  said is kept, so making the kind places the things without anyone redoing
  work.
- "Doesn't apply" and "None" appear on a brand-new record, which teaches the
  six empties at the moment an operator first meets them.

*What fails or risks.*
- The question set is small and authored per deployment. Traits per kind
  ("touch", "stays", "address") must be written well, and ambiguous ones
  (a cabin parked for months: does it "stay in one place"?) will mis-sort.
  "Not sure" softens this but lengthens the game.
- The predicted slot's question is asked only once no kind fits. If no slot
  predicts the thing, the operator falls back to free words (the salt stock
  case). The page shows that state on the admin table but doesn't play it
  for the operator.
- The table of kinds needs a **family** per kind, an admin-curated layer CCO
  doesn't give. At 30+ kinds the family columns need folding.
- Two sentences at heading size wrap to three lines at 1280. The slot labels
  sit close to the line above.
- The duplicate decision ("Same thing / Different") is shown, but Priya's
  side-by-side comparison in Triage is described, not drawn.

*Principles.* Explain, never hide: strong. Ruled-out kinds stay with the
answer that ruled them out, the forced placement is a disabled button with a
reason, and hidden waiting is drawn hatched with whom to ask. Focus
stacking: picking a slot drops the other tiles to the far plane (opacity
only, no blur, because this is a reading table). Calm: one change per
answer, nothing loops. Letterbox: not used, rightly, since nothing here is
urgent.

*Needs (tokens).* All are `--x-proposed-*` mixes of kit tokens:
`type-micro`, `gap` / `gap-ink` / `gap-tick` (the corner-tick gap from the
grammar sheet), `hatch` / `stale` (45°), `unseen` (135°), `wait`,
`predicted` (dotted slot edge), `far` (.38), plus the layout-only
`--x-side`. Hairlines are 1px and 2px, with `2px` gaps in the gathered list.
It relies on `--font-mono` (IBM Plex Mono, still needs an ADR).

*Needs (kit).* A `Blank` part with six kinds (`gap | none | na | stale |
noRecord | unseen`), each requiring its sentence. A `Term` part for the
optional second register. A `KindTile` with a predicted variant.

*New employee test.* **Pass** for the operator: questions, a sentence, a slip
that says who decides. **Partial** for the admin table: "families" need the
header row to land.

*Scores.* Clarity 5 · Distinctiveness 5 · Feasibility 4 · Fit 4

## What Data Atlas would need (against docs/atlas.md and its API)
Data Atlas today has `GET /ontology`, `GET /ontology/candidates` (words sources
asked for, most asked first), proposals with mentions and `matches`
(key / name / spelling / meaning, with `matching` saying what was tried) and
`POST /ontology/changes`. To serve this screen it would also need:
1. **Per kind, in plain words:** a genus (family), a differentia phrase, and
   yes / no traits with their question wording. These are new ontology
   fields, edited in the studio, with a plural and a one-line description.
2. **Predicted slots:** admin-drawn kinds that aren't kept yet (family plus
   differentia plus their question), so the question engine can ask them.
   Unadopted profile classes could seed them.
3. **An "unplaced" proposal state**, distinct from an open proposal. It
   keeps the operator's sentence and answers, accepts document attachments,
   is findable by name and names its decider. It also needs a
   `candidates`-by-slot grouping: today candidates are words, not things, and
   are not grouped by kind or slot.
4. **Duplicate flags across Triage:** today `matches` come from entities
   that show on the floor, so a near match that is itself still a proposal
   (WU-7) isn't offered. Matching against open proposals is needed.
5. **"Make a kind from this sentence":** `POST /ontology/changes` taking the
   slot plus a source proposal, then re-resolving every unplaced proposal on
   that slot (like `POST /proposals/:id/match`) and telling each proposer.
6. **Expected details per kind** (`sh:minCount`-style) and **who could fill
   each**, so a new record can draw Not known yet with a name. Also
   **stated absence** ("None", who and when) as a value distinct from no
   fact, and **applicability** ("Doesn't apply").
7. **Counts that may leak:** waiting counts on another floor's Triage. This
   page follows the safe default, "some", never a number. **Exact counts
   are a decision for Harry.**

## Where it goes beyond the ask
- The waiting thing names its slot and its fellow waiters, not only who
  decides, so the operator knows they aren't alone and the admin sees demand.
- The kind is made *from the operator's sentence*, with each field saying
  which words it came from.
- A margin for what fits no slot, and for waiting that isn't yours to see.

## Open questions for Harry
- May an admin see exact waiting counts in another floor's Triage, or only
  "some"? (Today's default here: "some".)
- Should "Put it under the closest kind anyway" exist at all, even disabled?
  It is shown, because hiding it breaks explain-never-hide, but it invites
  forced fits.
