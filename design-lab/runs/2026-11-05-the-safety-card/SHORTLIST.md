# Shortlist: the safety card

Reader tests done for the source, the combined section, the run sheet
(whole-set V3) and the card per note (whole-set V4). Results are in
`checks/results.md`. The one-note and next-note variants and the sample
note were not tested on their own.

**The headline: on accuracy, the rewrites didn't beat the original.**
Every reader, on every text, the source included, got all seven
answerable questions right and said "the text doesn't say" for the
eighth. What the rewrites changed was speed and doubt:
- **The run sheet** was the only text clearly faster: 678 words read per
  answer on average, against the source's 896. It settled Q8 at word 102,
  where the source made its reader read all 6,670 words. It is 28% of the
  source's length, and its reader raised two doubts against the source's six.
- **The card per note** was no faster than the source (890), and raised four doubts.
- **The combined section** is about as long as the source (6,489 words
  against 6,670). Its reader found every answer in Part A, the run sheet,
  and none in Part B, the cards. Part B added length and no answers.

The readers also found two problems in the source that the rewrites
**kept**: a contradiction about apps and 0.x minors (lines 72 and 96),
and "by hand" meaning two different things. Keeping every fact kept a
contradiction.

And the admin's first question, "which of these apply to me?", still
can't be answered by any text: the source dates 3 of 37 notes. Every
reader said so in their own words.

**A caution about the test.** The readers were careful agents with no
clock; the source's reader read every line. That is not a tired admin
with twenty minutes. A test where everyone scores full marks can't show
which text prevents mistakes. See "Method notes".

## Ranked build order

| # | Build | Look at | Evidence |
|---|---|---|---|
| 1 | **One sheet for the jump, generated**: for an upgrade across many releases, one ordered sheet (backup first, one `.env` table, releases not to skip, check, the way back per change, after). Made from the notes for the range being crossed, never kept by hand | [run sheet](whole-set/v3-run-sheet.md), [combined](combined/section.md) Part A | The only tested text faster than the source, at 28% of its length, with the fewest doubts. Its upkeep by hand is the worst, so it has to be generated |
| 2 | **Every note knows its release**: `From unreleased` in the pull request, filled in at release; backfill the 34 missing | [checked by a script](next-note/v4-checked-by-a-script.md), [template](combined/template.md) | Every reader, on every text, said they couldn't tell which notes apply to 0.9 or which release the rename was. No wording fixes it. It is also what the Upgrade Centre filter needs (below) |
| 3 | **Say up front what the text can't tell you**: a short list at the top, phrased as the reader's own questions ("whether you can upgrade straight from your release…") | [run sheet](whole-set/v3-run-sheet.md), "What these notes don't tell you" | The run sheet and combined readers settled Q8 at about 100 words. The card-per-note reader had a one-line version ("Most are `[open]`") and still read all 4,896 words. A named question works; a general warning doesn't |
| 4 | **Fix the source before rewording it**: resolve the apps 0.x-minor contradiction, give "by hand" one meaning, say what "before the rename" means now, and carry steps a note points to ("step 4 above") into the note | [results](checks/results.md), "Doubts" | Found by the readers, not by the author. A rewrite that keeps every fact keeps every contradiction; a contradiction should be `[open]` until a docs fix lands |
| 5 | **Verdict first, in the template**: a heading that is a sentence, then `From · verdict · Way back` | [template](combined/template.md), [card per note](whole-set/v4-card-per-note.md) | **Demoted from first.** No measurable gain for the reader: the cards were no faster than the source. Kept because it gives the run sheet its data (verdict, settings, way back) and a check can enforce it |
| 6 | **A check on the notes in CI**: `From`, verdict, way back, settings against `settings.schema.json`, names | [checked by a script](next-note/v4-checked-by-a-script.md) | Untested. It holds the shape of notes 5 and 2; it can't check truth |

**Worth keeping as options:**
- [Index on top](whole-set/v1-index-on-top.md) (untested): a verdict table over the notes as they are; possible today.
- [By what you do](whole-set/v2-by-what-you-do.md) (untested): likely as fast as the run sheet, but it cuts too much to replace the guide.
- [If, then](one-note/v4-if-then.md), as the way a writer finds the gaps, not as the form of the note.

**Not worth pursuing:**
- The combined section as written: Part B doubled it and did no work for the reader. Ship the run sheet for reading and keep the cards as its source.
- [Three topics](one-note/v3-three-topics.md) per note: too heavy for 37 notes.
- "Pictures over prose" taken literally: the guide is read in a terminal as often as a browser.

## Answers to the prompt's questions

**What did the reader get wrong on the original, and does the rewrite fix
it without losing a fact?** Nothing. The source's reader got every
answer right, so there was nothing to fix on accuracy; our prediction
that Q5 and Q6 would be missed was wrong. What the source did cost was
time and doubt: Q7 at word 2,221 across two notes, Q8 only after the
whole text, and six doubts, two of them real faults in the source (the
apps contradiction and "by hand"). The run sheet cut the time and the
doubts. It didn't lose a fact the questions needed, but it cut the
detail of the optional set-ups to one line each; the cards kept nearly
every fact (the cuts are listed under V4 in `whole-set/notes.md`).
Neither fixed the two faults, because a rewrite may not settle what the
source leaves unclear.

**Should notes be filtered by "from version" in the Upgrade Centre, and
what would that need?** Yes. It is the only route to the reader's first
question, and the run sheet only works if it is made for the range a
server crosses. The Upgrade Centre already shows a **Needs you first**
list for one release. It needs:
1. a release on every note (row 2), and the 34 missing ones backfilled from the changelogs;
2. the notes as data: id, `from`, verdict, settings added (and required
   or not), the way back, carried with the release, for example in the
   `augur-release.json` the Release workflow already attaches;
3. the run sheet generated from that data for the server's range (row 1);
4. a check that every required setting added to `settings.schema.json` has a note.

**What rule goes into `AGENTS.md` so the next thirty notes are written
this way?** Proposed, for "Working on a change":

> - **Upgrade notes.** When an admin upgrading must act or know something
>   because of your change, add a note at the top of "Release notes that
>   need you" in docs/upgrade.md, from the template there: a heading that
>   is a sentence; `**From** unreleased · <Do before | By hand | Check |
>   Nothing to do> · **Way back** <the code step | a restore and what is
>   lost | can't>`; numbered steps a reader can follow without leaving the
>   note; a check; what breaks if it's skipped; why last. Mark anything
>   you don't know `[open: ...]`. If your note contradicts an older one,
>   fix the older one in the same pull request.

It needs the template copied into `docs/` (`combined/template.md` here)
and a release step that fills `From unreleased`. Until that exists, the
author of the Version packages pull request fills it.

## Where this pushes back
- **On the prompt's reader.** `release/augur-release.json` says the
  current release (0.18.0) upgrades only from 0.17.0 or later, so the
  prompt's admin can't go from 0.9 in one jump, and the section never
  says so. The test kept that admin; a real 0.9 server crosses several
  releases, each with its own preflight.
- **On the prompt's premise.** It assumed the notes are slow to *act on*
  because the steps are buried. The readers found the buried steps fine.
  What they couldn't do was tell what applies, and they tripped on
  contradictions. That is upkeep and data, not prose.
- **On "keep every fact".** It kept a contradiction. A writing run needs
  to mark a contradiction `[open]` rather than copy both sides.
- **On "newest first".** It is right for the cards (the record) and wrong
  for the reader crossing many releases, which the run sheet fixes.

## Decisions for Harry (none taken)
1. Add the `AGENTS.md` rule above, and copy the template into `docs/`?
2. A docs pull request to fix the source's faults (apps and 0.x minors,
   "by hand", "before the rename", "step 4 above") and backfill the 34 releases?
3. Should the notes become data carried with the release, so the Upgrade
   Centre can generate the run sheet for a server's range?
4. Until then, should docs/upgrade.md carry a run sheet by hand, knowing
   its upkeep is the worst of any form?

## Gaps
- A harder reader test: a word budget or a task (see below), and two readers per text.
- The sample note, and a writer test of the template.
- In the source: the release for 34 notes; what happens without `SERVER_RING` or with unlowered memory limits; what values "lower" means; what to do if the realm job's check fails; the way back for most notes.

## Method notes: what the writing track brief should change
1. **Make the test able to fail.** Careful readers with unlimited time
   scored full marks on every text, the source included. Give the reader
   a budget (stop after 1,500 words, or a fixed number of turns) or a
   task ("list what you'd do on the server, in order") graded against a
   key of steps, and count steps missed, wrong or out of order.
2. **Questions from someone else.** The author wrote the questions and
   the variants; that invites writing to the test. Have the check pack
   written by an agent that only sees the source and the prompt.
3. **Two readers per text, at least.** One reader is a sample of one;
   readers differ (the card-per-note reader read the whole text for Q8
   though the answer was at the top).
4. **Ask readers for doubts, and grade them.** The most useful results
   were the doubts the readers raised, not the scores. Make "what made
   you unsure" a required part of every answer, and give the critique a
   doubts column.
5. **A lane for cited facts from elsewhere.** The reader's main need was
   a fact outside the source (each note's release, the supported upgrade
   path). Allow a rewrite to add a fact from the repository, cited, and
   marked as added, so a run can do more than reword.
6. **Contradictions are `[open]`.** Add to the brief: where the source
   disagrees with itself, the rewrite marks it, and doesn't keep both.
7. **Measure words read from the reader's own line numbers.** It worked,
   and it is cheap; the brief should say so instead of leaving it open.
8. **Size the combining round.** Round 2 here added the two winners
   together and doubled the length. The brief should ask what the
   combined text drops, not only what it keeps.
9. **Name the test of a template.** Surface 4 needs a writer test (a
   fresh agent writes a note from the template) as well as a reader test.
10. **Let the run wait for its tests.** The critique format asks for
    reader results inside a run whose tests run afterwards; say that a
    run is drafted, tested, then finalised.
