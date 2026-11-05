# Grammar: the type specimen

One sheet of words for this run. Each word says what it is, where it comes
from, what it holds, and what it must never claim. The variants use these
words in their table and column names, so a reader can move between them.

## The words

**Record** (a source row). One thing a source said, as it arrived: a
Companies House entry, an invoice, a delivery note, an email. Data Atlas
calls these observations today. *Holds:* who said it, when we got it, the
words as they came. *Never claims:* that it is true, or which entity it is
about.

**Evidence.** A record cited by a conclusion. "A record says." From the
Genealogical Proof Standard: evidence is kept apart from what we conclude
from it. *Holds:* the record, what it says in one line, and whether it was
later found wrong (discredited), with why. *Never claims:* a conclusion.
A discredited record stays, marked, like a withdrawn source in Data Atlas
today.

**Conclusion.** "We believe." A statement a person makes from evidence,
which cites that evidence. Merge and split are conclusions. *Holds:* who,
when, the evidence, the rule used. *Never claims:* to be a record. It can
be withdrawn by a later conclusion, never edited.

**Specimen** (the type). The one record an entity hangs on. From the
botanical code (ICN): every name is fixed to one physical specimen in a
herbarium, so the description can change and the identity can't. Here it
is the record that first made the entity: for Harbour Line Logistics, the
January invoice row. *Holds:* a pointer to one record, set once. *Never
claims:* that the record is right. The January invoice quoted the wrong
company number and is still the specimen. The specimen fixes *which thing*,
not *what is true of it*.

**Entity.** One real thing, as Data Atlas keeps it. Here, an entity is its
specimen plus everything said about it. *Never claims:* to be the same
thing as another entity. Sameness is a conclusion.

**Name.** A label an entity has been shown under, with the time it began
and ended. *Status:* accepted (the one shown) or synonym (kept, found by
search, never shown as the title). *Never claims:* identity. Two entities
can share a name; one entity can have many.

**Priority.** The rule that picks the accepted name when two entities are
found to be one. From the botanical code: the earliest validly published
name wins. Here: the earliest recorded name wins, unless a registry gives
the registered name. The rule is stored with the merge, so the choice can be
explained and rerun.

**Synonym.** A name that lost under priority, kept with its dates and the
merge that made it a synonym. *Never claims:* to be wrong. "Harbour Line
Logistics" was a synonym from March to May and an accepted name before and
after.

**Merge** (in the code: sinking a name into synonymy). A conclusion that
two entities are one thing. Neither specimen moves. The junior entity is
*placed under* the senior one; facts stay on the entity they were said of.
*Never claims:* that the junior entity stopped existing, or that its facts
now belong to the senior one.

**Split** (in the code: resurrecting a name). A conclusion that a merge was
wrong. It withdraws the merge and cites the evidence that shows why. Each
part keeps its own specimen, so the old entity comes back with its old id.
A part with no specimen of its own is a new entity. *Never claims:* that
the merge never happened. It happened; it was wrong.

**Sorting.** What a split must also do: decide, fact by fact, which part
each fact said *while merged* belongs to. Each decision is a row with who
and why. *Never claims:* to know without a person.

**Found the same** versus **became one.** Two kinds of merge. *Found the
same* (two records were always one company) has no valid time: it is a
change in what we know, so it moves only recorded time. *Became one* (one
company bought another and folded it in on 1 July) is an event with a valid
date. The Harbourline merge was meant as *found the same*.

**Valid time** and **recorded time** (Snodgrass, 1999). Valid time: when
something was so in the world. Recorded time: when Data Atlas came to hold
it. A late note of an April call has an April valid time and a June
recorded time. Every fact, name and conclusion here has recorded time;
facts about the world also have valid time.

**Entry** (land register). One line in an entity's register, in order. A
later entry may close an earlier one; nothing is erased.

**Guess** (pencil). Something a model proposed. It sits in Triage with its
producer. It is never counted, never shown as a name, never joins two
entities. It becomes a fact only when a person accepts it, and keeps who
proposed it.

**Hidden.** A fact on a floor the reader can't see. It is counted as hidden
("1 more you can't see, kept on a Team floor"), never left out in silence.

## What each must never claim, in one table

| Word | Must never claim |
|---|---|
| Record | that it is true |
| Evidence | a conclusion |
| Conclusion | to be evidence; to be edited (only withdrawn) |
| Specimen | that its content is right |
| Name | identity |
| Synonym | that it was wrong |
| Merge | that the junior entity is gone, or that its facts moved |
| Split | that the merge never happened |
| Guess | anything counted |
| Hidden | nothing (it says it is there) |

## sameAs, and where it over-claims
`owl:sameAs` says two names denote one thing, so every statement about one
is a statement about the other. That is the merge's job done too well: the
subsidiary's contract on a Team floor becomes the parent's contract, and a
proposed sameAs, if counted, joins things nobody accepted. Wikidata's merge
leaves a redirect and moves the statements, which is cheap to read and hard
to undo. This run uses *placed under* instead of *same as*: a weaker claim
that keeps facts where they were said.
