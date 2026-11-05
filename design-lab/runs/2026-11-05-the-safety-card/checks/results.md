# Reader test results

Four fresh readers, one text each, with `questions-only.md`. Graded
against `questions.md`. Their answers are in `reader-source.md`,
`reader-combined.md`, `reader-v3-run-sheet.md` and
`reader-v4-card-per-note.md`.

**Words read** is counted from the top of the text to the line each
reader said they first found the answer (their own line numbers). For Q8,
"all" means the reader had to read the whole text to be sure it doesn't
say.

## Accuracy

| Text | Words | Right | Wrong | Q8 "doesn't say" | Guessed |
|---|---|---|---|---|---|
| `source.md` (baseline) | 6,670 | 7 of 7 | 0 | correctly | 0 |
| `combined/section.md` | 6,489 | 7 of 7 | 0 | correctly | 0 |
| `whole-set/v3-run-sheet.md` | 1,861 | 7 of 7 | 0 | correctly | 0 |
| `whole-set/v4-card-per-note.md` | 4,896 | 7 of 7 | 0 | correctly | 0 |

Every reader got every question right, Q7 in full (the first-upgrade
rule, the Sunday window, the time zone and the 0.x minor). Nobody
invented a route from 0.9. **On accuracy, no rewrite beat the original.**
What we predicted in `questions.md` was wrong: Q5 and Q6 were not missed,
and Q8 was not guessed.

## Words read before the answer

| Q | source | combined | v3 run sheet | v4 cards |
|---|---|---|---|---|
| 1 Mandate's settings | **119** | 323 | 286 | 225 |
| 2 Keycloak: before | 587 | 183 | **172** | 690 |
| 3 Keycloak: check | **740** | 964 | 899 | 819 |
| 4 Keycloak: going back | 883 | 1,085 | 1,020 | **706** |
| 5 6 GB of memory | 485 | 520 | **470** | 589 |
| 6 the rename release | 1,235 | 767 | **710** | 1,233 |
| 7 upgrading by itself | 2,221 | 1,256 | **1,191** | 1,971 |
| 8 go through a release? | all (6,670) | 126 | **102** | all (4,896) |
| Mean, Q1 to Q7 | 896 | 728 | **678** | 890 |

- The run sheet (v3) and the combined section's Part A were faster on
  Q2, Q6, Q7 and above all Q8: the "what these notes don't tell you"
  list at the top let the reader stop at about 100 words, where the
  source and the cards made them read everything.
- They were slower on Q1, Q3 and Q4, which sit behind the long `.env`
  table.
- The cards (v4) were no faster than the source overall (890 against 896).
- The combined reader found every answer in Part A. Part B, the cards,
  added 4,600 words and no answers. The combined section is about as long
  as the source (6,489 against 6,670).

## Doubts the reader raised

| Text | Doubts the text caused | Gaps the text declared, and the reader saw |
|---|---|---|
| source | Q2 "step 4 above" and "the steps above" point outside the text; Q4 the Keycloak release is 0.18.0 only by inference; Q5 no values for "lower"; Q6 "before the rename" after the rename; Q7 **a real contradiction** (apps take "only 0.x patches", line 72, against "patch and minor releases", line 96) and whether a by-hand upgrade counts; Q8 several hand-only releases suggest several steps | none |
| combined | Q5 no values for "lower"; Q7 whether a by-hand upgrade counts | Q3 a failed check; Q5 what happens if skipped; Q6 "before the rename"; Q8 |
| v3 run sheet | Q5 no values; Q7 whether a by-hand upgrade counts; the "Required?" column read as covering every row | Q3; Q5; Q6; Q8 |
| v4 cards | Q2 "Before you start, step 4" is outside the text; Q5 no values; Q7 spread over three cards, plus by-hand; Q8 the rename card and the Keycloak card "pull in different directions" | Q3; Q5; Q6; Q8 |

Two things the rewrites didn't fix, found by the readers:
1. **The apps contradiction** (Q7). It is in the source, and the cards
   and the combined section carry both sentences into cards 10 and 13.
   Keeping every fact kept a contradiction. It should have been
   `[open: lines 72 and 96 disagree for apps]`.
2. **"By hand" means two things.** The source's heading "Automatic waits
   for one upgrade by hand" means "an upgrade an admin starts from the
   Upgrade Centre"; everywhere else in the guide "by hand" means without
   the updater. All four readers had to infer that their by-hand upgrade
   doesn't count. The rewrites dropped the word from that heading but
   didn't say outright that an upgrade without the updater doesn't count.

## What the test can and can't show
The readers were careful agents with no clock: the source reader read
all 328 lines. That is not the prompt's tired admin with twenty minutes.
With every question answered right everywhere, this test measures speed
and doubt, not accuracy. A test with a word budget (stop after 1,500
words) or a task ("write the steps you'd take, in order") would separate
the texts; see SHORTLIST, method notes.

The sample note (surface 4) has not been tested.
