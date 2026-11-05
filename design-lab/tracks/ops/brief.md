# Operations track brief

Read `../README.md` first, and the method sections of `../../brief.md`
(the loop, critique honesty, shape of the run). Ignore its UI rules. This
brief replaces them.

## What a run makes
Per variant, in `runs/<run>/<surface>/vN-<name>.md`: a procedure in the
form the variant argues for (a card, a checklist, a decision table, a
flow). Markdown only, printable on one or two A4 pages. Commands are real
commands from AUGUR's guides, never invented ones; where a guide has no
command, the card says so and who could add one.

Per run, in `runs/<run>/checks/`:
- `scenario.md`: the scripted failure, written as what the operator SEES
  at each step (messages, command output, timings), with branches for
  the likely wrong moves. Written before the variants, so the variants
  can't be fitted to it.
- `key.md`: the right path, the steps that can't be undone, and what a
  wrong turn costs.
- `tabletop-<variant>.md`: the result of the check (below).

## The check: a tabletop
A fresh agent, who has not seen the run's notes, is given one card and
plays a tired admin at 2am. The run's author plays the server from
`scenario.md` and answers only what the operator asks or does. Record:
steps taken, time-equivalent (turns), wrong turns, any step that couldn't
be undone taken without the card warning first, and where the operator
had to guess. Score the card from that, not from how it reads.

## Read first
- `docs/upgrade.md`, `docs/deploy.md`, `docs/observability.md` and
  ADR 0045 (the bake gate) in `augur`; the updater's halt behaviour.
- `../../concepts/README.md`, especially `stop-dont-guess`,
  `the-way-back-is-recorded`, `consequence-preview`, `silence-is-not-a-go`,
  `the-readback-moves-it`.

## Principles (the spec)
- Explain, never hide: the card says why a step matters and who can help.
- Agents can't see Harry's servers: every check is a command whose output
  a person can read or paste.
- Steps that can't be undone are marked before you reach them.
- Calm: the card works for a tired person, not a hero.

## Critique (`notes.md` per surface)
For each variant: **Vn: name**; *Idea*; *Sources*; *Tabletop result*;
*What works*; *What fails or risks* (missed failure modes, length, where
it goes stale as AUGUR changes, who maintains it); *Needs* (commands,
status the updater doesn't report yet); *Score* 1-5 for Recovery under
stress, Safety (irreversible steps guarded), Upkeep, Fit with AUGUR's
guides. End with a ranked list.
