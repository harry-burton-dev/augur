# The whole set: critique

The source is 37 notes, 6,670 words, newest first. Four ways to restructure
it for an admin crossing many releases at once.

**Reader tests: done for V3 and V4, against the source** (full results in
`../checks/results.md`). V1 and V2 were not tested; their scores are
still the author's reading and say so. Every tested text, the source
included, got 7 of 7 right and said "the text doesn't say" for Q8. So the
test separated the texts on speed and on the doubts readers raised, not on
accuracy.

The first table is the pre-test proxy (words to a key phrase); the second
is what the readers did.

| Text | Words | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 (open) |
|---|---|---|---|---|---|---|---|---|---|
| source | 6,670 | 127 | 675 | 749 | 905 | 569 | 1,287 | 2,238 | never |
| V1 index on top | 7,543 | 993 | 1,541 | 1,615 | 1,771 | 1,435 | 2,153 | 3,104 | 90 |
| V2 by what you do | 1,158 | 159 | 409 | 453 | 494 | 732 | 692 | 950 | 39 |
| V3 run sheet | 1,861 | 299 | 186 | 907 | 1,032 | 483 | 732 | 1,240 | 56 |
| V4 card per note | 4,896 | 240 | 752 | 829 | 718 | 605 | 1,239 | 2,072 | 39 |

Counted with a short script (not kept) that finds a key phrase per answer; the answers are in
`../checks/questions.md`.

Words read by the tester before each answer (from their own line numbers):

| Text | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 | Mean Q1-7 |
|---|---|---|---|---|---|---|---|---|---|
| source | 119 | 587 | 740 | 883 | 485 | 1,235 | 2,221 | all | 896 |
| V3 run sheet | 286 | 172 | 899 | 1,020 | 470 | 710 | 1,191 | 102 | 678 |
| V4 card per note | 225 | 690 | 819 | 706 | 589 | 1,233 | 1,971 | all | 890 |

The proxy was close for V3 and V4, but it got Q8 wrong for V4: the
reader didn't trust the one-line note at the top, and read all 4,896 words.

**The finding before the test, which the test confirmed.** No rewrite can say which notes apply to
a server on 0.9. The source dates only three of 37 notes (0.17.0, 0.18.0,
the first `augur@` release). Every variant has to mark it `[open]` and
treat every note as possibly new. That is the reader's first need in the
prompt, and the text can't meet it without a fact from the changelogs.

---

**V1: Index on top** (`v1-index-on-top.md`)
- *Idea:* change almost nothing. Put a 37-row table on top: note, from,
  verdict, condition. Leave the notes as written (headings tidied, the
  names Artifacts and Explorer in prose).
- *Sources:* Keep a Changelog (a list a reader can scan); Ubuntu's
  release notes "upgrade" section (a short list of what to act on, then
  the detail).
- *Reader result:* not tested.
- *What works:* cheapest by far: one row per new note. It is the only
  variant a writer could adopt today without rewriting 37 notes. The
  "From" column makes the missing versions impossible to miss: 34 of 37
  rows say `[open]`.
- *What fails or risks:* the steps are still buried in the paragraphs the
  index points to. Q5's memory step stays in a note that opens with "Nothing
  to do on most servers". The longest text of all. The verdicts are mine:
  a reader trusts the table and skips the note.
- *Score (author's, untested):* Reader accuracy 3 · Speed 3 · Upkeep 5 · Voice 3.

**V2: By what you do** (`v2-by-what-you-do.md`)
- *Idea:* regroup the notes by verdict: do before, by hand, check if, worth
  knowing. Each note cut to one to three front-loaded sentences.
- *Sources:* GOV.UK content design (start with the need; cut); Federal
  Plain Language Guidelines (short sections, "you").
- *Reader result:* not tested.
- *What works:* shortest (1,158 words, a sixth of the source). Q7's two
  halves, split across two notes 870 words apart in the source, sit in
  one bullet. Every answer is in the first thousand words.
- *What fails or risks:* the most facts cut: the read key's GitHub steps,
  every optional set-up, the watch's quiet-server rules, Reporting's
  record. They are marked `[cut]`, but the reader then needs the old
  guide. Settings are listed per note, so the admin crossing many
  releases still builds the `.env` list by hand.
- *Score (author's, untested):* Reader accuracy 4 · Speed 5 · Upkeep 3 · Voice 4.

**V3: Run sheet** (`v3-run-sheet.md`) **tested**
- *Idea:* one ordered sheet for the whole jump. Before (backup, one table
  of every setting to add, conditions), releases you must not skip, upgrade,
  check, the way back per change, after, optional set-up. The notes
  disappear as units; their facts are filed by when you act.
- *Sources:* the FAA cards (order over prose: what to do first is on top);
  a theatre or flight-deck run sheet; DITA task topics.
- *Reader result:* 7 of 7 right, Q8 "doesn't say" correctly, no guesses;
  the baseline did the same. Fastest tested text: mean 678 words to an
  answer against 896, and Q8 settled at word 102 against reading all
  6,670. Fewest doubts (two, against the source's six): no values for
  "lower" memory limits (a source gap) and whether a by-hand upgrade counts
  as "the first one". New doubt it caused: the reader read "Required?" as
  covering every row of the `.env` table, including the `[open]` ones.
  Slower than the source on Q1, Q3 and Q4, which sit behind that table.
- *What works:* it's the shape the reader in the prompt needs: one pass
  down the page, at the server. The backup and the Keycloak password are
  steps 1.1 and 1.2, before anything else (Q2 at word 186, against 675).
  One `.env` table with a "required?" column answers Q1 and twelve other
  notes at once. The way-back table is the only place in any text that
  says, for every change, what going back costs, and it says `[open]` for
  the rest instead of staying silent.
- *What fails or risks:* **upkeep is the worst of the four**: a new note
  has to be split across up to five sections, and a writer adding one
  row at a time will get the order wrong. Notes lose their identity, so
  "what came in 0.18?" is hard to answer. Cuts the optional set-ups to
  one line each. The "required?" column needed three `[open]`s where the
  source says "needs" or "add" rather than "required".
- *Score (after the test):* Reader accuracy 5 · Speed 5 · Upkeep 2 · Voice 4.

**V4: Card per note** (`v4-card-per-note.md`) **tested**
- *Idea:* keep the 37 notes and their order, but every note is the same
  card: a headline that is a sentence, then **From · Verdict · Way back**
  on one line, then **If / Do / Check / Skip it and / Why** as labelled
  bullets.
- *Sources:* the safety card's fixed panels (the same place for the same
  thing); DITA's typed topics; the inverted pyramid (the headline is the story).
- *Reader result:* 7 of 7 right, Q8 correct, no guesses, the same as the
  baseline. **No faster than the source** (mean 890 against 896), and Q8
  still needed the whole text. Doubts: four, against six. It kept the
  source's pointer to "Before you start, step 4", outside the text; the
  reader found the Q7 answer spread over three cards; it carried the
  source's contradiction on apps' 0.x minors into cards 10 and 13; and the
  reader felt the rename card ("run it") and the Keycloak card ("not in a
  window") pull different ways. The verdict line and sentence headings
  didn't show up as speed.
- *What works:* nearly every fact kept (4,896 words; the cuts are a few
  how-it-works details). The same three slots on every card mean a reader
  scans 37 first lines in a minute. Headlines like "Don't skip the
  release that comes with the repository's new name" put Q6's consequence
  in the heading. It is what a template can make a writer produce, so it
  is the one that stays good as notes are added.
- *Cut from the source* (none is needed by the questions): going back to
  a release before AUGUR's own Keycloak image leaves Keycloak running until
  it is recreated; the updater's `check` doesn't let sign-in miss once; the
  app runner's 15-minute release check, `APP_FEED_URL`, `APPS_NETWORK`,
  its API example, pull-request previews, and that a version installed
  before the runner kept its manifest can't be gone back to by itself; the
  platform's own services keep their own upload limits. These cuts carry into the combined section.
- *What fails or risks:* still long, and still in release order: the admin
  crossing many releases gathers settings from eleven cards. Labels on
  every bullet are heavy for the 16 "nothing to do" notes. "Way back
  [open]" on 30 cards is honest but noisy.
- *Score (after the test):* Reader accuracy 5 · Speed 3 · Upkeep 5 · Voice 4.

---

## Ranked (after the test; the order is unchanged)
1. **V3 run sheet**: the only tested text faster than the source, at 28%
   of its length, with the fewest doubts. Its upkeep still needs it to be
   generated, not written.
2. **V4 card per note**: as accurate as the source and no faster. Its
   value is as the record a run sheet is made from, not as the thing
   people read.
3. **V2 by what you do** (untested): likely as fast as V3, but cuts too
   much to replace the guide.
4. **V1 index on top** (untested): cheapest; keep its "From" column as a
   forcing device.

**Tested:** V3 and V4, the two ideas round 2 combines. Testing them
apart showed which one did the work: the run sheet. The combined reader
found every answer in Part A (the run sheet) and none in Part B (the
cards).

**Gaps every variant had to mark `[open]`:** the release for 34 of 37
notes; whether 0.9 can upgrade straight to the current release; what
happens if `SERVER_RING` is missing or memory limits aren't lowered;
what to do if the realm job's check fails; what "before the rename" means
after the rename; the way back for most notes.
