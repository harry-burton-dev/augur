# Shortlist: the type specimen

Ranked by what I'd build first. The headline: **a specimen fixes which
thing, not what is true of it.** The subsidiary's specimen is the January
invoice, and that invoice quoted the wrong company number. It is still the
right anchor. Because the entity hangs on the record and not on the number,
the split brings the old entity back with its old id. The 20 April answer
replays exactly (7). The rerun can say why it is now 8. The second finding
is that **a rerun has three numbers, not two**: 7 as asked, 9 as it stood
then knowing what we know now, and 8 now. Two of the three changes were
corrections, and the briefing's reader needs to know that.

The combined schema passes all six questions (6/6). It adds 11 tables and 2
columns to Data Atlas and drops nothing.

| # | Build | Look at | Why it ranks here |
|---|---|---|---|
| 1 | **Specimen and dated names**: each entity points at the record it was made from, set once; `names` replaces `aliases` with dates, accepted or synonym; `label` stays as a copy | [identity V2](identity/v2-type-specimen/), [combined](combined/) | Small, and everything else rests on it. V3 (key as identity) had to pick a record to answer "what was it called?", a specimen in all but name. |
| 2 | **Merge as an act, split as a restore**: the junior is *placed under* the senior, nothing moves; the merge cites records for and against and keeps its name rule; a split withdraws it and the old entity returns | [merge V2](merge-split/m2-synonymy-by-rule/), [merge V4](merge-split/m4-evidence-and-conclusion/) | All four migration checks lost Q6: what was never stored can't be migrated. Store evidence on merges before Data Atlas has any merges to lose. |
| 3 | **A shared key is a question**: a second record with a known key raises a Triage item ("same supplier?"), never a merge | [identity V3](identity/v3-the-number-is-the-name/), [combined](combined/) (`p0`) | V3 shows the failure: one typo on one invoice merged two companies and nobody decided it. Today's unique key already refuses the clash; it should also ask. |
| 4 | **Sort what was said while merged**: one row per fact, saying which part it is about, by whom and why; the fact stays one row | [merge V4](merge-split/m4-evidence-and-conclusion/), [combined](combined/) | The hidden cost of every split. V4 (sameAs) had no step for it and left the address on the parent. The same applies to other apps' links (Mandate bindings to the merged entity). |
| 5 | **Name the wrong record**: when a merge is withdrawn, the record that misled is marked discredited, with why, and stays | [merge V4](merge-split/m4-evidence-and-conclusion/) | It stops the same wrong merge being made again from the same invoice, and it is the Genealogical Proof Standard's main lesson. |
| 6 | **Rerun in four frames**: as asked; as asked with today's access; as it stood, as we know now; now. Each step is one reason: which clock moved | [across time T3](across-time/t3-two-clocks/), [combined](combined/) | The five reasons become a calculation, not a label. Data Atlas's facts already have both clocks. |

**Worth keeping as options:**
- [The register](merge-split/m3-the-register/) as a read-only page for keepers: an entity's story, entry by entry, like a title. Too costly as the store.
- [Replay the log](across-time/t4-replay-the-log/): the events are Data Atlas's outbox, which already exists. Keep emitting them (`atlas.entity.merged`, `atlas.entity.split`); query the tables.
- V3's key history as a matching aid, never as identity.

**Not worth pursuing:** sameAs as storage ([identity V4](identity/v4-same-as/): a guess became a counted supplier, 8 instead of 7); moving statements on merge ([M1](merge-split/m1-redirect-and-move/): it passed only because a keeper was careful); [keep the answer](across-time/t1-keep-the-answer/) (rows leak past their floors and no change has a reason); [valid time only](across-time/t2-valid-time-only/) (it can't explain the briefing's 7).

## Answers to the prompt's questions
- **Does an entity need a "type", or is the company number enough?** It
  needs a type. The number is a fact, with evidence, and here it was wrong.
  An identity that is the number merges whatever shares one, without a
  person. The type is the record the entity was made from. It never moves,
  and it can be wrong in what it says without being wrong about which thing
  it is. **With no key** (Tidewater Seals is a partnership; an email's
  "Harbor Line" has none), the type is the only identity there is, so every
  entity needs one. Entities made before the migration have none, and say
  so.
- **Is a split a new entity, or the old one restored?** The old one
  restored, for each part that has its own type. That is the botanical rule:
  a name stays with the part that holds its type. A part with no type of its
  own is new, and needs a record to be its type. A split also has to sort
  what was said while merged, fact by fact.
- **What must Data Atlas store that it doesn't today, and how big is it?**
  Records with a discredited mark; a specimen on each entity; dated names;
  merges and splits with citations; sortings; saved questions with their
  runs, each run's floors, and quotes. That is 11 tables and 2 columns. The
  rows are small: about 1.1 names per entity, a handful of rows per merge, 1
  row plus its floors per run. Records are the largest, at one per source
  document. The larger cost is code: matching reads `names`, Triage writes
  merges, every fact read goes through the sorting rule, and other apps get
  merge and split events. See [combined notes](combined/notes.md).

## Where this pushes back
- **On the prompt:** botany's lesson isn't that a specimen is right. It is
  that the specimen is the anchor even when it is wrong (the code has
  epitypes because a type can be too poor to identify, and conserved types
  because a type can point the wrong way). Treat the type as
  *which*, never as *what*.
- **On "count the hidden as hidden":** the prompt asks for a number, and
  the combined schema gives one ("1 may move on a floor you can't see").
  That tells Sam a Team floor holds a contact with one of these suppliers.
  The catalogue run's rule was "some, never a number". The data can give
  either; I'd show "some" to the reader and keep the number for the floor's
  leads.
- **On a sixth reason:** a split felt like it needed its own reason
  ("identity corrected"). It doesn't. It is "we learned about the past",
  because only recorded time moved. But the notice must name the cause (the
  split, the discredited invoice), so each reason needs a link to the act
  that moved it. The schema has those links; the queries don't use them yet.
- **On "prefer established standards":** nothing standard records a merge
  with its evidence and its undo. owl:sameAs over-claims (every fact on one
  becomes a fact on the other), and Wikidata's merge moves statements and
  keeps only an edit summary. I'd take the *structure* from the botanical
  code and the Genealogical Proof Standard, and the *vocabulary* for export
  from PROV-O (`prov:wasDerivedFrom` for citations, `prov:wasInvalidatedBy`
  for a discredited record), with owl:sameAs only for a standing merge.
- **On the case's "two records from January":** today's Data Atlas already
  refused the second company number in January (`entity_keys` is unique).
  That refusal was the first sign of trouble. It should have been a Triage
  item then, not a merge two months later.

## Decisions for Harry (none taken)
1. Hidden counts: does the reader see a number ("1 may move") or "some"? I
   recommend "some" for readers and the number for the floor's leads.
2. Is *became one* (a company bought and folded into another) a merge at
   all? I recommend no: keep merges for *found the same* only, and record
   an acquisition as a link between two entities with a valid date. That
   takes valid time out of identity altogether.
3. Where do saved questions, runs and quotes live: Data Atlas, or Artifacts
   (which holds the briefing)? The quote must reach whichever app holds the
   copy.
4. Who decides a merge across floors? If the junior is on a Team floor and
   the senior on the Department, are both floors' leads needed, and who can
   see the placement? The merge row has one floor today.
5. The name rule: "earliest recorded name wins", or "the registry's name
   wins"? Should a deployment choose it as a setting?
6. This needs a Proposed record in `augur-atlas` (`docs/decisions/`) before
   any of it is built, because it changes how Data Atlas identifies things.

## Gaps
- No query yet works out "a guess was settled" or "a word changed meaning";
  both need cause links.
- Chains of merges (A under B under C) need a recursive lookup; the queries
  go one level.
- Other apps' references (Mandate bindings, Artifacts links, `used_by`) to a
  merged entity need sorting at the split too, through events.
- The shell has no mark for "placed under" or "discredited" yet; this run
  made no screens.
- The data track's check: see "About the check" in the [README](README.md)
  and the method notes in [`concepts.md`](concepts.md).
