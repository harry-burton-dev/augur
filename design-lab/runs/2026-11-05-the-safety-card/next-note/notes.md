# Writing the next note: critique

The surface asks for a rule or template a coding agent follows when it
adds a note in a pull request, tested by a reader test on a note written
from it. The note is `../combined/sample-note.md`, written from
`../combined/template.md` (V1 plus V4's checks). Its questions are in
`../checks/sample-note-questions.md`.

**Scores are provisional, and stay so.** The sample note was not in the
reader tests (`../checks/results.md`). The one tested text built from
the template's shape, the card per note, was as accurate as the source
and no faster, so there is no evidence yet that the template helps a
reader; its case is upkeep and the version line. A
template is also tested twice: does a writer produce a good note from it,
and does a reader then use the note? This run can only do the second. The
first needs a writer who hasn't seen the run (see SHORTLIST, gaps).

**Found while writing these:** the reason 34 of 37 notes have no release
is structural, not carelessness. A note is written in the pull request
that makes the change; the release number is only decided later, when the
Version packages pull request merges (docs/versioning.md). The writer
can't know it. So every variant uses `From unreleased`, and something at
release time has to fill it in.

---

**V1: Fill-in template** (`v1-fill-in-template.md`)
- *Idea:* a block to copy, every part in a fixed place, with a short
  comment on how to fill each.
- *Sources:* the grammar sheet; DITA task topic; the safety card's fixed panels.
- *Reader result:* not tested (the sample note wasn't in this round).
- *What works:* a coding agent follows a template more reliably than
  prose rules: the parts are either filled or visibly empty. It makes the
  whole set look like V4 of the whole-set surface, which scored best on upkeep.
- *What fails or risks:* templates invite filler. "Skip it and: nothing
  breaks" on every note is noise. A writer can fill every blank and still
  bury the condition. The label set is heavy for a "nothing to do" note.
- *Score (author's, untested):* Reader accuracy 4 · Speed 4 · Upkeep 4 · Voice 4.

**V2: Seven rules** (`v2-seven-rules.md`)
- *Idea:* rules short enough to live in `AGENTS.md`.
- *Sources:* Federal Plain Language Guidelines; GOV.UK style guide.
- *Reader result:* not tested.
- *What works:* short; it travels to other repositories' `AGENTS.md`
  (the apps write upgrade notes too). Rule 6 ("if" with "then") is the
  single rule that would have fixed Q5.
- *What fails or risks:* rules are read once and forgotten; no shape to
  match. Different writers will produce different layouts, which breaks
  scanning across 37 notes.
- *Score (author's, untested):* Reader accuracy 3 · Speed 3 · Upkeep 5 · Voice 5.

**V3: Before and after** (`v3-before-and-after.md`)
- *Idea:* three real notes, as written and as they should be.
- *Sources:* subediting (a sub shows the reporter the cut, not a rule);
  Content Design's worked examples.
- *Reader result:* not tested.
- *What works:* the most persuasive to a human writer, and it shows the
  three failure kinds found here (hidden condition, buried consequence,
  steps mixed with why).
- *What fails or risks:* examples go stale as the guide changes. It
  doesn't say what to do for a kind of note it hasn't shown.
- *Score (author's, untested):* Reader accuracy 3 · Speed 3 · Upkeep 2 · Voice 4.

**V4: Checked by a script** (`v4-checked-by-a-script.md`)
- *Idea:* the rule is whatever CI can check: ten checks, beside
  `check:reasons` and `check:settings`, plus a release step that fills
  `From unreleased`.
- *Sources:* AUGUR's own `check:*` scripts; DITA's schema-checked topics.
- *Reader result:* not tested; checks the shape, not the reading.
- *What works:* the only variant that holds when nobody is looking.
  Check 4 (a required setting in the schema but "nothing to do" in the
  note) would have caught a real class of error. Check 2 with the
  release step closes the version gap for every future note.
- *What fails or risks:* it is a new script, so new upkeep, and the
  release step touches the release workflow. It can't check truth.
  A writer can satisfy all ten checks with a bad note.
- *Score (author's, untested):* Reader accuracy 3 · Speed 3 · Upkeep 4 · Voice 3.

---

## Ranked (provisional)
1. **V1 template**, with **V4's checks** behind it: this is `../combined/template.md`.
2. **V2 seven rules**: the text for `AGENTS.md`, pointing at the template.
3. **V4 checks**, built later, once the template has been through a reader test.
4. **V3 before and after**: keep as the template's examples, not as the rule.
