# Grammar: critique

Five pages that sit above the sound surfaces. They name the sounds every
other surface draws on, so the surfaces stop inventing their own. Every page
opens silent with "Click to enable sound". It has a mute, a volume for each
category (Alerts, Touch, Room), a Reduced sound switch, and a caption strip
that writes out every sound with "heard" or the reason it was silent. All
sound is synthesised with Web Audio from one `SOUND` object at the top of the
script. The same values appear as `--x-sound-*` at the top of each `<style>`.
No AudioContext exists until the switch is pressed.

The shared vocabulary (plain names, used by the other surfaces):
**arrival, escalation, acknowledge, resolve, tick, unavailable, ambient, stop.**

## Levels (at most four), mapped to AUGUR notice levels (ADR 0044)

| Level | Notice level | What you hear | Visible sign (light language) |
|---|---|---|---|
| L0 Silent | `info`, history, other people's activity | nothing | words change in the band |
| L1 Notice | `done` (only things you started) | resolve: two falling notes, at the quiet edge of the band, once | dim |
| L2 Needs you | `needs`, `failed` | arrival: two rising notes, once. `failed` turns the contour down | bloom |
| L3 Urgent | the future `urgent` flag (ADR 0044 D3, platform services only) | stop (room tone drops), a hush, then escalation repeating until acknowledged | beacon, then Letterbox |

Not levels: **tick** and **unavailable** (Touch) and **ambient** and **stop**
(Room). Acknowledge belongs to L3: it is the only thing that ends escalation.

## Proposed tokens (needs token)

V1/V2 use these. V3 to V5 change or add the ones listed under each variant.

| Token | Value | Why |
|---|---|---|
| `--sound-pitch-min` / `-max` | 150 Hz / 5000 Hz | Brewster's range. Partials above max are dropped by the engine |
| `--sound-floor-you` / `-team` / `-department` / `-org` | 220 / 294 / 392 / 523 Hz | register rises a fourth per floor towards Org |
| `--sound-note-min` | = `--motion-instant` (80 ms) | Brewster: no note shorter |
| `--sound-note-base` | 120 ms | a normal note |
| `--sound-note-last` | = `--motion-base` (240 ms) | Brewster: lengthen the last note |
| `--sound-note-attack` | 8 ms | onset ramp; also the time acknowledge takes to cut everything |
| `--sound-note-release` | = `--motion-quick` | how long a note stays lit on screen |
| `--sound-rate-max` | 6 /s | Brewster: onsets never closer than 1/6 s |
| `--sound-gap-compound` | 100 ms | Brewster: gap between earcons in a row |
| `--sound-repeat` | = `--motion-still` (3 s) | escalation repeat interval |
| `--sound-repeat-stage` | 3 | after 3 repeats the figure doubles (rhythm, not volume) |
| `--sound-silence-before` | = `--motion-calm` | Murch: the hush before urgent |
| `--sound-duck` | = `--motion-quick` | how fast room tone leaves |
| `--sound-gain-ceiling` | 0.16 (linear) | the loudest peak, set once per deployment |
| `--sound-gain-band` | 6 dB | every peak within this much of the ceiling |
| `--sound-gain-accent` / `-body` / `-quiet` | 0 / −3 / −3 dB | first note accented, later notes, quiet families (resolve, touch) |
| `--sound-gain-room` | −30 dB | room tone, below the band on purpose |
| `--sound-gain-floor-db` | 40 dB | decay depth before a note's tail is cut |
| `--sound-timbre-glass` | 1:1 2:0.22 3:0.08 | the one alert voice (harmonic ratio:level) |
| `--sound-timbre-pure` | 1:1 | acknowledge, unavailable |
| `--sound-tick-ratio` / `-q` | 8× floor / Q 9 | detent tick, always under 5 kHz |
| `--sound-unavailable-lp` | 900 Hz | low-passed "closed door", never a buzz |
| `--sound-room-q` / `-fade` | Q 2 / = `--motion-calm` | room tone width, fade-in |
| `--x-type-micro` | .6875rem | 11px mono numerals (as in the cinematic run) |

Brewster's limits are kept separately as reference values (`LIMITS` in the
script), not as tokens. The bench checks the tokens against them.

---

## V1: Sound language (register-led)
*Idea.* One sheet that names the whole system: four levels, eight sounds,
the floor ladder you can hear, and every token with its reason. Each sound
card has an audition button, a live score on a log pitch axis, its token
recipe, its visible sign and "never means". Register says which floor,
contour and rhythm say which sound, and the number of notes and repeats say
how urgent. One voice, a soft struck glass, plays every alert.

*Sources.* Brewster, Wright and Edwards (all the numbers). Hierarchical
earcons (floors inherit and shift a register). Avionics master caution vs
warning (three audible levels, repeat until acknowledged). Murch (stop
before escalation). The cinematic run's light language (each sound is
paired with bloom, beacon, dim, shadow or thread).

*What works.* Small enough to learn in a day: two notes up means "waiting
for you", two down means "failed", three repeating means "stop". The floor
ladder (a fourth per step) means two floors heard together never clash.
Nothing gets louder, ever. The caption strip and the light-language signs
mean the sound never carries anything the screen doesn't. Every rule is
data, so it maps cleanly onto a kit `sound` module and tokens.

*What fails or risks.* You (220 Hz) and Team (294 Hz) sit in the range of
a speaking voice. Register differences between neighbouring floors are
easy to hear side by side, but hard to name on their own (absolute pitch).
People will hear "higher" before they hear "Department". The ambient bed at
−30 dB may be too quiet to notice leaving on laptop speakers (V5 argues for
−24).

*"After lunch" verdict.* Keep on. On a normal day you hear perhaps two
arrivals and a resolve an hour, all inside one quiet band. Ticks are the
risk: switch Touch off by default.

*Screen reader clash risk.* Medium on You and Team floors (speech
fundamentals are about 100 to 300 Hz). Alerts are short with the accent at
the start, so they slip between words. Offer an "octave up" setting (V3
shows why), and never play arrival while a screen reader is reading the
same notice; the strip already holds the words.

*Principles.* Letterbox: escalation is the Letterbox's sound and opens with
it. Focus stacking: no conflict. Explain, never hide: unavailable is a
"closed door" paired with the shadow and its reason; every silent play
says why in the strip. Calm: silence is the normal state, and info and
history never sound.

*Needs.* The tokens above. A kit module (`sound.ts`) that owns
the AudioContext, buses and the strip. A per-person sound setting in
identity. The notice level from the events service (exists) and the
`urgent` flag (ADR 0044 D3, not built).

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 5

## V2: Test bench
*Idea.* A working bench for the V1 grammar. Audition any sound on any floor,
put two side by side on the same time scale (A, B, A then B), chain up to
three into a compound with the gap token between, and drag tokens to watch
Brewster's checks pass or fail live. The checks are measured from the notes
the engine schedules (pitch range, top partial, shortest note, onset rate,
compound gap, loudness band, accent first, last longest), not asserted.
The auto-demo plays a compound, then drags `--sound-note-base` to 60 ms, and
three cells turn red.

*Sources.* Brewster's numbers as test limits. Apple Audio Graphs (a sound
drawn as a graph you can also hear). Design-token linting practice.

*What works.* It turns "respect Brewster" into a test the kit can run in
CI: the same `checks()` can run over every family × floor in a unit test.
Comparing Team against Org arrival on one scale makes the floor ladder easy
to judge. The bench is also where Harry tunes the gain ceiling per
deployment.

*What fails or risks.* It's a tool, not a product screen; it would live in
Storybook or the design-lab, not in AUGUR. The loudness check measures
synthesis gain, not perceived loudness: a 2 kHz note at the same gain
sounds louder than a 220 Hz note (equal-loudness curves). An honest version
needs a simple A-weighting.

*"After lunch" verdict.* Not applicable. It's a tuning tool, and it plays only when asked.

*Screen reader clash risk.* Low. Nothing plays unprompted, and the checks
table is real HTML.

*Principles.* Explain, never hide: every failing rule names the limit and
the measured value. Calm: no auto-repeat except the escalation preview
(capped at two).

*Needs.* Nothing new beyond V1. A loudness model if the band check is to be
trusted.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V3: Timbre-led
*Idea.* The opposite axis. Pitch carries urgency: three registers (notice
262 Hz, needs 392 Hz, urgent 784 Hz, an octave above needs). The floor is
carried by the voice: a tuning fork for You, a reed for Team, a small bell
for Department, a soft organ for Org. It is laid out as a matrix of floors ×
levels, so you can hear the same level in four voices or one voice at four
levels.

*Sources.* Brewster (timbre is the strongest family cue). Avionics caution
vs warning (urgency as pitch). Instrument families in orchestration.

*What works.* Urgency, the thing that matters most, gets the most salient
cue: you know how bad it is before you know where. Alerts sit at 392 Hz and
above, over most speaking voices. Two floors at once are the same pitch in
two voices, which is less of a chord and more like two people speaking.

*What fails or risks.* Timbre is harder to name than register. "That's the
bell, so Department" takes a week, not a day. Bell partials are inharmonic
and can read as "alarm" to some ears. Four voices make the set feel bigger
and less like one instrument, which is less calm.

*"After lunch" verdict.* Probably keep on. The quiet levels are low and
round, but the reed voice can grate if Team traffic is heavy.

*Screen reader clash risk.* Low to medium. Registers clear most speech
fundamentals, but the needs register (392 Hz) still overlaps higher
voices' formants.

*Principles.* Same as V1. Escalation still gets the stop and the hush.

*Needs.* Removes `--sound-floor-*` and `--sound-timbre-glass`. Adds
`--sound-level-notice` / `-needs` / `-urgent`, `--sound-timbre-you` / `-team`
/ `-department` / `-org` and `--sound-tick-hz` (2400 Hz).

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V4: Spatial-led
*Idea.* V1's sounds plus Brewster's third cue: position. Each sound is
panned to where its sign appears: background work in the top band to the
left, Glance and approvals to the right, toasts right of centre, the
Letterbox and Orbit in the centre. Ticks follow the pointer. A miniature
shell shows it: click anything and a ripple marks where the sound came
from, and a pan meter shows it. A Mono switch proves the set still reads
without pan.

*Sources.* Brewster (spatial position). Cockpit 3D audio (warnings come
from the direction of the threat). Film panning (sound follows the
picture).

*What works.* On headphones it really does turn your head: an approval
arriving on the right sends your eye to Glance. It adds no new sounds, and
pan is capped at 60% so one ear or a laptop still hears everything. The
mono test makes "pan is a bonus, never a channel" checkable.

*What fails or risks.* It's lost on a shared screen in a meeting, on one
earbud, on laptop speakers more than a metre away, and for people with
one-sided hearing loss. It ties sound to layout, so any time Glance moves,
the pan tokens must move with it. Some screen readers pan their own speech,
which would compete.

*"After lunch" verdict.* Keep on with headphones; you won't notice it on
speakers.

*Screen reader clash risk.* Low. It moves alerts away from the centre,
where speech sits. Make pan follow the reader's own pan setting, or switch
it off when a reader is on.

*Principles.* Explain, never hide: unavailable (Delete) plays the closed
door from where the direction sits and shows the reason. Letterbox: urgent
is always centre.

*Needs.* Adds `--sound-pan-width` (0.6), `--sound-pan-band` / `-glance` /
`-toast` / `-centre` / `-follow`. The shell would have to tell the sound
module where a notice's sign is drawn (a zone, not pixels).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V5: Room-led
*Idea.* Murch's room tone as the grammar. While some work of yours runs (a
sync, an import, an upgrade you started), a quiet bed hums at your floor's
pitch, and events are changes to that room rather than notes on top. It
swells and brightens when something arrives, darkens when something fails,
and settles away when the work finishes. It ends abruptly, with no resolve,
when a source goes silent, and it cuts dead before anything urgent, so the
silence is the cue. A timeline draws the room's level over the last 18 s
with every change marked; it redraws only while the room has something to
show.

*Sources.* Walter Murch (room tone, worldizing). Weiser and Brown, and the
Dangling String (periphery). The record-has-edges concept (a sync going
silent is a state worth hearing). Film convention (silence before an
event).

*What works.* "Stop" gets real meaning: an import that dies without
finishing is heard as the room ending without its settle, which no other
variant can say. Arrival on top of a room is gentler than arrival out of
silence. It's the most distinctive and the most cinematic.

*What fails or risks.* It pushes against dark when normal. A hum is a sound
when nothing is wrong. It only holds if the room plays only while your own
work runs. With no work running there is no room to cut, so escalation
loses its hush and falls back to V1. A steady bed under a screen reader is
the worst case for masking. It needs −24 dB, not −30, to be heard leaving.

*"After lunch" verdict.* At risk. A long import means minutes of hum. It
would need a "room only for long jobs" rule and a short maximum (fade the
room after a few minutes and keep only the stop).

*Screen reader clash risk.* High while the room plays. Reduced sound turns
it off; test with NVDA and VoiceOver before anything else.

*Principles.* Calm: conflicts unless the room is tied to your own work.
Explain, never hide: the thread sign in the band moves while the room
plays and goes flat when it stops. Letterbox: the cut is the Letterbox's
first beat.

*Needs.* Changes `--sound-gain-room` to −24 dB. Adds `--sound-bed-lift`,
`-bright`, `-dark`, `-settle` and `-window` (= `--motion-drift`). The
updater and sync services would need to stream "running / ended / went
silent", which is more than the events service sends today.

*Scores.* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 3

---

## Ranked
1. **V1 Sound language (register-led)**: the grammar to adopt. Small, learnable, every number tokenised.
2. **V2 Test bench**: build alongside V1 as the kit's tuning tool and CI check.
3. **V4 Spatial-led**: a headphones-only setting on top of V1, never a channel.
4. **V3 Timbre-led**: keep its one strong idea. If screen reader testing shows V1 clashing, move every register up an octave rather than switch axes.
5. **V5 Room-led**: keep `stop` from it, as "the room ended without a settle". Drop the always-on bed.

## What I'd build first
V1's eight sounds and three audible levels, behind a single off-by-default
setting, as a kit `sound` module owned by the shell (Aerie). Apps never call
Web Audio. They raise a notice at a level, and the shell decides whether it
sounds, exactly as ADR 0044 already says it decides how loud a notice is.
Ship `arrival` (needs, failed) and `resolve` (done, own work only) first,
plus the caption strip as part of the band. Add `escalation`, `acknowledge`
and `stop` when the `urgent` flag exists (D3), together with the Letterbox.
Touch sounds come later and off by default. Before any of it, run V2's
`checks()` over every family × floor in a unit test, and test You and Team
arrivals under NVDA and VoiceOver. That one test decides between V1's
registers and V3's "octave up" fallback. Sound is worth an ADR, but only
for these signals and the token set. Room tone should stay an experiment.

## Where this pushes back
- Room tone (the prompt's Murch reference) conflicts with dark when normal
  unless it plays only while your own work runs. V5 shows the cost.
- Reduced motion and reduced sound are separate settings (as asked).
  Reduced sound here keeps only L2 and L3 and acknowledge, and drops ticks,
  room and resolve.

## Keywords (for finding this run later)
earcon, auditory icon, sonification, aural alert, master caution, master
warning, room tone, worldizing, dark cockpit, calm technology, Dangling
String, register hierarchy, timbre family, stereo pan, mono fallback,
loudness band, gain ceiling, envelope, Web Audio, caption strip, reduced
sound, acknowledge-to-silence, silence as cue, notice levels, screen reader
masking, open plan, shared screen.
