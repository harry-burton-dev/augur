# Surface 5 · Team board (a Team floor's work)

**The moment:** the Repairs North team (8 people) has 17 open jobs across 15 homes. The team's own rule, set by Nkechi Bello, is that each person holds at most 4 jobs at a time. Grace Ito is off sick today and holds a leak trace due today. Tom Reyes is off from tomorrow and holds two certificates due while he is away. One damp survey has been held by nobody for 3 days.

**Files:** built from `../_src/board/v*.src.html`. R replays, and each page lists its own keys.

---

## V1: The T-card board
*Idea.* One row per person and one slot per job they may hold (four, by the team's rule). Cards sit in slots, and empty slots are the team's capacity at a glance. The count is "13 empty slots with people in today". Someone who is off has hatched "away" slots. A job held by nobody waits in plain sight with how long it has waited. A side note warns a day ahead about Tom's jobs.

*Sources.* T-card planning boards (cards in slots, a board as the single shared truth); Toyota's kanban.

*What works.* The prompt's "capacity you can see as empty slots" works literally: Kai's row is full, Amara's is half empty, and where the C-10 survey should go is obvious. Hatching Grace's empty slots "away" means her two cards don't look like spare room. Warning a day ahead ("so they can be handed over in person rather than found on Thursday") is the most useful single line on the board.

*What fails or risks.* A per-person limit is a management choice that can turn into a target. The rule must be the team's own, shown with who set it and when (it is). With 20 people the rows scroll, so it may need grouping. A slot count says nothing about the size of a job.

*Principles.* Explain, never hide: strong (nobody's job and away are both said). Calm: yes. Many deployments: the limit is data.

*Needs.* `slots` (team setting), `presence`.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V2: Pull columns
*Idea.* Columns by stage (asked, surveying, booked, on site, checking), each with a fixed number of slots. Moving Rui's survey into Checking fills it, and the column says "Full. Pull from here; don't push into it."

*Sources.* Toyota kanban; work-in-progress limits.

*What works.* It is familiar, and limits per stage show where work piles up: four empty surveying slots and a full checking column say "nobody is checking".

*What fails or risks.* It is the most generic board in the run and looks like every kanban tool. Ownership is a small line on each card, not the structure, so it loses what this run is about.

*Principles.* Calm: yes. Explain, never hide: "full" is said.

*Needs.* Stage limits.

*Scores.* Clarity 4 · Distinctiveness 2 · Feasibility 5 · Fit 3

## V3: The ward whiteboard
*Idea.* One row per home, as one row per bed, ordered by what is due first. People are magnets: who is in, out and off sits along the top, and holders' magnets sit on each row. A row with an off person's magnet is tinted until someone else's magnet is on it. Flags are the team's own words. The moment: Nkechi puts Kai's magnet beside Grace's on B-11 (offered), and Kai takes it.

*Sources.* Ward and A&E status boards (Wears and Perry 2007: densely encoded in local ways, used for coordination within and between groups).

*What works.* Organising by the thing worked on (the home), not by the person, suits teams whose work is about places or cases. The "in today" strip of magnets is a good header for any team view. The flags column takes the team's own words, which is what made ward boards work.

*What fails or risks.* Free-text flags drift and need tidying. A row per home doesn't show load per person (the T-card board does). Magnets are a metaphor too far: chips would do.

*Principles.* Calm: yes. Explain, never hide: the tint explains itself.

*Needs.* Presence; flags as marks with an author.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V4: The levelling box
*Idea.* A pigeonhole per day and kind of work, sized to what the team can do (1 survey a day, 2 repairs, 1 certificate, 2 desk jobs). Pulling C-14's mould wash to Thursday, which already has two repairs, lands it below the rim, outside the box, with "1 more than the team can do Thu 5".

*Sources.* Heijunka (levelling) box at Toyota; post-room sorting frames.

*What works.* "Below the rim" is the best overload picture in the run: nothing is squeezed in or hidden, the extra just sticks out. It answers "can we do this by Thursday?" without a chart.

*What fails or risks.* Per-day capacity per kind is data most teams don't keep, and guessing it makes the box lie. Jobs of very different sizes break it.

*Principles.* Explain, never hide: yes. Calm: yes.

*Needs.* `perDay` capacity per kind (a team setting).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V5: In and out
*Idea.* The office in-and-out board joined to what each person holds. A sliding magnet track (in, out, off) and the jobs they hold sit in the same row. The board's one warning is "held by someone who is away". The moment: Grace's magnet slides to OFF, and her row and the count on the right show the leak trace due today. Only the team lead can hand it on.

*Sources.* In/out boards in offices; ward staffing boards.

*What works.* It is the simplest possible board and it carries the most important rule: away plus holding equals a warning, and nothing else is a warning. "This is the board's only warning" is the calm rule from the cinematic run, applied to a team.

*What fails or risks.* Presence is personal data. "Off sick" should probably read just "off" to the team, with the reason seen only by the lead. The magnet track is decoration; a word would do.

*Principles.* Dark when normal: strongest of the six. Explain, never hide: yes.

*Needs.* Presence with "until"; a lead-only reason.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 5

## V6: The round
*Idea.* Once a day the lead walks the board and turns each card to **on track** or **needs help**, with her initials and a reason for "needs help". A card the round didn't reach says **not checked this round**, never looks fine. A card's mark doesn't change by itself.

*Sources.* Kamishibai boards (Toyota: cards turned at each audit); the ward round.

*What works.* It replaces automatic red/amber/green with a person's mark, dated and initialled. That is honest about who judged it and when, and it can't drift on its own. "Not checked" is *the honest blank* applied to status. "Needs help is an ask with a reason, not a fault" sets the tone.

*What fails or risks.* It depends on the lead doing the round every day. If she doesn't, everything says "not checked", which is honest but noisy. Columns per person get narrow at 1280.

*Principles.* Explain, never hide: yes. Calm: the flip plays once. *Honest blank*: yes.

*Needs.* A `mark` per card per round.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

---

## Ranked
1. **V1 The T-card board**: slots, away hatching, held by nobody, a day-ahead warning.
2. **V5 In and out**: the one warning.
3. **V6 The round**: status as a dated mark, never automatic.
4. V4 The levelling box (when a team keeps daily capacity).
5. V3 The ward whiteboard (for case-shaped teams).
6. V2 Pull columns.

**What I'd build first.** The V1 board with V5's presence column and its single warning, and V6's round marks on each card. Combined V3 shows it, with cover offered in place.
