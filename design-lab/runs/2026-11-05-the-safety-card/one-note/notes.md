# One note: critique

**The note chosen:** "Keycloak 26.8 and the realm job" (`source.md` lines
27 to 49, 368 words). It has the most things for the reader to do: four
numbered steps, a fix for one failure, and a three-command way back. It
is also the only note in the section that can't be undone. "The read key"
has as many steps (five), but they are once-per-account set-up, not an
upgrade, and "The app runner"'s eight steps describe what the runner does,
not what you do.

**These four were not tested on their own.** Their scores are the
author's reading. Questions 2, 3 and 4 are about this note, and its
parts went into the tested texts (`../checks/results.md`), so there is
indirect evidence:
- Every reader got Q2, Q3 and Q4 right on every text, **the source
  included**. The source's Keycloak note was not misread; the readers'
  one complaint about it was the pointer to "step 4 above", which every
  rewrite kept as "Before you start, step 4".
- Speed came from position, not form. Q2 was found at word 172 to 183
  where the backup and password are the first two steps of the run
  sheet, and at 690 in the card per note, which used V1's verdict line
  and V2's opening sentence (source: 587).
- So no one-note form showed a gain a reader could measure.

Measured on the text: words before the reader learns it can't be undone
(source: 38).

---

**V1: Safety card** (`v1-safety-card.md`, 435 words; warning at word 19)
- *Idea:* numbered panels, one action each, grouped as Before / Upgrade /
  Check, and a boxed STOP before the way back. The commands are the
  "pictures": what you type and what you see, side by side.
- *Sources:* FAA card studies (one action per panel, order over prose);
  ISO 7010's use of a signal word (STOP).
- *Reader result:* not tested on its own; see the evidence above.
- *What works:* the check is two rows with the exact output beside the
  command, the part a tired reader skips in the source. The file name to
  keep is in the step, not after it. The verdict line ("Do this by hand ·
  Can't go back without a restore") answers Q2 and Q4 in 19 words.
- *What fails or risks:* longest of the four (tables cost words). Markdown
  tables wrap badly in a terminal `less`, which is where some admins read
  `docs/`. The STOP box sits after the steps, so a reader who stops at
  step 5 never reaches it; only the verdict line warns them first.
  Upkeep: tables are painful to edit in a pull request diff.
- *Score (author's, untested):* Reader accuracy 4 · Speed 4 · Upkeep 2 · Voice 4.

**V2: Front-loaded** (`v2-front-loaded.md`, 352 words; warning at word 14)
- *Idea:* the inverted pyramid. The headline and the first sentence carry
  the whole story: back up, by hand, one way. Then plain bold-led
  paragraphs in action order.
- *Sources:* inverted pyramid; GOV.UK front-loading; Content Design ch. 4.
- *Reader result:* not tested on its own; see the evidence above.
- *What works:* shortest, and the closest to how docs/ is written now, so
  the cheapest to adopt. Someone who reads only the headline does the
  right thing.
- *What fails or risks:* the check step and the "lacks rights" fix share
  one paragraph, which is the mixing DITA warns about. "What changes for
  people" is a dense paragraph again. It relies on the writer's skill at
  the first sentence; a template can't enforce that.
- *Score (author's, untested):* Reader accuracy 4 · Speed 5 · Upkeep 4 · Voice 5.

**V3: Three topics** (`v3-three-topics.md`, 398 words; warning at word 34)
- *Idea:* DITA's split. Task (eight one-line steps, each result stated),
  concept (what changes and why), reference (a table of names and values,
  and the way back).
- *Sources:* DITA task/concept/reference; Federal Plain Language
  Guidelines (short sections).
- *Reader result:* not tested on its own; see the evidence above.
- *What works:* the task is the easiest list to follow at the server; the
  reference table is the fastest place to find a file name. Splitting
  showed the source's step 1 was two actions (back up, write the name).
- *What fails or risks:* the one-way warning is in the concept topic, and
  only a pointer in the task; the warning comes later than in any other
  variant (word 34, close to the source's 38). The way back sits in the
  reference, which reads as "look it up later", for the riskiest fact.
  Three headings per note times 37 notes is heavy.
- *Score (author's, untested):* Reader accuracy 4 · Speed 3 · Upkeep 3 · Voice 3.

**V4: If, then** (`v4-if-then.md`, 387 words; warning at word 17)
- *Idea:* every fact as a condition and its consequence, in two tables:
  one for the admin, one for people.
- *Sources:* Federal Plain Language Guidelines (tables for conditions);
  decision tables.
- *Reader result:* not tested on its own; see the evidence above.
- *What works:* writing it forced the gaps out: two rows had no "then" in
  the source (a failed check, going back without a restore). Those became
  `[open: ...]`, which no other form surfaced as clearly. The people
  table answers a help-desk question fast.
- *What fails or risks:* order is lost. "If you are about to upgrade" and
  "if you changed the password" read as alternatives, when both are
  steps. A reader at the server needs order more than conditions for a
  one-way release.
- *Score (author's, untested):* Reader accuracy 3 · Speed 4 · Upkeep 3 · Voice 3.

---

## Ranked (author's; untested, unchanged)
1. **V1 safety card**, for its verdict line and the check beside the command.
2. **V2 front-loaded**, for its first sentence, and because it is cheapest to keep.
3. **V4 if, then**, not as a form, but as the way to find the gaps while writing.
4. **V3 three topics**: right in principle, too heavy per note.

**Carried into round 2:** V2's one-sentence opening; V1's verdict line,
numbered steps with the result beside each check and the STOP before the
way back; V4's habit of writing every "if" with its "then", or `[open]`.

**Gaps the source leaves, listed in every variant:**
- What to do if `keycloak-config` doesn't end with the success line or exits non-zero.
- What fails if someone goes back without the restore.
- The backup commands are in "Before you start", outside this section; the note points to them. Two readers (source, cards) said this pointer left them unable to take the backup from the text alone. A note that needs a step from elsewhere should carry the step.
