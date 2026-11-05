# Writing track brief

Read `../README.md` first, and the method sections of `../../brief.md`
(the loop, critique honesty, shape of the run). Ignore its UI rules. This
brief replaces them.

## What a run makes
Per variant, in `runs/<run>/<surface>/vN-<name>.md`: a rewrite of the
prompt's real AUGUR text in the form the variant argues for. The facts
must be the original's: a rewrite may cut, reorder, restructure and
reword, never add a fact the source doesn't hold. Where the source is
unclear or missing something, the rewrite marks it `[open: ...]` and the
critique lists it.

Per run, in `runs/<run>/checks/`:
- `questions.md`: 6 to 8 questions a real reader must answer from the
  text, written from the source BEFORE the variants, each with its answer
  and where in the source it comes from. Include one question the source
  can't answer (the right answer is "the text doesn't say").
- `reader-<variant>.md`: the result of the check (below), and one for the
  original text as the baseline.

## The check: a reader test
A fresh agent, who has not seen the source or the run's notes, gets one
text and the questions (not the answers), and answers from the text
alone, quoting the line each answer came from. Record: right, wrong, and
"the text doesn't say"; any answer the reader got right by guessing; the
words read before the answer was found. Score the text from that, not
from how it reads to its author.

## Read first
- The source text named in the prompt.
- `AGENTS.md` in `augur` (names and rules), the handbook's writing rules
  where the prompt points to them.
- `../../concepts/README.md`, especially `plain-words-first`,
  `said-in-a-sentence`, `the-readers-minute`, `context-names-its-reader`.

## Principles (the spec)
- Plain words first; short sentences; the reader's next action first.
- Names from AUGUR's rules: AUGUR, Artifacts, Explorer; no code names in
  what a person reads.
- Explain, never hide: say what is not known and who can change it.
- Many deployments: no one server's names, paths or URLs as if universal.

## Critique (`notes.md` per surface)
For each variant: **Vn: name**; *Idea*; *Sources*; *Reader result*
(right / wrong / doesn't say, vs the original's baseline); *What works*;
*What fails or risks* (lost facts, length, upkeep as releases add notes);
*Score* 1-5 for Reader accuracy, Speed to the answer, Upkeep, Fit with
AUGUR's voice. End with a ranked list.
