---
batch: 1
kind: steered
concepts: [history-as-material, the-object-explains-itself, honest-blank]
---

# Prompt A: Wear and time. The object remembers.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/2026-11-02-wear-and-time/prompt.md`.

---

Spend this run exploring how AUGUR can show **time and history as a
material**, so that every document, fact, intent and floor carries visible
traces of how it got here: who touched it, what changed, what was read,
what is ageing, what is about to fall due. Today most software shows history
as a separate screen (a version list, an audit log). Physical things show it
on their surface: a worn step, a dog-eared page, tree rings, rock strata, a
patina, a tide line. Find out how far that can go in a calm, dark interface
without becoming noise. Work in `design-lab/runs/2026-11-02-wear-and-time/`.

## Harry's direction for this run
- History lives **on the object**, not in a separate log. A log may exist,
  but the object should already tell you most of the story at a glance.
- **Explain, never hide**, applied to time: a person should be able to ask
  any value "why are you like this, and since when?" and get an answer
  in place.
- Time has **one direction and one "now"**. Past is quieter than now;
  the future (deadlines, windows, expiries) is shown as distance to travel.
- Stale is a state, not a mystery. Anything out of date says so, says how
  old it is, and who can refresh it.
- Calm: wear is quiet, read in passing. Only things that need you light up
  (use the cinematic light language for that, not new signals).

## References and what to take from each
- **Hill and Hollan, edit wear and read wear** (Bellcore, 1992-94):
  history-enriched objects. Marks on the scroll bar show where editing and
  reading concentrated, banded by author; navigation and information in one
  control. Take: the scroll bar and the margin as a record.
- **Viégas and Wattenberg, History Flow** (IBM, 2004): every revision of a
  Wikipedia page as a vertical slice, authors as coloured bands, so vandalism,
  edit wars and stable text show as shapes. Take: a whole history read as
  one picture; "1 + 1 = 3" shapes that mean something.
- **Ted Nelson / Project Xanadu** (Maggie Appleton's "Xanadu patterns"):
  visible links, parallel documents, transpointing windows, versions,
  bi-directional links. Take: two states of one thing side by side, with
  lines joining what stayed the same.
- **Bret Victor, "Up and Down the Ladder of Abstraction"**: scrub time
  directly, then step up to see all times at once. Take: a scrubber that
  replays a state in place, and a "all versions overlaid" mode.
- **Geology and dendrochronology**: strata (deposits in order, an
  unconformity where record is missing), tree rings (good and bad years by
  ring width, fire scars). Take: layers and missing layers as honest data.
- **Patina, foxing and conservation practice**: museums mark repairs
  visibly (the Japanese *kintsugi* principle, conservators' "reversible and
  visible" rule). Take: a repair or correction stays visible as a seam.
- **Tide tables and almanacs**: future known events printed alongside the
  past; high water marks on bridges. Take: the deadline and the high-water
  mark as marks on the same scale.
- **NASA Open MCT** (already used for limits): stale-data marking and the
  "now" line. Take: reuse, don't reinvent.
- **Tufte, sparklines and small multiples**: history at word size.

## Surfaces (6 variants each)
1. **Artifacts reader**: a document that shows its own edit and read wear
   (scroll bar, margins, paragraphs), corrections as seams, and how far out
   of date each section is. Include "who has read this since it changed".
2. **Artifacts library and collection**: a shelf of documents where age,
   use and staleness read at a glance (patina, rings, sediment), without
   adding a column.
3. **Data Atlas fact provenance**: a fact as strata: where each value came
   from, which proposals were accepted or rejected, disputes as faults,
   gaps in the record as unconformities.
4. **Mandate intent over time**: an intent from being asked to its deadline:
   distance to travel, the high-water mark of effort, missed dates as tide
   lines, what changed in the ask.
5. **Time scrubber for any view**: replay a screen (a floor's Home, a
   library, an org view in Explorer) to any moment; "show me what changed
   since I was last here" as the default first move.
6. **Upgrade Centre and deployment history**: releases as rings or strata,
   rollbacks as scars, the maintenance window ahead as a known tide.

Round 2: combine into 3-4 screens. One must be "returning after two weeks
away": the shell tells you what changed while you were gone, in place, on
each object, then fades back to calm.

## Grammar sheet first
A **time language** sheet: the marks you will use (wear, seam, ring, stratum,
unconformity, tide line, high-water mark, now line, stale hatch, distance to
travel), each with its token recipe and what it must never mean.

## Questions the shortlist must answer
- Which marks are cheap enough to render on a library of 5,000 documents?
- What does AUGUR already record? The events service keeps domain events;
  say which marks it can feed today and what new events or fields each needs
  (for example read events per section, which have privacy implications:
  flag those for Harry).
- Privacy: read wear shows what colleagues read. Propose the rule (for
  example counts only below a floor's audience size, never names without
  consent) as a question for Harry, not a decision.
