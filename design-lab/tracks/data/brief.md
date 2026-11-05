# Data track brief

Read `../README.md` first, and the method sections of `../../brief.md`
(the loop, critique honesty, shape of the run). Ignore its UI rules
(tokens, icons, screenshots). This brief replaces them.

## What a run makes
Per variant, in `runs/<run>/<surface>/vN-<name>/`:
- `schema.sql`: SQLite DDL. Keep it portable to Postgres (Data Atlas runs
  on Postgres): no SQLite-only types, `TEXT` timestamps in ISO 8601.
- `seed.sql`: the case's rows, a dozen to a few dozen, as real-sounding as
  the case. Names and floors are sample data, never deployment literals.
- `questions.sql`: one query per question in the prompt, each preceded by
  `-- Q1: <question in plain words>` and `-- expect: <the answer>`.
- `migrate.sql` when the surface asks for one: from the variant before, or
  from Data Atlas's shape today.
- `notes.md`: the critique (below).

## The check
`python3 -I ../../../tracks/data/check.py <variant folder>` loads schema
and seed into an in-memory SQLite database, runs each question, compares
with `-- expect:` and prints pass or fail per question. A variant that
fails a question says so in its critique; never edit `expect` to pass.

## Read first
- Data Atlas today: the `augur-atlas` repository, `service/src/`
  (`knowledge.ts`, `proposals.ts`, `resolve.ts`, `store.ts`) and
  `docs/atlas.md` in `augur`. Name what each variant changes from it.
- `../../concepts/README.md`, especially `pencil-and-ink`,
  `the-question-is-the-record`, `five-reasons-an-answer-moves`,
  `raw-and-kept`, `copies-know-their-source`.

## Principles (the spec)
- Many deployments: no names, floors or limits in the schema.
- Explain, never hide: a row that is hidden from someone is counted as
  hidden ("some"), never silently missing; a gap has a reason.
- Pencil and ink: a model's guess is never counted as a fact.
- Floors: every fact belongs to a floor (You, Team, Department, Org) and
  is read under that floor's access.
- Prefer established standards (a known model or vocabulary) to our own.

## Critique (`notes.md` per surface)
For each variant: **Vn: name**; *Idea*; *Sources*; *Check result*
(questions passed of total, with the failing ones named); *What works*;
*What fails or risks* (query cost, change cost, what it cannot say, leaks
across floors, how a person would ever correct it); *Change from today*;
*Score* 1-5 for Honesty (can it say what it doesn't know), Simplicity,
Change cost from today, Fit with the concepts. End with a ranked list.
