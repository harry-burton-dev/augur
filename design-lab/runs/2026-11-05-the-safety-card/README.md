# The safety card

The first run on the lab's writing track (5 November 2026, batch 7, WR1):
what AUGUR's upgrade notes look like if they are written to be acted on
and tested on readers, the way airline safety cards are. The text is
"Release notes that need you" in `docs/upgrade.md`: 37 notes, 6,670 words.
The reader is an admin on one server, upgrading from 0.9 after two months
away, with twenty minutes.

Sources: the FAA's card-comprehension studies (Corbett, McLean and
Cosper), the GOV.UK style guide and Sarah Richards' *Content Design*, the
US Plain Writing Act and Federal Plain Language Guidelines, DITA's task,
concept and reference topics, Keep a Changelog and Ubuntu's upgrade notes,
and the inverted pyramid.

**Status: four reader tests done** (`checks/results.md`): the source,
the combined section, the run sheet and the card per note. All four were
answered fully right; the run sheet was the fastest, at 28% of the
source's length. The one-note and next-note variants and the sample note
were not tested on their own.

## Files

| File | What it is |
|---|---|
| `prompt.md` | the prompt as run |
| `source.md` | the source section, copied from `docs/upgrade.md` lines 53 to 379 at commit 9ad4399 (the reader-test baseline) |
| `checks/questions.md` | 8 questions with answers and source lines, written before any rewrite (Q8 can't be answered from the source) |
| `checks/questions-only.md` | the same questions, without answers, for the tester |
| `checks/sample-note-questions.md`, `checks/sample-note-questions-only.md` | 4 questions for the sample note (surface 4), with and without answers |
| `grammar.md` | the parts of an upgrade note and what each must never claim |
| `checks/results.md`, `checks/reader-*.md` | the four readers' answers and the graded results |
| `SHORTLIST.md` | ranked build order, answers to the prompt's questions, push-backs, method notes |
| `concepts.md` | new concepts |

## Variants

| Surface | Variant | Idea |
|---|---|---|
| One note: Keycloak 26.8 | [V1 safety card](one-note/v1-safety-card.md) | numbered panels, command beside its result, STOP before the way back |
| | [V2 front-loaded](one-note/v2-front-loaded.md) | the whole story in the first sentence |
| | [V3 three topics](one-note/v3-three-topics.md) | task, concept and reference kept apart |
| | [V4 if, then](one-note/v4-if-then.md) | every fact as a condition and its consequence |
| | [critique](one-note/notes.md) | |
| The whole set | [V1 index on top](whole-set/v1-index-on-top.md) | a 37-row verdict table over the notes as written |
| | [V2 by what you do](whole-set/v2-by-what-you-do.md) | grouped by verdict, each note cut to a few sentences |
| | [V3 run sheet](whole-set/v3-run-sheet.md) | one ordered sheet for the whole jump; **reader-tested** |
| | [V4 card per note](whole-set/v4-card-per-note.md) | the same parts on every note; **reader-tested** |
| | [critique](whole-set/notes.md) | |
| Writing the next note | [V1 fill-in template](next-note/v1-fill-in-template.md) | a block to copy |
| | [V2 seven rules](next-note/v2-seven-rules.md) | rules short enough for `AGENTS.md` |
| | [V3 before and after](next-note/v3-before-and-after.md) | three real notes, as written and as they should be |
| | [V4 checked by a script](next-note/v4-checked-by-a-script.md) | the rule is what CI can check |
| | [critique](next-note/notes.md) | |
| Round 2 | [combined section](combined/section.md) | run sheet (Part A) over numbered cards (Part B); **reader-tested** |
| | [template](combined/template.md) | the template for the next note |
| | [sample note](combined/sample-note.md) | the newest note, rewritten from the template |

## Reader tests

| Text | Result file |
|---|---|
| `source.md` (baseline) | `checks/reader-source.md` |
| `combined/section.md` | `checks/reader-combined.md` |
| `whole-set/v3-run-sheet.md` | `checks/reader-v3-run-sheet.md` |
| `whole-set/v4-card-per-note.md` | `checks/reader-v4-card-per-note.md` |

Still to run: `combined/sample-note.md` against `source.md` line 3, with
`checks/sample-note-questions-only.md`.
