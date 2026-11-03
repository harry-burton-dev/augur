---
batch: 3
kind: steered
concepts: [attention-as-wear, changes-before-they-bite, earned-sound, care-is-scheduled]
---

# Prompt K: The groundskeeper. Looking after data over years.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-the-groundskeeper/prompt.md`.

---

Data rots. Suppliers close, people move on, a fact that was right in March
is wrong by June, and nobody notices until a decision rests on it. Large
companies hire data stewards; most teams have nobody. This run asks how
AUGUR can make **upkeep** a normal, light part of operators' work: who
looks after what, what needs a look this week, what has been neglected,
and what should be retired. Gardeners, building managers and museum
conservators keep things in good condition for decades on a calendar of
small, routine jobs. Work in `design-lab/runs/<date>-the-groundskeeper/`.

## Direction
- **Care is scheduled, not heroic.** Upkeep arrives as a short round of
  small jobs, in the person's own part of the data, at a pace they can
  keep.
- **Condition is visible:** how well each collection is looked after
  shows at a glance (attention-as-wear), without a dashboard of scores.
- **Every collection has a keeper**, and unkept ones say so, with who
  could take them on.
- **Retirement is a care step:** old data is archived with a reason, not
  deleted or left to rot.
- Explain, never hide; many deployments; calm at rest (from the brief).

## References and what to take from each
- **Planned preventive maintenance** in building and fleet management,
  and the UK **MOT** test. Take: a known interval, a checklist, a pass
  with advisories.
- **Gardening calendars and succession planting** (RHS guides). Take:
  seasonal rounds, and work spread so nothing is all due at once.
- **Museum collections care**: condition reports, accession and
  deaccession, the registrar. Take: a condition report for a collection,
  and a careful way to let things go.
- **DAMA's data quality dimensions** (accuracy, completeness,
  timeliness, consistency, uniqueness, validity) and **data stewardship
  roles**. Take: the real dimensions, named in plain words.
- **Wikipedia's maintenance templates and WikiProjects** ("citation
  needed", cleanup queues, volunteers who adopt topics). Take: upkeep by
  many hands, with marks on the page itself.

## Surfaces (6 variants each)
1. **Care sheet** (grammar): keeper, round, condition, advisory, overdue,
   retire; plain words for each quality dimension.
2. **My round**: the week's small upkeep jobs for one operator, on Home
   or in Data Atlas, with a pace they choose.
3. **Condition of a collection**: a condition report for a set of
   entities or a library in Artifacts, with advisories.
4. **Duplicates and merges**: finding and confirming that two records
   are the same thing, and undoing a wrong merge.
5. **Unkept ground**: what nobody looks after, shown honestly on its
   floor, with a way to adopt it.
6. **Retiring data**: archive with a reason, what depends on it first,
   and how it can come back.

Round 2: combine into 3-4 screens. One must show a year of one
collection's care compressed into a minute: rounds kept and missed,
condition rising and falling.

## Questions the shortlist must answer
- What upkeep rate is realistic for an operator (minutes a week), and how
  does AUGUR keep inside it (earned-sound's budgets, for work)?
- Who assigns keepers: a floor admin, the person who made the data, or
  whoever adopts it?
- What Data Atlas and Artifacts would need to record (keeper, review
  interval, last checked) that they don't today.

## Carry from earlier runs
Read `design-lab/concepts/README.md`, especially `attention-as-wear`,
`changes-before-they-bite` and `earned-sound`.
