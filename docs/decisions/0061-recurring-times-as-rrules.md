# 0061. Recurring times are RFC 5545 recurrence rules, read with rrule and swept by a scheduled job

- **Status:** Proposed
- **Date:** 2026-11-05
- **Decided by:** Harry (overnight approval of the alpha's records, 5 Nov; alpha plan §5.3)
- **Replaces:** none

## Context

Apps need things to happen on a rhythm: Mandate asks a holder how an intent is going every so often, and reminds
people of a back-brief that is due; Artifacts' series and later digests do the same. Today each keeps a number of
days and works out "due" in its own code, and nothing reminds anyone until they open the app. People will ask for
rhythms a day count can't say: "every Monday", "the first working day of the month". The service kit already runs
scheduled jobs on DBOS (ADR 0014), once per tick across every instance.

## Options

1. **A day count per thing, checked when read.** What Mandate does now. Can't say "every Monday", and reminds nobody.
2. **RFC 5545 recurrence rules (`RRULE`), read with the `rrule` package, and a scheduled job that sweeps.** The
   standard calendars use, so a rhythm can be shown, edited and exported the way people know; the package is the
   maintained JavaScript implementation (BSD-3, no dependencies beyond `tslib`).
3. **One DBOS workflow per thing, sleeping until it is due.** Durable, but thousands of sleeping workflows, and every
   change to a rhythm has to find and cancel one.

## Decision

Option 2.

- A recurring time is stored as an RFC 5545 `RRULE` string (no `DTSTART` in it: the thing's own start, such as when
  it was last assessed, is the start). Apps read it with **`rrule`**, and never parse one by hand.
- What a rule makes due is found by a **scheduled job** (`jobs.schedule`, every 15 minutes by default) that sweeps
  the app's own tables. Each reminder is sent once: the row records what it was last sent for
  (`update ... where reminded_for is distinct from $due returning`), so two instances or a rerun send nothing twice.
- A rule people choose is checked when it is saved: it must parse and repeat at most daily (`FREQ` of `DAILY`,
  `WEEKLY`, `MONTHLY` or `YEARLY`), so a sweep never owes more than one reminder per thing.
- Times are worked out in the organisation's time zone (ADR 0042) when it has one, else UTC.

## Consequences

- New dependency `rrule` in the apps that use it, starting with Mandate (PER-239). Mandate's `rhythmDays` stays as
  the default rule (`FREQ=DAILY;INTERVAL=<days>`) so nothing already stored changes meaning.
- Reminders go out while nobody has the app open. They go to the Inbox when there is work to do (ADR 0026) and to
  notifications otherwise.
- A rule can be exported to a calendar later without translating it.
- Watch: `rrule` is maintained but slow-moving. If it stops being maintained, the rules stay standard and another
  reader can take its place.

## Links

- Linear: PER-239 (Mandate beta: reminders), alpha plan §5.3.
- ADR 0014 (DBOS jobs), ADR 0026 (Inbox), ADR 0042 (organisation settings).
