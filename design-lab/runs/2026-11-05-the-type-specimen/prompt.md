---
batch: 7
kind: steered
track: data
concepts: [pencil-and-ink, the-question-is-the-record, five-reasons-an-answer-moves, copies-know-their-source]
---

# Prompt D1: The type specimen. Naming things that get renamed.

Read `design-lab/tracks/data/brief.md` first; it holds the rules, the
check and the critique format. When you start, move this file to
`design-lab/runs/<date>-the-type-specimen/prompt.md`.

---

Data Atlas holds entities (suppliers, ports, sites, people's teams) and
the facts known about them. Entities don't sit still: two suppliers turn
out to be one company, a merged record is split again when the merge was
wrong, a port changes its name, a team is renamed. Every earlier answer,
saved question and briefing that counted them has to stay explainable.
Botanists have named and renamed millions of species for 270 years
without losing track, because each name hangs on one physical specimen,
not on a description. This run asks what Data Atlas's **identity model**
looks like if it works like biological nomenclature. Work in
`design-lab/runs/<date>-the-type-specimen/`.

## The case (every variant seeds it)
- Floor: a Department, with two Teams under it.
- Suppliers "Harbourline Freight Ltd" and "Harbour Line Logistics" are
  two records from January. In March a keeper merges them (same company
  number). In May the merge proves wrong: one was a subsidiary with its
  own contracts. It is split again.
- Between March and May, a saved question "which suppliers have we not
  heard from since spring?" was asked and answered 7. A briefing quoted it.
- A model proposed in April that "Harbor Line" in an email is the same
  supplier. Nobody has accepted it.
- One of the facts sits on a Team floor that the asker can't see.

## Questions every variant must answer (questions.sql)
1. Which suppliers exist today, under their current names?
2. What did the saved question answer on 20 April, and what does it
   answer now, and which of the five reasons moved it?
3. What names has the subsidiary ever been known by, and since when?
4. Which facts about "Harbourline" came from a model and are not accepted?
5. As the asker (who can't see the Team floor), how many facts are there
   about the subsidiary? (Answer must count the hidden ones as hidden.)
6. Who merged and who split, and on what evidence?

## References and what to take from each
- **The International Code of Nomenclature for algae, fungi, and plants
  (ICN)** and its type method. Take: a name is fixed to one type specimen,
  so the description can change and the identity can't.
- **Priority and synonymy** in the same code (the earliest valid name
  wins; others become recorded synonyms). Take: a merge chooses one name
  by rule and keeps every other as a synonym with its date.
- **The Genealogical Proof Standard** (Board for Certification of
  Genealogists). Take: evidence (a record says) is stored apart from
  conclusions (we believe), and a conclusion cites its evidence.
- **Land registries** (HM Land Registry's register of title). Take: a
  title plus its entries in order; nothing is erased, entries are closed.
- **Wikidata's merge and redirect model** and **owl:sameAs**. Take: what
  open data does today, and where sameAs over-claims.
- **Bitemporal tables** (Snodgrass, *Developing Time-Oriented Database
  Applications in SQL*, 1999). Take: valid time versus recorded time.

## Surfaces (4 variants each)
1. **Grammar** (one sheet, `grammar.md`): specimen, name, synonym,
   evidence, conclusion, merge, split, and what each must never claim.
2. **Identity**: how an entity is identified and named (4 schemas).
3. **Merge and split**: how a merge is recorded and undone without
   rewriting history; each variant ships `migrate.sql` from its identity.
4. **Answering across time**: the saved question rerun as it was and as
   it is, with hidden facts counted as hidden.

Round 2: combine into one schema that passes all six questions, plus a
`migrate.sql` from Data Atlas's shape today, and say what it would cost.

## Questions the shortlist must answer
- Does an entity need a "type" (one record it hangs on), or is the
  company number enough? What when there is no key?
- Is a split a new entity, or the old one restored?
- What must Data Atlas store that it doesn't today, and how big is that?
