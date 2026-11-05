# Identity: critique

Four ways to say which thing a row is about and what it is called. Every
variant seeds the same case (see `../README.md`) and answers the same six
questions with the same expected answers, worked out from the case before
any query was written.

## V1: Label and key (today)
*Idea:* Data Atlas as it is today (`store.ts` migrations 001-008), made
portable. One label per entity, undated aliases, unique identity keys,
retire as the only way out. A keeper does the merge and split by hand:
retire one, add an alias; then make a new entity and type its facts again.

*Sources:* Data Atlas `service/src/store.ts`, `proposals.ts`, `resolve.ts`.

*Check result:* 3/6. Q1, Q4, Q5 pass. Q2 fails (no saved question, no
history of which entities were active, no runs or access). Q3 fails (the
new entity doesn't know the retired one was it; aliases have no dates).
Q6 fails (who merged is only `updated_by` on the retired row; the evidence
is nowhere; Data Atlas's audit goes to the platform's log, not its tables).

*What works:* Simple and fast. Q1 and Q5 are one-liners. The unique key
did its job in January: it refused to give the invoice's number to a
second supplier, which was the first hint the number was wrong.

*What fails or risks:* A retired entity can't come back, so a split makes a
new id, and everything that pointed at the old one (the April proposal, the
briefing's quote, Mandate bindings) now points at a retired row. The facts
are typed twice. The label is overwritten, so "what was it called in
April?" has no answer. Nobody can correct a merge, only redo it.

*Change from today:* None. This is the baseline.

*Score:* Honesty 1, Simplicity 5, Change cost 5, Fit 1.

## V2: The type specimen
*Idea:* Each entity hangs on one record, its specimen, set once and never
moved (ICN's type method). Names are rows with recorded-time dates, accepted
or synonym. A merge sinks the junior's name into synonymy *under* the senior
entity; no fact moves. A split closes the synonym and the junior's own name
comes back, so the old entity returns with its old id.

*Sources:* ICN, Art. 7-10 (types) and Art. 11 (priority); Snodgrass 1999
(recorded time on names).

*Check result:* 5/6. Q6 fails: a name row has one `evidence` column, so the
merge can cite the invoice but not also the Companies House record. Who
merged and split is there (`opened_by`, `closed_by`).

*What works:* The split is a restore, not a new entity, which every link
into Data Atlas needs. The type fixes *which thing*; the invoice is still
the specimen of the subsidiary even though its company number was wrong.
That is the botanical lesson exactly: the specimen can be mislabelled and
still be the anchor. Q2's four frames (as asked; as asked with today's
access; as it stood, as we know now; now) fall out of recorded time on
names and facts. Q3 is a plain union.

*What fails or risks:* Merge is a property of a name row, not an act, so it
can't carry several pieces of evidence or a rule. The fact said while
merged (the delivery note's address) had to be sorted by hand at the split,
and V2 has nowhere to record that it was sorted or by whom; the second fact
row just appears. Chains of merges (A under B under C) need a recursive
lookup the queries here don't do.

*Change from today:* Add `records` as specimens (Data Atlas has
observations, which are close), a `specimen` column on entities, a `names`
table replacing `label` and `aliases`. Facts stay as they are.

*Score:* Honesty 4, Simplicity 4, Change cost 3, Fit 4.

## V3: The number is the name
*Idea:* No entity table. Records hold keys (a registry scheme and number)
on recorded time, and an entity is every record that holds the same key
now. A record with no key is an entity on its own. The name is the newest
registry record's, else the earliest.

*Sources:* Companies House numbers; LEI (ISO 17442) as the general case;
the land register's title number as an identity that is the key.

*Check result:* 5/6. Q6 fails: nobody merges, so the merge is Alex keying
the invoice, citing only the invoice. The query also reports the Pennine
rename as a merge, because a new registry record joined an old one. That
is what this shape believes.

*What works:* Identity over time comes for free from key history, so Q2
passes. Facts hang on records, so a split is just a key correction and the
facts follow, including the delivery note (Morgan re-keyed it).

*What fails or risks:* The case is exactly its failure: one wrong number on
one invoice merged two companies, and no person decided it. Tidewater Seals
(a partnership) has no key, so it is identified by one record forever; two
records of it would be two suppliers. A model's "same supplier" is a
proposed key, so accepting a guess merges silently. A key has no floor of
its own. To answer Q3 the query had to pick one record to stand for the
subsidiary, the invoice: a specimen in all but name. Q5's key-as-fact
borrows a record's floor by hand.

*Change from today:* Large. Entities become a view; every reference
(facts, Mandate bindings, `used_by`) points at a record or a key string.

*Score:* Honesty 3, Simplicity 3, Change cost 2, Fit 2.

## V4: Same as
*Idea:* Every record that names a thing is its own entity, never merged.
Sameness is a link (owl:sameAs). What a person sees is the cluster joined
by links that stand; its name is its oldest member's label. A model's guess
is a link in state `proposed`.

*Sources:* OWL 2 `owl:sameAs`; Halpin and Hayes, "When owl:sameAs isn't the
same" (2010); Wikidata's merge and redirect help pages.

*Check result:* 2/6. Q1 and Q2 fail because the email's mention "Harbor
Line" is a supplier node of its own, waiting on a proposed link, so it is
listed and counted (8, 10, 9 instead of 7, 9, 8). Q5 fails (4, 1): a split
here is withdrawing a link, which has no step for sorting what was said
while merged, so the delivery note's address stays on the parent. Q6 fails:
the evidence is a free-text edit summary.

*What works:* Nothing is ever destroyed, and withdrawing a link is the
easiest undo of any variant. Q3 and Q4 are clean.

*What fails or risks:* The node-per-mention count is the pencil rule broken
in the open: a guess has become a counted supplier. sameAs over-claims: if
the link were read as OWL reads it, every fact on one is a fact on the
other, so the subsidiary's Team floor contract would be the parent's. The
recursive cluster query runs on every read, and on four frames for Q2.
Large clusters are a known failure in linked data (sameAs.cc).

*Change from today:* Entities stay, a `same_as` table is added, a label
history replaces the label. Every read goes through the cluster.

*Score:* Honesty 2, Simplicity 2, Change cost 3, Fit 2.

## Ranked
1. **V2 the type specimen** (5/6). The split is a restore, the old id comes
   back, nothing moved. Needs the merge lifted into an act that can cite
   several pieces of evidence (the merge surface does that).
2. **V3 the number is the name** (5/6). Right about time, wrong about
   people: the check passes, but a typo merges two companies and nobody
   decided it. Keep the key history; never let a key decide identity alone.
3. **V4 same as** (2/6). Easiest undo, worst counts. Keep "withdraw a link"
   as the shape of a split.
4. **V1 today** (3/6 but it only passes what doesn't involve time).

The check scores V3 as high as V2. It can't see that V3's merge was made by
nobody. That is a gap in the check, not a point for V3.
