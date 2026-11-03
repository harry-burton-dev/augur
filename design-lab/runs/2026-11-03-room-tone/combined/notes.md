# Round 2: combined screens

## Combined V1: A full day in two minutes (`v1-full-day-in-two-minutes.html`)

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

---

## Round 2 · V2: Urgent path heard (`v2-urgent-path-heard.html`)

Built by `_src2/build-v2.py` from the round 1 urgent screen (`urgent/v1-caution-chime.html`,
which carries cinematic combined V3 and the shared sound dock) plus `_src2/v2-*.{css,js}`.
Run the probes with `KIT=../../../_kit node _src2/probe-v2.js file://$PWD/v2-urgent-path-heard.html`
(add `cap` to let the question ring to its end).

### What it combines
- **Grammar V1 (register-led), the base grammar.** Its levels decide what sounds: the notice
  (watch line) is **L0 and silent**, words only. Needs you is **L2: arrival** (root, then a fourth)
  once. Urgent is **L3: stop, a hush, then escalation**. Every pitch sits on the Org register
  (`--sound-floor-org`, 523 Hz), because the notice comes from the Org.
- **Urgent V2, the drop-out only.** No room tone bed. At urgent, **everything AUGUR is playing stops
  at once** (`--sound-cut`), then there is **a beat of silence** (`--sound-silence-before` =
  `--motion-calm`). The rules thin out and the needs bloom stops for that beat. In the demo you are
  listening to the chart (L) when urgent arrives, so you hear it cut mid-phrase.
- **Urgent V1, the lit lamp.** The Acknowledge button becomes the lamp: lit while the question
  is asked, steady once sound has stopped, dark once held. The light that calls you is the control
  that silences it (the-signal-is-the-control). Under the label, an **ask ladder** draws the
  repeat rule: six dots on a time axis, then a square for the person who gets paged.
- **Urgent V6, the cadence.** Urgent is a **question** (a sus4 arpeggio). Acknowledging **stops it
  without answering it**. Acting plays the **dominant** once ("moving"). Only the system's
  resolution plays the **answer** (the fourth falls to the third). The cadence line in the bottom
  bar shows Question › Held › Moving › Answered (question-and-answer: acknowledge ≠ act ≠ resolve).
- Kept from urgent V5: **L, listen to this chart**. It is on demand only, and it is what the
  subtraction cuts.

## The repeat decision (against combined V3's "urgency is carried by space, never by loops")
**Urgent repeats until it is acknowledged, but it is capped and it slows down.** It asks three
times at `--sound-ask-every` (= `--motion-still`, 3 s). After that **each gap doubles**
(`--sound-ask-grow` 2): 6 s, 12 s, 24 s. After **six asks in 48 s** (`--sound-ask-max`) the sound
stops for good. The lamp stays lit but steady, and **the escalation moves to a person**: the
person on call is paged again, and the caption and live region say so.

Why:
- **Why repeat at all.** One chord is easy to miss: headphones off, a colleague talking, a
  different tab. Avionics repeat until acknowledged for this reason, and Brewster says attention
  should come from rhythm, not volume. A single ask fails the one person who most needed it.
- **Why it is not a loop.** A loop is periodic and open-ended, and the cinematic rule is right to
  ban that. This is a finite sentence of six asks, each further apart than the last. It gets *less*
  insistent with time and never louder or faster. Nothing about it is steady state.
- **Why it slows.** The first three asks (9 s) cover "you're here but didn't notice". The doubling
  gaps cover "you stepped away for a minute". Doubling is the same shape as exponential back-off
  in networking, which people already accept for retries.
- **Why it stops at 48 s.** By then either you are not there (more sound reaches no one) or you
  are there and thinking (more sound harms you). Either way, the next useful step is another
  person, not another chord. AUGUR already has that step (on call, paged).
- **Reduced sound** asks once. Stepping back (Esc) does **not** silence it, and the caption says
  so. Acting silences it, because acting implies you have seen it.

This needs Harry's decision: it pushes back on "never by loops" for L3 only, and asks that
`--sound-ask-max` be a deployment setting. An incident room may want more asks, a shared office
fewer.

### What works
- **You can hear all three verbs.** After you acknowledge, the ear is left on an unresolved chord,
  and the answer minutes later feels like closure. Of all the round 1 ideas, this one makes
  "acknowledged is not resolved" obvious without a word.
- **The lamp is a better control than a separate button.** It turns the repeat into something you
  can see counting (ask 2 of 6, the dots filling), so the sound never runs on with nothing to show
  for it.
- **The silence costs no time.** It is exactly the frame's settle time (`--motion-calm`). The bars
  close in silence and the question lands as they land. Unlike urgent V2, nothing is delayed.
- **Dark when normal holds.** The notice is silent, needs you sounds once, and only L3 repeats. On
  a normal day this page makes no sound at all.

### What fails or risks
- **Subtraction is mostly a rule, not a cue.** Under dark-when-normal there is rarely anything
  playing to take away. In practice the "stop" is an inaudible 0.6 s gap. It earns its place as
  turn-taking (see the screen reader section) and as the rule that nothing overlaps urgent, not as
  a moment people notice. Only on-demand sound (L, telemetry, W) ever gets cut.
- The sus4 "pull" relies on Western tonal habit. For people who don't hear it, the cadence line
  and lamp carry the meaning.
- The Org register (523 to 1177 Hz across the question) sits in the speech formant band.
- "Paged again" needs on-call data the shell doesn't have yet (the sample has it in `DATA.urgent`).
- Six asks in 48 s is still six chords in a shared office. In a meeting it needs the meeting preset
  (urgent once, everything else zero) proposed in round 1.

## "After lunch" verdict
Keep it on. Urgent is rare, the notice never sounds, and needs you plays once. The only repeat
ends on its own in under a minute.

### Screen reader clash risk
**Low to medium, and better than round 1.** The beat of silence is where the alertdialog's
announcement goes, so the first ask comes *after* the headline is read. In AUGUR, the first ask
should wait for the screen reader to finish speaking, or for a cap of `--sound-silence-before` × 3.
Later asks still land mid-reading. Duck them under speech, or with a screen reader on, set
`--sound-ask-max` to 2. The caption strip is not a live region, so it never talks over speech.

### Principles
Letterbox: kept, and now it is also a sound moment (silence while the bars close, the question as
they land). Focus stacking: kept. Explain, never hide: the lamp says why it is lit, how many asks
remain and what happens after them, and every silent event is written in the strip ("never
sounds", "silence", "sound stopped"). Calm: the repeat is the one exception, and it is bounded
and slowing.

### Needs
Tokens: `--sound-floor-*` (grammar V1), `--sound-timbre-glass`, `--sound-chord-needs|question|moving|answer`,
`--sound-cut`, `--sound-silence-before` (= `--motion-calm`), `--sound-ask-every` (= `--motion-still`),
`--sound-ask-stage` (3), `--sound-ask-grow` (2), `--sound-ask-max` (6, per deployment),
`--sound-listen-lo|hi|points` (262 Hz, 1047 Hz, 18), plus the shared `--sound-gain-*`, `--sound-note-*`,
`--sound-rate-max` and `--sound-gap-compound`. A **lamp** state for the kit `Button`. A **reduced
sound** setting. Data: the notice's floor (exists), a cadence state on the notice record (question,
held, moving, answered, which maps to the existing ack, act and resolve), and the on-call rota for the
hand-off. Also relies on `--font-mono` (needs an ADR) and the combined V3 proposed tokens.

### Scores
Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

### Where it goes beyond the ask
The repeat rule hands over to a person instead of to more sound. L (listen to the chart) is the
thing the subtraction cuts. The caption strip writes out the silences too.

---

## Round 2 · V3: Travel and reach (`v3-travel-and-reach.html`)

Built by `_src2/build-v3.py` from the round 1 floors shell (`floors/_src/base.html` and
`sound-common.js`, carrying cinematic combined V4 floor travel and the shared sound column) plus
`_src2/v3-*.{css,js}`. Probes: `_src2/probe-v3.js` (demo with sound on) and `_src2/probe-keys.js v3`
(keyboard paths).

### What it combines
- **Floors V6, sonar echo, cut down.** Browsing the picker and travelling are **silent**. On
  arrival, **one echo at the floor's register, and only if something waits there** (overdue answers
  twice). If nothing waits, nothing sounds, and the strip says "silence is the sign". The outgoing
  ping and the echoes from other floors are gone from arrival. Other floors' echoes are on
  demand only (**E**), here first and then later and duller with distance.
- **Floors V5, W "where am I".** One pure note per level from You up to where you are (pitch is
  altitude), the last one lengthened, then the echo if something waits. It is also spoken in words
  ("You are on Platform, a Team, level 2 of 4. 2 things need you here.") and drawn in a pill under
  the floor mark, while the gauge flashes each level.
- **Floors V3, audience as thickness.** A chord's number of voices says how many people will see
  it: 1 voice for only you, 2 for up to 10, 3 for up to 100, 4 for more (root, fifth, octave,
  tenth). The voices share one envelope, so the chord gets thicker without getting louder.
- **Pointer V4 and V5, the self-timer ladder and the heard consequence.** In the new **Publish**
  sheet (P, or the button next to the floor mark), holding Enter climbs **six rungs from the
  target floor's register**, each rung as thick as that floor's audience. The **landing** is an
  octave up. **Let go and it stops dead, in silence** ("Released at step 3 of 6. Nothing
  published."). The six-segment ring is drawn with one concentric arc per voice, so the eye gets
  the same thickness. A locked target plays the **closed door** (pointer V6) and never climbs.
- Registers are grammar V1's: You 220, Team 294, Department 392, Org 523 Hz.

Demo: on Platform, Publish "Runbook v4". You try Northwind (4 voices, high) and let go at step 3,
then hold Engineering (3 voices) to the landing. That answers Tom's waiting approval, so Platform's
count drops. Then you close the sheet and press W, travel up to Research Guild (nothing waits:
silence), press E, travel on to Engineering (one echo) and press W again.

### What works
- **You hear the reach before you let go.** The first rung sounds the moment you press, so within
  200 ms the ear has the target's altitude and the size of its audience. Publishing to 412 people
  is high and thick, and to 8 people low and thin. The decision is still open: letting go costs
  nothing and makes no sound.
- **Thickness is learnable at once.** Unlike pitch, people hear "fuller" without training, and the
  bars in each row and the arcs in the ring say the same thing. It is a privacy cue that
  arrives at the right moment: during the commit, not on every visit.
- **Travel is nearly silent all day.** The only sound on arrival is a fact: "something waits here".
  Where you are is asked for (W), never announced.
- **W is the best screen reader aid in the run.** It is on demand, in words as well as sound, and
  counts levels up from You.

### What fails or risks
- **The You register (220 Hz) is weak on laptop speakers.** Echoes on your own floor are the
  quietest, yet they matter. It needs the "octave up" setting proposed in grammar V1.
- **The buckets are coarse.** 63 and 99 people sound the same. That's fine as a cue, because the
  row also states the count, but it is not a measurement.
- **Six rungs in `--motion-run`** is 5 notes a second, close to Brewster's ceiling. A longer hold
  would be calmer but slower to publish.
- **A 4-voice chord with a tenth on the Org landing reaches 2.6 kHz.** It is within limits, but it is
  the brightest sound in the set.
- **New UI.** The Publish sheet is not in the kit. It borrows the decision card pattern, and needs
  audience counts at share time (the shell has floor membership, not always the effective
  audience after permissions).
- E with four answering floors is a 1.2 s phrase. That's fine on demand, and wrong if it ever
  became automatic.

## "After lunch" verdict
Keep it on. Browsing and travel never sound. Arrival echoes come only where something waits,
perhaps 10 to 20 a day. The reach ladder plays only when you publish or share, a few times a day,
and you control its length.

### Screen reader clash risk
**Low.** Holding is a moment without speech. Announce "Published" after the landing, not over it
(as here). W is built for screen reader users. The arrival echo can collide with the arrival
announcement, so in AUGUR, play it after speech, or skip it when the announcement already says
"N things need you here". E is medium risk, because it is a phrase, but it only plays on demand.

### Principles
Explain, never hide: every sound has a sign (the echo blip on the gauge, the W pill, the ring, the
thickness bars, the strip), and the locked target says why and who can change it. Calm: silence
is the default and the strongest sign ("nothing waits"). Letterbox: unchanged (an overdue arrival
opens it, as in combined V4). Focus stacking: the sheet racks the plane out of focus.

### Needs
Tokens: `--sound-floor-*`, `--sound-timbre-glass|pure`, `--sound-note-base|last`, `--sound-echo-double|first|per-floor|lp-near|lp-far|max`,
`--sound-where-gap`, `--sound-ladder-steps` (6), `--sound-ladder-hold` (= `--motion-run`),
`--sound-ladder-semis`, `--sound-ladder-land` (12), `--sound-reach-buckets` (1, 10, 100),
`--sound-reach-voices` (1, 1.5, 2, 2.5), `--sound-door`, and the shared gain, limit and rate tokens.
Visual: `--radial-hold-segments` (6), as proposed by pointer V4. Setting: **reduced sound**. Here it
makes figures shorter (the first rung and the landing only, and W plays only where you are)
rather than dropping kinds. Data: the audience count per target at share time, and a cross-floor
waiting query (combined V4 needs it too). Keys: W, E and P in the shell's shortcut map.

### Scores
Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

### Where it goes beyond the ask
Publishing answers the approval that asked for it (the waiting count drops). There is a "two steps
instead" path for anyone who can't hold, and its first press still plays the first rung, so the
reach is heard either way. Reduced sound shortens figures instead of removing them.

---

## Combined V4: Sound settings (`v4-sound-settings.html`)

Sources: `_src1/` (engine.js shared with V1, v4.data.js, v4.js, v4.html).

## V4: Account › Sound

*Idea.* The Sound section of the shell's Account area. It is the one place
where a person decides what AUGUR may say out loud. It opens with **one switch,
Off** (the org default), and "Click to enable sound". Below that are six kinds
of sound (Urgent, Needs you, Done, Floors, Touch, Data). Each row has its own
volume, an **Audition** button (keys 1 to 6), a score of exactly what it
plays, its visible sign, and a line on when it fires. Then come Reduced sound,
**Feel** (None / Quiet hand / Detents, with sounds per day), **Where you are**
(Desk / Open plan / Shared screen, Shift M), **Show captions on screen**, and
**Screen reader** (Sound, then words / Words only / My screen reader plays
charts), with lanes that show AUGUR stepping aside. A right rail holds "Hear
it" (caption strip and score of the last audition), the org's defaults beside
yours, who can change them, and yesterday's numbers, which link to V1.

*What it combines.* Grammar V1's six families and floor register (the scores
are the same `seq()` output V1 plays). Ambient V4: Done only for your own work
within 15 minutes, needs-you held while you type. Ambient V5: the three rooms
and their rules. Pointer V6: Quiet hand as the default Feel, the Delete edge
"learnt, silent now" with "Hear it again", Detents at about 660 a day. Pointer
V3: feel as a setting. Floors V6: echoes from other floors as a sub-switch,
default off, with the reason. Telemetry V5: the turn-taking choices and their
honest limits. Telemetry V2: the Data row's house note, drawn red on its score.

*Explain, never hide, control by control.*
- Every control has an org tag: "Northwind default", or in blue "changed from
  Northwind's Desk". The rail table shows the org value beside yours.
- **One lock, shown properly.** Urgent volume can't go below 50% while sound is
  on. The row says why (Northwind security), who set it (Ana Ruiz), who can
  change it and where (Ana Ruiz or Tomas Berg, Admin › Sound), and what you
  can still do (turn all sound off; the Letterbox always shows). The slider
  stops at 50% without hiding it.
- A row that is silent in use stays visible and is dimmed, with the reason
  inline ("silent in use · Reduced sound is on"). It can still be auditioned,
  and the audition says "you won't hear this in use".
- In Shared screen, Audition buttons stay visible but disabled, with the
  reason: "an audition would reach the meeting. Captions only". Captions are
  forced on and the switch says why.
- Things AUGUR can't know are said plainly: where you are, whether you are
  sharing, whether a screen reader is speaking. All three are settings, not
  detection.
- Mute is separate from Off: it silences everything at once for a call and
  keeps the settings.

*What works.* Turning sound on is a decision you can make after hearing it:
auditions play once on click, even while sound is off (the click is the
gesture). The scores make the language visible. Pitch rising towards Org and
the red house note can be read without sound. The page names the whole
vocabulary in six rows, which is the strongest test that the language is small
enough. "About 30 a day" against "about 660 a day" settles the ticks question
for most people without an argument. The defaults table gives the admin model
(org default → personal override → lock with a named reason) a shape for
Admin › Sound to mirror.

*What fails or risks.*
- It is a long page: six rows and four option groups. The volume sliders may
  be unneeded detail. Most people want Off / On / Reduced, and per-category
  volume could go behind "More".
- Volume per category invites people to turn Urgent down, hence the lock, and
  a lock on a personal setting is a policy decision (ADR, PDR).
- "Where you are" relies on people remembering to switch. Shift M helps, but
  someone will forget before a demo. A meeting-aware default would need
  calendar data the shell doesn't have.
- At 1280 the rail table wraps tightly. The score column drops below 1400 px,
  which hides the visual twin there.

*Principles.* Explain, never hide: strongest of the run. Calm: nothing plays
or moves without a click. The page's only automatic motion is the 1.2 s
highlight of the Needs you row. Letterbox: referenced (Urgent's sign), not
shown. Focus stacking: not used.

*Needs.* The same `--sound-*` tokens as V1 (see notes-v1.md), and `--sound-lock-urgent-min`
as an org setting rather than a token. *Data the shell lacks:* per-person
sound settings in identity, org defaults and locks with who set them and why,
learnt state per sound, yesterday's sound count (from the events service), a
radiogroup and switch component in the kit (Aerie), and an Admin › Sound page.

*After lunch.* Not applicable as a page. The settings it makes, Quiet hand,
Desk, echoes off, give the V1 day: on.

*Screen reader clash.* Low. The page does what it describes. Each audition's
words reach the live region after the sound plus `--sound-turn-gap`. The
option cards are real radiogroups with arrow keys. Audition buttons name their
key.

*Score.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 5

---

