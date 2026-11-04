---
batch: 3
kind: steered
concepts: [mine-versus-ours, hear-the-reach, the-object-explains-itself, data-wears-its-label]
---

# Prompt L: The label. Governance you can see on the data.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-the-label/prompt.md`.

---

Governance usually lives in a policy document nobody reads and a
permissions screen only admins see. Operators meet it as "access denied".
This run asks how **governance** (who may see, use and share data, how
sensitive it is, where it came from, how long it is kept, what it may be
used for) can be carried **on the data itself**, the way food carries its
allergens and a government paper carries its classification marking, so
operators make the right call without reading the policy. Work in
`design-lab/runs/<date>-the-label/`.

## Direction
- **Data wears its label.** Sensitivity, permitted use, origin and
  retention travel with every record and every value copied from it.
- **Read in a second, explained in a click:** the label is short; the
  reason behind it is one step away (explain, never hide).
- **"Not for you" says why and who can change it**, never just "denied".
- **Sharing shows the reach** before it happens (hear-the-reach): which
  floor, how many people, and whether the label allows it.
- Many deployments: every marking scheme comes from the deployment's own
  policy, not a hard-coded list; calm at rest (from the brief).

## References and what to take from each
- **UK Government Security Classifications** (OFFICIAL, SECRET, TOP
  SECRET; the OFFICIAL-SENSITIVE marking and handling caveats). Take: a
  tiny, fixed scheme people actually apply, marked at the top of the page.
- **Food labelling**: allergen bold type, traffic-light nutrition labels.
  Take: the few things that matter, in a format people already read.
- **The Dataset Nutrition Label** (Data Nutrition Project, 2018) and
  **Datasheets for Datasets** (Gebru and others, 2018). Take: what a
  dataset should say about itself before you use it.
- **Creative Commons licence badges**: legal terms as a few symbols with
  a plain-words deed. Take: permitted use as a badge with a deed behind it.
- **Chain of custody** in evidence handling. Take: an unbroken record of
  who held what and when.
- **Consent receipts** (Kantara Initiative). Take: a person's consent as a
  record they can see and revoke.

## Surfaces (6 variants each)
1. **Label sheet** (grammar): marking, permitted use, origin, keep until,
   caveat, custody; the plain word, the symbol, the deed behind it.
2. **The label on a record**: an entity or document carrying its label,
   and what happens to the label when a value is quoted elsewhere.
3. **Not for you**: what an operator sees of something they can't open:
   that it exists (when they may know), why not, who can change it.
4. **Sharing across floors**: publish or share with the reach and the
   label checked first, and what the label stops.
5. **A dataset's own label**: the nutrition-label view of a collection
   (where it came from, how complete, what it may be used for).
6. **Custody**: who has held, changed and shared a record, read like a
   chain, not an audit log.

Round 2: combine into 3-4 screens. One must follow one sensitive fact from
a source document, into Data Atlas, into an answer, and into a shared
briefing, with its label intact the whole way.

## Questions the shortlist must answer
- Which labels must AUGUR enforce, and which only show?
- How does a label combine when values with different labels meet in one
  answer or document (the strictest wins? and does it say so?).
- What each app would need to send and keep (labels per value, custody
  events) that it doesn't today. Flag anything that needs an ADR.

## Carry from earlier runs
Read `design-lab/concepts/README.md`, especially `mine-versus-ours`,
`hear-the-reach` and `the-object-explains-itself`.
