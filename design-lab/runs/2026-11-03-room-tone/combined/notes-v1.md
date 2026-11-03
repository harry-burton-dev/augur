# Combined V1: A full day in two minutes (`v1-full-day-in-two-minutes.html`)

Sources: `_src1/` (engine.js, v1.data.js, v1.js, v1.html; `node _src1/build.js`).
`#at=HH:MM` in the address jumps there (everything earlier runs silently), then plays.

## V1: A full day in two minutes

*Idea.* A scripted working day, 09:00 to 17:30, squeezed into 120 s at 1×
(2× and 4× too). It has 76 events at their real frequency: other people's
activity, your own jobs and actions, approvals, floor travel, radial menu use,
a sync that fails, a source that goes silent and comes back, one urgent notice
with its hush, escalation, acknowledgement and answer, two on-demand listens,
two writing spells and lunch. One function, `decide()`, runs every event
through the combined rules. The page keeps four records: a **timeline** (lanes
by level; filled = sounded, faint fill = sounded but you didn't hear it,
dashed = held, hollow = silent by rule), the **caption strip**, a **budget**
(sounds against `--sound-budget-day`, beside "a ding per event"), and a
**silence ledger** (every event that stayed silent, with its reason and a count
per reason). While the urgent notice is unacknowledged the day clock stops, so
the escalation plays in real time. A scripted acknowledgement comes after 3
repeats; press A to acknowledge sooner.

*What it combines.*
- **Grammar V1 (register-led), the base.** Levels L0 to L3; floor = register
  (220 / 294 / 392 / 523 Hz, a fourth apart); family = contour; urgency = how
  many notes. One glass voice for alerts.
- **Ambient V4, who is waiting.** No beds. Done sounds only for work you
  started, within `--sound-wait-window` (15 min). Needs-you items wait while
  you type and play at your next pause. While you are away nothing plays;
  what still needs you plays once when you are back. The silence ledger is V4's.
- **Ambient V5, open plan test.** The Desk / Open plan / Shared screen modes.
  Open plan is 6 dB down, and done and touch go silent. Shared screen plays
  nothing; the captions carry it all.
- **Pointer V6, quiet hand.** Plain menu choices are silent. A locked choice
  gives a closed door. The Delete edge note retires after `--sound-learn-after`
  (here it does, at 15:40, and the ledger says "learnt"). The hold climbs.
- **Floors V6, sonar echo.** Travel is silent. You get one dull here-echo only
  if something waits on that floor, two if it is overdue. Echoes from other
  floors are off.
- **Telemetry V2, rumble strip.** L plays two marks in the owner's register,
  with ticks on the house note only near or over a limit (16:00: two watch
  ticks). **Telemetry V5, turn-taking:** words go to the live region
  `--sound-turn-gap` after the earcon ends.
- **Urgent (from the round 1 levels).** The cinematic run's Letterbox with its
  lamp. The hush (`--sound-silence-before`) holds the queue. Acknowledge cuts
  everything within one attack. The answer (12 → 7 → 0) closes the question.
  Room tone is gone (edges, not beds), so the Murch drop becomes a hush in
  which nothing is allowed to start.

*The pitch rule (one, throughout).* **The register says where, the house
note says limit.** Every family pitches from its floor. A limit is always G5
(784 Hz), on every series, as telemetry/notes.md recommends. The owner
register appears only in the start and end marks. I picked the house note
over the floor register for limits because a limit has to sound the same
whoever owns the series. Rendering the scores found a collision: Department × 2
= 784 Hz, so floors V6's octave-up echo **landed on the house note**.
`--sound-echo-ratio` is now 1. Department escalation would hit it too
(only Org-floor platform notices escalate today). The tokens need a lint: no
family may land within a semitone of `--sound-pitch-limit`.

*What the day measured (desk mode, full run).*
- **33 sounds out of 76 events** (a ding per event: 76). Budget 40.
- Alerts 17 (4 of them the urgent sequence), Touch 9, Floors 5, Data 2.
- **Longest quiet: 1 h 20 m** (14:10 to 15:30, while writing; the disputed fact waited for the pause).
- 51 ledger rows. Info and other people's work make up half of
  those. The rest are your own actions, running work and finishes that are
  not yours, plus a few held or retired.
- **14 of the 33 sounds come from your own hands** (touch 9 + floors 5), not
  from the world. So the after-lunch lever is the Feel and Floors settings,
  not the alerts.
- The morning is busy: the "on this pace" estimate passes 40 around 11:20,
  then falls to about 33. A daily budget hides a busy hour. A real check
  should also cap sounds per hour.

*What works.* You judge with your ears and can see why at the same time.
Each sound you hear has a dot on the timeline and a row in the strip, and each
silence has a row in the ledger, so sound never seems random. "A ding per
event" beside the count makes the case for an ADR in one number. Shared screen
shows the honest answer for meetings: the page still reads completely with
nothing audible. The held-while-typing links (dashed lines from 09:36 and
09:52 to the 10:05 pause) show batching without any explanation. Clock and
sound are kept apart: speed changes the day, never the sounds. Earcons queue
with `--sound-gap-compound` and never overlap, even at 4×.

*What fails or risks.*
- At 1× the day is still compressed about 255 times. Two minutes of 33 sounds
  is about one every 4 s, far denser than a real day, where it is one every
  15 min. That makes it a stress test, and harsher than reality. Harry should
  also try 1× while doing other work, not only watch it.
- The urgent repeat count is scripted (3), so the doubling after
  `--sound-repeat-stage` is never heard here.
- "Typing", "away" and "waiting for" are presence guesses the shell does not
  have yet.
- 76 events is one person's quiet Monday. A triage-heavy Data Atlas user
  would get many more needs-you sounds, and those need the per-hour cap above.
- Mono IBM Plex numerals throughout (still needs its ADR).

*Principles.* Calm: strongest. At rest nothing moves, and the playhead stops
when paused. Explain, never hide: the ledger applies it to silence, and every
locked or held thing says why. Letterbox: the urgent frame uses
`--letterbox-ratio` and `--scrim` bars, and stays after acknowledge until it
is answered (acting is not resolving). Focus stacking: not used.

*Needs (tokens).* `--sound-pitch-min/-max`,
`--sound-floor-{you,team,department,org}`, `--sound-pitch-limit` (784 Hz),
`--sound-note-min/-base/-last/-attack`, `--sound-rate-max`,
`--sound-gap-compound`, `--sound-repeat`, `--sound-repeat-stage`,
`--sound-silence-before`, `--sound-turn-gap` (= `--motion-slow`),
`--sound-gain-ceiling/-band/-accent/-body/-quiet`, `--sound-gain-open-plan`
(−6 dB), `--sound-timbre-glass/-pure`, `--sound-door-lp`,
`--sound-echo-ratio` (1), `--sound-echo-lp`, `--sound-hold-steps`,
`--sound-learn-after`, `--sound-wait-window`, `--sound-count-max`,
`--sound-budget-day` (40), plus `--x-type-micro`. *Data the shell lacks:*
`startedBy` and notice level on every event, presence (typing, away), "waiting
for" state, source → document dependencies (for "a source went silent"),
per-person learnt state.

*After lunch.* **On, at Desk with Quiet hand. In open plan, on with the Open
plan mode.** The densest stretch is 09:00 to 10:10: seven sounds in a real
hour, mostly my own travel and a held batch. That is the hour I'd test first
with real ears.

*Screen reader clash.* Low to medium. Turn-taking orders the words after each
earcon. The risk left is focus speech starting under a Delete hold (1.2 s).
That hold is the longest sound in the day except the urgent figure.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 (the rules are one
pure function; presence data is the cost) · Fit 5
