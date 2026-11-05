# Tracks

The lab started with UI. A **track** takes the same loop to another kind
of work. Everything in `../README.md` and the method half of `../brief.md`
holds on every track: a borrowed practice from outside software, named
sources each with one "Take:", one real case, Harry's principles as the
spec, a grammar sheet first, genuinely different variants, an honest
scored critique, a combining round, a shortlist that answers named
questions and pushes back, harvested concepts, and a wildcard per batch.

Only three things change per track, and each track's `brief.md` names them:

1. **What a run makes** (the UI track makes HTML prototypes).
2. **The check** that keeps it honest (the UI track renders a screenshot).
   Outside UI the check is usually a **fresh reader**: an agent that sees
   only the artefact and has to use it, the way a screenshot sees only the
   page. The run writes the check pack (questions, a scripted failure, an
   answer key); a separate agent that has not seen the run's reasoning
   takes it; the result is recorded in `checks/`.
3. **What the critique also scores.**

| Track | Makes | Checked by | Brief |
|---|---|---|---|
| ui | standalone HTML prototypes | screenshot at 1600×900 and 1280×800 | [`../brief.md`](../brief.md) |
| data | schema, seed rows, queries for the case's questions, a migration | runs in throwaway SQLite; every question answers; migration applies | [`data/brief.md`](data/brief.md) |
| ops | procedure cards or runbooks, plus a scripted failure | tabletop: a fresh agent follows the card against the failure | [`ops/brief.md`](ops/brief.md) |
| writing | rewrites of one real AUGUR text | reader test: a fresh agent answers questions from the text alone | [`writing/brief.md`](writing/brief.md) |

Prompts carry `track:` in their front matter (no `track` means `ui`), and
so do concepts first found on a track. Concepts are shared: a rule found
by a data run can steer a UI run and the other way round.

Run size outside UI is smaller: a grammar sheet, three or four surfaces
with four variants each, then the combining round. Runs still go in
`runs/<date>-<slug>/` with `prompt.md`, `SHORTLIST.md` and `concepts.md`.
Nothing a track makes ships: a schema, procedure or text moves into the
product only through a record, a guide or an app's own pull request.

## What the first three runs taught (batch 7, 5 November 2026)
One run per track was a test of the method. Each run's `SHORTLIST.md`
has its own method notes; these are the changes for every track.

- **The check needs a separate author.** On all three runs the same mind
  wrote the case, the answer key and the variants, so variants can be
  fitted to the test. Next time a separate agent writes the scenario,
  the questions or the expected answers, before the run starts.
- **A fresh reader is a patient reader.** Agent readers answered 7 of 7
  on the original upgrade notes as well as on every rewrite: they read
  everything, which a tired admin won't. A reader test needs a budget
  (stop after N words or N minutes and answer) to tell texts apart.
- **Ops needs a live tabletop.** A tester can't play the server and the
  operator at once, so the run used walk-throughs: the operator writes
  every move and branch, then the run plays them against the scenario.
  It found real differences (the combined card lost to a round-1 card),
  but a two-agent, turn-by-turn tabletop would be truer.
- **Data checks pass too easily.** `check.py` gave a variant 5/6 even
  though nobody had decided its merge, and queries can name the seed's
  ids. Add probe questions the run doesn't see and test a migration from
  the variant before (`check-migration.py` in the type specimen run).
- **The critique can't be finished before the check.** Draft the notes,
  run the check, then score: the shape of a run is make → check → score.
- **The case must agree with the guides.** The ops prompt's case clashed
  with how AUGUR really upgrades; the run had to rewrite it. A prompt's
  case is checked against the guides when it is written.
- **The lab finds product work, not only patterns.** All three runs ended
  in concrete asks: notes that know their release, a watched go-back,
  merge evidence stored now. That is the strongest sign tracks are worth
  keeping.
