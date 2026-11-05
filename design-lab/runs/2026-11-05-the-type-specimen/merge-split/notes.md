# Merge and split: critique

How a merge is recorded and undone without rewriting history. Each variant
ships `migrate.sql` from the identity variant it builds on. The check runs
schema, seed and questions. The **migration check** loads the identity
variant's schema and seed, applies `migrate.sql`, then runs this variant's
questions on the migrated data. That shows what a migration can and can't
bring across. (`check.py --apply-migrate` can't test this: it applies the
migration on top of the variant's own schema. See the run's README.)

## M1: Redirect and move
*Idea:* Wikidata's merge, on top of today's shape. The junior's statements
move onto the senior and the junior becomes a redirect. A `moved` log lets
the undo move them back. Each entity has a revision history with edit
summaries.

*Sources:* Wikidata Help:Merge and Help:Redirects; MediaWiki page history.

*Check result:* 5/6. Q6 fails: the evidence is an edit summary ("Same
company number 04417721"), not records. Migration check from identity V1:
2/6 (Q1, Q4). Today's data holds no merge, so none can be found again, and
the subsidiary that today's keeper re-made has a new id.

*What works:* Reading is cheap: a redirect is one column. The undo is
real, and the old id comes back. Q3 reads the revision history.

*What fails or risks:* Q2 passes only because the undo put the contact back
where it started. In between, the contact sat on the parent, and nothing
but the `moved` log says so. The delivery note's address, said of the
merged entity, was moved by an ordinary edit, which no table records. So Q5
passes by luck of a careful keeper. Moving rows is the opposite of "facts
stay where they were said". A merge across floors would move a Team fact
onto a Department entity.

*Change from today:* Small: a column, three tables.

*Score:* Honesty 2, Simplicity 4, Change cost 4, Fit 2.

## M2: Synonymy by rule
*Idea:* The botanical code's taxonomic opinion. A merge is its own row: the
junior placed under the senior, its kind (*found the same*, or *became one*
on a date), the name rule ("priority: earliest recorded name wins"), who,
when, and any number of records. A split withdraws one merge, cites its own
records and gives its reason. Each fact said while merged is sorted in a
`sortings` row.

*Sources:* ICN Art. 11 (priority) and Art. 14 (conservation, for the
exceptions a rule needs); Snodgrass 1999.

*Check result:* 6/6. Migration check from identity V2: 5/6. Q6 fails after
migration: V2 kept one record per merge, so the Companies House record is
lost for good. The migration says "not kept before migration" rather than
guess.

*What works:* Every question is a short query. The merge kind matters:
*found the same* moves only recorded time, so the 20 April answer is
replayed exactly (7); *became one* would also carry a valid date. Sorting
is a row with who and why.

*What fails or risks:* A sorted fact is copied (f24 closed, f25 opened), so
the delivery note's address exists as two rows. Chains of merges need a
recursive lookup. The name rule is free text; a deployment that wants
"the registry's name wins" needs it as a value the query reads.

*Change from today:* Moderate. Five tables on top of the specimen model.

*Score:* Honesty 4, Simplicity 4, Change cost 3, Fit 4.

## M3: The register
*Idea:* HM Land Registry's register of title. Each entity has numbered
entries in order: name, other name, placed under, released, fact sorted. An
entry is never changed; a later entry may close it. What holds at a time is
every entry made by then and not yet closed.

*Sources:* HM Land Registry, Practice Guide 1 and the register of title
(property, proprietorship and charges registers); Land Registration Act
2002 (entries, not deeds).

*Check result:* 6/6. Migration check from identity V2: 5/6 (Q6 again: the
lost record).

*What works:* One table tells the whole story of an entity in the order it
happened, and a keeper can read it top to bottom, like a title. The merge,
the release, the corrected name and the sorting are four lines on one page.

*What fails or risks:* Every read is a replay of "open entries at K", with
a `NOT EXISTS` against the closing entry. That is fine for one entity and
costly for a whole list (Q2 runs it four times). Entries mix kinds, so
nulls are many and checks are weak (a 'name' entry with no name is legal).

*Change from today:* Large for reads: every screen that shows a name reads
the register.

*Score:* Honesty 5, Simplicity 2, Change cost 2, Fit 4.

## M4: Evidence and conclusion
*Idea:* The Genealogical Proof Standard, on top of the sameAs identity.
Records say; conclusions believe. A merge is a `same` conclusion citing its
records; the split is a `distinct` conclusion that withdraws it, citing the
registry *for* and the invoice *against*, and the invoice is marked
discredited, with why. Sorting a fact said while merged is an `about`
conclusion, so the fact stays one row. A model's guess is a hypothesis in
its own table: never an entity, never a link.

*Sources:* Board for Certification of Genealogists, *Genealogy Standards*
(2nd ed., 2019) and the Genealogical Proof Standard; Elizabeth Shown Mills,
*Evidence Explained* (sources, information, evidence); W3C PROV-O
(`wasDerivedFrom`, `wasInvalidatedBy`) for the vocabulary.

*Check result:* 6/6. Migration check from identity V4: 4/6. Q1 and Q2 now
pass (the mention node is removed and its link becomes a hypothesis). Q5
fails: V4 never sorted the address, and the migration can't know it should.
Q6 fails: V4 kept edit summaries, not records.

*What works:* The only variant where the wrong record is named as wrong.
"Why did we merge?" and "what turned out false?" have answers that point at
records. Sorting without copying keeps one fact with one history. Taking
guesses out of the identity tables fixes V4's worst failure at the root.

*What fails or risks:* The cluster is still recursive. A fact's subject is
"its entity, unless an `about` conclusion says otherwise", which every
query must remember. Conclusions of three kinds in one table need care.

*Change from today:* Large: records, conclusions and citations, and the
subject rule on facts.

*Score:* Honesty 5, Simplicity 3, Change cost 2, Fit 5.

## Ranked
1. **M4 evidence and conclusion** (6/6). Names the wrong record; sorting is
   a conclusion; guesses are kept apart.
2. **M2 synonymy by rule** (6/6). Simplest that passes; the merge as an act
   with a kind and a rule. The combined round takes its merge row.
3. **M3 the register** (6/6). The best page for a keeper to read; the most
   costly to query. Keep it as a view, not as the store.
4. **M1 redirect and move** (5/6). Passes because people were careful, not
   because the shape is.

Every migration check failed Q6. What was never stored can't be migrated.
That is the strongest argument for storing evidence on merges now, before
Data Atlas has any merges to lose.
