---
batch: 3
kind: steered
concepts: [consequence-preview, visible-repair, the-recipe-is-the-record]
---

# Prompt J: Mise en place. Turning raw data into something usable.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-mise-en-place/prompt.md`.

---

Most data reaches an organisation as a mess: a spreadsheet emailed by a
supplier, a export with merged cells, names spelt five ways, dates in
three formats. Today a data team cleans it, or nobody does. This run asks
how an operator who has never heard of ETL can **transform** data
themselves: bring a spreadsheet in, see what it holds, tidy it, map it to
the kinds of thing Data Atlas keeps, and send it through Triage, with
every step recorded so it can be checked and rerun. Kitchens have done
this for a century: prepare everything first, follow a recipe, and check
every plate at the pass before it leaves. Work in
`design-lab/runs/<date>-mise-en-place/`.

## Direction
- **Show the data, not the operation.** People pick an example of what
  they want ("make these look like this one") and the interface suggests
  the step, as in Wrangler.
- **Every step is a line in a recipe** the person can read, reorder,
  undo and rerun on next month's file.
- **Preview before it lands:** what will be created, merged, changed or
  thrown away, before anything reaches Triage (consequence preview).
- **Nothing is silently dropped.** Rows that don't fit are set aside,
  counted and shown, never lost.
- Explain, never hide; many deployments; calm at rest (from the brief).

## References and what to take from each
- **The kitchen brigade** (Escoffier): mise en place, the recipe, the
  pass where the head chef checks each plate, "heard" as acknowledgement.
  Take: prepare, cook, check at the pass.
- **Kandel, Heer and others, Wrangler (2011) and predictive interaction**:
  select an example, the system proposes transforms, you pick one. Take:
  transformation by demonstration.
- **Power Query's "applied steps"** and **OpenRefine's facets and
  clustering** (merging names spelt differently). Take: a readable step
  list, and grouping near-duplicates for a person to confirm.
- **Recipe cards, knitting patterns, IKEA's wordless instructions**:
  procedures non-experts follow and repeat. Take: a step format anyone
  can follow and check.
- **Assembly lines and quality gates** (Toyota's jidoka: stop the line
  when something is wrong). Take: a step that stops and asks rather than
  guessing.

## Surfaces (6 variants each)
1. **Kitchen sheet** (grammar): ingredient (source), prep (clean), recipe
   (steps), pass (check), plate (what lands), set aside (didn't fit).
2. **Bringing a file in**: drop a spreadsheet and see what it holds in
   plain words (columns, kinds of value, problems found).
3. **Tidying by example**: fix one messy value and the interface offers
   to fix the rest the same way.
4. **Mapping to what we keep**: columns to Data Atlas kinds and details,
   with near matches to existing entities grouped for confirmation.
5. **The pass**: the preview of what will reach Triage, what is set
   aside, and the recipe that made it.
6. **Next month's file**: rerun a saved recipe on a new file and see only
   what changed or broke.

Round 2: combine into 3-4 screens. One must take one realistic messy file
from drop to Triage, then rerun it a month later with two new problems.

## Questions the shortlist must answer
- Where does this live: Data Atlas, its own platform app, or a kit part
  every app can use?
- Which established open-source tools could do the transforms (adding
  one needs an ADR), and what AUGUR must own itself?
- How a recipe is recorded so the result's history (wear and time) can
  say which recipe made each value.

## Carry from earlier runs
Read `design-lab/concepts/README.md`, especially `consequence-preview`,
`visible-repair` and `the-record-has-edges`.
