# Combined: one schema for all six questions

*Idea:* Keep Data Atlas's tables, and add what the three surfaces agreed on.
- From identity V2: each entity hangs on a **specimen** record, set once.
  **Names** are dated rows, accepted or synonym. `label` stays as a copy of
  the accepted name, so today's readers keep working.
- From merge V2: a **merge** is an act. The junior is *placed under* the
  senior. It has a kind (*found the same*, or *became one* on a date), a
  name rule, who and when, and the Triage item it came from.
- From merge V4: merges and splits **cite** records *for* and *against*,
  and a record that misled is **discredited**, with why. A fact said while
  merged is **sorted** by a row, not copied.
- From across time V3: today's facts already have two clocks. A rerun is
  four frames, and each step between them is one of the five reasons.
- From the reference desk: a saved question keeps words, choices, runs and
  whose access each run used, never rows. **Quotes** record where a run's
  count was copied, so a change can reach the briefing.
- Today's unique `entity_keys` stays. A second record with the same key
  becomes a Triage item ("same supplier?"), as the January clash did here
  (`p0`). A key clash is a question for a person, never a merge.

## Check result
`check.py combined`: **6/6**.

Migration check (today's shape, identity V1, plus `migrate.sql`, then these
questions): **2/6**. Q1 and Q4 pass. Q2 finds no saved question (today has
none), Q3 finds only the retired record's name, Q5 looks at the retired
record (today's keeper re-made the subsidiary as a new entity), Q6 finds no
merge. This is the honest result: the migration starts the clock. History
from before it stays as today left it, and every row it makes says what it
doesn't know (`since_known = 0`, `specimen` empty).

## Probes (not part of the check)
The six questions were written for this seed, so the queries could be tuned
to it. Four changes to the seed, run by hand:

| Change | Result | Right? |
|---|---|---|
| Accept the "Harbor Line" guess as a merge | Q4 empty; counts unchanged | Yes |
| Remove the sorting of the delivery note | Q5 becomes 4, 1 | Yes |
| A hidden October contact for the subsidiary | Q2 hidden becomes 2; Q5 becomes 5, 2 | Yes, but see risks |
| The merge as *became one* on 10 March | No change (it was withdrawn) | Yes |

## What works
Every question is one query of moderate size. The split restores the old
entity with its old id, so the April proposal, the briefing's quote and any
Mandate binding still point at the right thing. The wrong invoice is named
as wrong. The model's guess sits in Triage, is never counted, and never
joins two entities. Nothing a person did is erased.

## What fails or risks
- **Hidden counted as hidden leaks a little.** "1 may move on a floor you
  can't see" tells Sam that a Team floor has a contact with one of these
  suppliers. The catalogue run said "some, never a number". The data can
  give either; the shell must choose (decision 3 in the shortlist).
- **Two of the five reasons aren't worked out.** "A guess was settled" and
  "a word changed meaning" need a cause link (which act changed the answer),
  not only which clock moved. The schema has the links (`merges.proposal`,
  `questions.choices`); the query doesn't use them yet.
- **The subject rule.** A fact's subject is its entity unless a sorting
  says otherwise. Every read of facts must use it; a view
  (`fact_subjects`) would keep that in one place.
- **Chains.** A merge under an entity that is itself merged needs a
  recursive lookup. The queries here go one level.
- **Postgres.** `json_extract` is `->>`, `group_concat(... ORDER BY)` is
  `string_agg(... ORDER BY)`. The DDL is portable; the questions mostly are.

## What it would cost
- **Schema:** 11 new tables (records, names, merges, merge_cites, splits,
  split_cites, sortings, questions, runs, run_floors, quotes) and 2 new
  columns (`entities.specimen`, `observations.record`). One migration,
  `009_identity`. Nothing dropped; `entity_aliases` (today `aliases text[]`)
  is read once into `names` and can go when nothing reads it.
- **Rows:** names about 1.1 per entity; records one per source document (the
  migration makes one per observation, which can be folded later); merges,
  cites, splits and sortings a handful per merge; a run is 1 row plus its
  floors. Small next to facts and observations.
- **Code in Data Atlas:** matching by name and spelling (`store.ts` byName,
  bySpelling; `resolve.ts` entityText) reads `names`; Triage gets "same as"
  decisions that write a merge with cites; new merge, split and sort
  actions; every fact read goes through the subject rule; events
  `atlas.entity.merged` and `atlas.entity.split` for Mandate and Artifacts.
- **Not in Data Atlas yet:** where saved questions live (Data Atlas or
  Artifacts) is a decision, and quotes need Artifacts to say where a count
  was copied.

## Score
Honesty 5, Simplicity 3, Change cost 3, Fit 5.
