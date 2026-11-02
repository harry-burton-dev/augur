Ranked by what I'd build first. Each step makes the ones after it cheaper.

| # | Build | Look at | Why it ranks here |
|---|---|---|---|
| 1 | **One time scale and one now line**: the ten time marks as tokens, plus a kit `TimeScale` (Quill) and `TimeRail` (Aerie) that every time display shares | [Time language](grammar/v1-time-language.html), [One scale](grammar/v2-one-scale.html) | Every other idea draws on it. Marks then compare across apps, and the list draws the now line once instead of each row drawing its own. |
| 2 | **Seams: corrections stay visible**. A correction is a different kind of change from an edit, and it carries who, when and why. The same seam is used on documents, facts and deadline moves. | [Reader V3](reader/v3-seams.html), [Reader with history](combined/v2-reader-with-history.html), [Intents V2](intents/v2-staff-gauge.html) | It answers "is this figure a mistake or a rule?". It needs one field (`kind = correction` plus a reason) and one event (`intent.deadline_moved` with a required reason). |
| 3 | **"Why, and since when?" in place**: one shared answer pane every mark feeds, with four lines: what, since when, why, and who can change it | [Fact in place](combined/v3-fact-in-place.html), [Provenance V5](provenance/v5-ask-in-place.html), [Library V1](library/v1-patina-shelf.html) | It extends "explain, never hide" from unavailable things to every value. The radial menu's History direction opens it. |
| 4 | **Back after two weeks**: the view arrives at now, still, with marks on the rows you already know. It never re-sorts, says "When you left" on each changed object, offers replay on request, then folds back to calm | [Back after two weeks](combined/v1-back-after-two-weeks.html), [Scrubber V1](scrubber/v1-since-you-were-here.html) | It is the strongest screen of the run. "You read the old figure" joins your own private read time to a public repair. |
| 5 | **Patina rows**: age, wear and stale-since props on the Quill list row, with the stale hatch saying who can refresh it | [Library V1](library/v1-patina-shelf.html), [Library V5](library/v5-now-line.html) | It is the cheapest idea: three numbers per document, computed on the server, so 5,000 documents cost nothing extra on the client. |
| 6 | **Fact in place**: a strata glyph on every Data Atlas value, with History small multiples and Compare one key away | [Fact in place](combined/v3-fact-in-place.html), [Provenance V2](provenance/v2-history-flow.html), [V3](provenance/v3-parallel-record.html) | It gives triage its own marks (spur for a rejected proposal, bud for one waiting) and splits "silent source" from "no record". |
| 7 | **One now line across apps** ("Ahead"): Mandate intents and Upgrade Centre parts on one axis, with the past under one water plane | [One now line](combined/v4-one-now-line.html), [Intent ledger](intents/v6-intent-ledger.html), [Worn inventory](upgrades/v5-worn-inventory.html) | It compares distance to travel at a glance. It is a candidate for a shell screen that apps feed through their manifests. |
| 8 | **Upgrade Centre history**: the worn inventory as its home list, and "Now and Thursday" as the approval screen, showing changed setting defaults and migrations before the window | [Upgrades V5](upgrades/v5-worn-inventory.html), [V6](upgrades/v6-transpointed.html), [V3](upgrades/v3-tide-almanac.html) | Today a changed default is invisible until it bites. Release manifests would have to declare these changes, which needs an ADR. |

**Worth keeping as options:**
- History Flow as a **History mode**, never the default ([Reader V5](reader/v5-history-flow.html), [Provenance V2](provenance/v2-history-flow.html), [Intents V3](intents/v3-ask-flow.html)).
- The **whole shelf**: one cell per document as the overview for any scope over about 500 ([Library V4](library/v4-whole-shelf.html)).
- **Marey timetable**: a year of releases on one screen ([Upgrades V4](upgrades/v4-marey-timetable.html)).
- **Object lens**: scrub one object while the rest racks back ([Scrubber V5](scrubber/v5-local-time.html)).
- **Then and now** with carry-over links ([Scrubber V3](scrubber/v3-parallel.html), [Intents V4](intents/v4-parallel-asks.html)).

**Not worth pursuing:**
- Big tree-ring discs ([Library V2](library/v2-tree-rings.html), [Intents V5](intents/v5-growth-rings.html), [Upgrades V1](upgrades/v1-tree-rings.html)): memorable, but hard to read. Rings only work as small multiples.
- Borehole and core-sample columns as whole screens ([Upgrades V2](upgrades/v2-borehole-strata.html), [Scrubber V4](scrubber/v4-core-sample.html), [Provenance V4](provenance/v4-ring-section.html)): they only survive as glyphs.
- [Handled sheets](library/v6-handled-sheets.html): skeuomorphic, and it costs space. Its split between personal and shared wear lives on as a privacy rule.

**Where these push back on Harry's principles:**
- "What changed since I was here" should arrive as a still end state with marks, not an automatic replay. Replay is one key away.
- History is drawn in ink and hatch and never glows. Only "needs you" uses light, and that light stays above the past's water plane, or it gets muted.
- Past is quieter in opacity, never in existence. Missed deadlines and repairs don't fade with age.
- Never re-sort a list on return. Changes sit on the rows people already know.
- On a large entity, put the stale hatch on the age text, not on the value, or the page becomes noise. A floor policy can raise it for facts that feed a deadline.
- Rack focus inside a table blurs rows people want to compare. Use it for a whole-screen scrub, not for row focus.

**Decisions for Harry** (none taken):
1. **Read wear privacy.** Proposal: show counts only, never names. Hide a count unless every group in it has at least N people, because "fewer than 5" next to an exact total leaks the number. Should N be set per floor? Your own trace stays exact and visible only to you.
2. **Last visit.** Per-person last-seen times per object, kept for that person only, expiring with the record's retention?
3. **Replay permissions.** Recommended: you see the past through both your access then and your access now (the intersection).
4. **Deadline moves.** A reason is required (recommended). Should the person who asked also have to agree?
5. **"Ahead"**: a Home section or a shell view of its own?
6. **Release-notes read counts** in the Upgrade Centre: show them or not?

**Gaps every surface hit:**
- Mark tokens: the `--x-*` recipes in [the grammar notes](grammar/notes.md) and each surface's notes (wear tick, seam, stale hatch, tide line, water plane). The hatch pattern was already a gap in the cinematic run.
- `--info` now means focus, change and "then" at once. It needs a separate "then" token.
- A kit `TimeScale` / `TimeRail`, a `StrataGlyph` and a `Why` pane.
- Fold back to calm when attention moves, not on a timer. A "readable duration" token separate from motion is still owed from the cinematic run.

**Data AUGUR doesn't record yet:**
- `occurredAt` and `recordedAt` on every event, so late arrivals show as late.
- Field-level before and after values, so a view can be rebuilt at any time without diffing snapshots.
- `kind = correction` with a reason; `intent.deadline_moved` (old date, new date, by, reason).
- A coverage feed from the events service that declares its own gaps and retention limits, so "no record" is honest data.
- Review intervals per library, and who refreshes them.
- Read events per section (privacy rule first) and per-person last seen (private).
- Release manifests that declare changed setting defaults and migrations.
- A per-kind summariser for the "When you left" lines.
