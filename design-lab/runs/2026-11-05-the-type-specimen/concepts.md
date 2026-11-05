# Concepts found by this run

Each is bigger than one schema and could steer a future run, on any track.
They are also filed in `design-lab/concepts/` with `track: data`.

## The type fixes which, not what (`the-type-fixes-which`)
Every entity hangs on one record, set once. The record says which thing,
never what is true of it, so it can be wrong in what it says and still be
the anchor. A split brings back each part that holds its own type.

Evidence: identity V2, merge V2 and V4, combined; ICN's type method. Could
steer: Artifacts (a document's identity through renames), Mandate (an
intent split in two), Explorer.

## Found the same, or became one (`found-the-same-or-became-one`)
A discovery merge moves only recorded time; a real-world merger is an event
with a valid date. Store them differently, and keep merges for the first.

Evidence: grammar, merge V2, across time T3, combined probes. Could steer:
Explorer and Admin (reorganised teams and floors), the minute.

## A rerun has three numbers, not two (`three-numbers-not-two`)
As asked, as it stood then knowing what we know now, and now. Each step is
one reason, worked out by which clock moved.

Evidence: across time T3 and T4, Q2 in every variant (7, 9, 8), combined.
Could steer: the briefing, Upgrade Centre release notes, the switchboard.

## Sort what was said while merged (`sort-what-was-said-while-merged`)
Every fact and link made against a merged entity is sorted to one part, one
row each, and the fact stays one row. Other apps' links are sorted too.

Evidence: merge V2 and V4, identity V4's failure, combined probes. Could
steer: Mandate bindings, Artifacts tags, a sorting queue in Triage.

## A shared key is a question (`a-shared-key-is-a-question`)
A second record with a known key raises a Triage item; it never merges on
the key alone.

Evidence: identity V3's failure, identity V1's January refusal, combined
`p0`. Could steer: Data Atlas matching, Explorer (people with two accounts).

## Name the wrong record (`name-the-wrong-record`)
When a conclusion is withdrawn, the record that misled it is marked
discredited, with why, and stays.

Evidence: merge V4, combined; the Genealogical Proof Standard. Could steer:
Artifacts (withdrawn sources), Mandate, the analyst's bench.

Also advanced: pencil and ink (a guess is never an entity or a link), the
question is the record (runs keep counts, clocks and floors, never rows),
five reasons an answer moves (worked out by clock), copies know their
source (quotes), raw and kept (records are raw).

## On the method (first data run)
What worked:
- The check is a real floor. It caught two failures that reading the
  schemas would have missed: identity V4 counted a guess (8, not 7), and
  valid time alone (T2) can't replay the 7 at all.
- Writing the answer key from the case before any query, and using one
  answer format across every variant, made the scores comparable.
- Migration checks were the most telling result: every one lost Q6.

What didn't:
- **The check rewards answering, not risk.** Identity V3 scored 5/6, the
  same as V2, though its merge was made by nobody. The critique caught it;
  the score didn't.
- **Queries can be tuned to the seed.** They name case ids (`e-hll`, `r1`).
  The four probes in the combined notes were done by hand. The brief should
  ask for a `probes.sql` (a change to the seed plus the expected answer),
  or a second seed the queries haven't seen.
- **`--apply-migrate` can't test a migration "from the variant before".**
  It applies `migrate.sql` on top of the variant's own schema, which fails.
  This run added `check-migration.py <from> <to>`. `check.py` should take a
  `--from <folder>` option instead.
- **No fresh reader.** The tracks README says a fresh agent usually takes
  the check; here the same author wrote the key and the queries, and the
  "expect before query" rule was self-policed. For data the script is a
  fair check, but the answer key should be written by a separate agent from
  the case alone.
- **Exact string matching is fragile.** A right answer in another column
  order fails. Fixing the format in the run's README before writing queries
  worked; the brief should say so.
- **Four variants per surface was enough;** the across-time surface had one
  near-duplicate (T3 is merge V2 renamed), which the critique says.
