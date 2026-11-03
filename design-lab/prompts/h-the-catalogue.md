---
batch: 3
kind: steered
concepts: [the-object-explains-itself, hierarchy-without-containers, the-record-has-edges, plain-words-first]
---

# Prompt H: The catalogue. Data structure people can read.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-the-catalogue/prompt.md`.

---

Batch 3 is about data, for the people who will use it most and know it
least: an operator on a Department floor who has never written a query,
never seen a schema and doesn't want to. Data Atlas already holds entities,
what is known about each, the links between them, and an ontology (kinds of
thing, their details and kinds of link, from the Common Core Ontologies,
exported as OWL). This run asks how that **structure** can be shown so an
operator understands what the organisation keeps track of, what a record is
made of and how things connect, without ever meeting the words "schema",
"class" or "property". Librarians, naturalists and chemists solved this
for the public long before databases. Work in
`design-lab/runs/<date>-the-catalogue/`.

## Direction
- **Plain words first.** Every structural idea has a name an operator
  would use ("kinds of thing", "details", "links"). Technical names exist
  one step down, for admins, never instead.
- **The shape is visible before the content.** Someone arriving at Data
  Atlas sees what kinds of thing exist, how many of each, and how they
  connect, before any one record.
- **Every record shows what it could hold**, not only what it does hold:
  a missing detail is drawn as missing, with who could fill it.
- **Many deployments:** the kinds of thing come from each deployment's
  ontology. Nothing is drawn for ships and ports only.
- Explain, never hide; calm at rest (from the brief).

## References and what to take from each
- **S. R. Ranganathan's faceted classification** (Colon Classification,
  PMEST: personality, matter, energy, space, time). Take: describe any
  record by a few facets, and let people find things by combining them.
- **Library catalogue cards and the Dewey and UDC schemes.** Take: the
  card as a fixed shape every record shares, readable at a glance.
- **Mendeleev's periodic table.** Take: a structure whose layout predicts
  what is missing (the gaps were elements nobody had found yet).
- **Linnaean taxonomy and field guides** (identification keys, "what kind
  is this?" in a few questions). Take: placing a new thing by answering
  questions, not by picking a class from a list.
- **Jacques Bertin's visual variables** and **ER diagrams as drawn for
  business users** (Peter Chen, 1976). Take: what a relationship diagram
  looks like when it is drawn for readers, not modellers.
- **Wikidata's item pages**: statements, qualifiers, references. Take: a
  generic record page that works for any kind of thing.

## Surfaces (6 variants each)
1. **Catalogue sheet** (grammar): kind, detail, link, facet, card, gap;
   the plain word for each, the technical word one step down, and what
   each must never mean.
2. **The shape of what we keep**: Data Atlas's front page as the
   ontology made readable (kinds of thing, counts, links between kinds).
3. **The record card**: one entity, every detail it could hold, filled or
   drawn as a gap with who could fill it, sources as references.
4. **Placing a new thing**: an operator adds something and finds its
   kind by answering questions, field-guide style.
5. **Facets for finding**: browse by combining facets instead of a search
   box, with counts that say what each choice leaves.
6. **When the structure changes**: an admin adds a detail or a kind; how
   operators see it, and what happens to records that don't have it yet.

Round 2: combine into 3-4 screens. One must take the same five entities and
show them as a table, as cards and as a facet browser, and say honestly
which an operator reads fastest.

## Questions the shortlist must answer
- Which ontology terms can be shown to operators at all, and which belong
  only in the studio?
- Is the "gap" mark the same as wear and time's "no record", or different?
- What Data Atlas would need (counts per kind, which details are expected
  per kind) that it doesn't give today.

## Carry from earlier runs
Read `design-lab/concepts/README.md`, especially `the-object-explains-itself`,
`the-record-has-edges` and `hierarchy-without-containers`.
