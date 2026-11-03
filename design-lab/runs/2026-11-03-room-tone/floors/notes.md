# Floors: hearing floor travel

Surface 3 of the room-tone run. Six variants built on the cinematic
`combined/v4-floor-travel` screen: the same FloorMark (gauge, level eyebrow,
waiting diamonds above and below), car-panel picker, sonar-ping travel and
establishing title, which letterboxes only when something urgent waits.

Each page has the same sound column on the right. It opens in a **"Click to
enable sound"** state (or press `S`), says what you would hear, and draws the
variant's mapping as a figure. It has per-kind volume sliders, a reduced-sound
toggle and a **caption log** that writes every sound as it plays. Sounds that
did not play are still written, with the reason: "written, not played · sound
off", "no sound · silence is the sign". So the screenshot state reads without
sound. Every sound also has a drawn sign: a small piano roll (time across,
pitch up on Brewster's 150 Hz to 5 kHz scale) in the caption, on the arrival
card ("Would sound" / "Heard") and on the quiet arrival pill. Each variant also
adds its own sign next to it: rung, waveform, voices, decay curve, lantern or
scope.

**Demo (about 50 s, `R` replays without a reload, so sound stays on).**
1. Travel up to Platform: an overdue item waits there, so the arrival is
   letterboxed (this is the screenshot moment).
2. Browse up through Research Guild and Ops Rota (left) to Engineering, and
   travel there.
3. Try Operations (locked): refused.
4. Travel to Northwind (Org).
5. A variant beat: V5 plays "where am I", V6 pings on request.
6. Travel down four floors to Research Guild. Nothing waits there, so it is
   silent.
7. Step back to Platform: a repeat visit, so the arrival is the quiet pill
   with its sign.

**Keys.** `S` sound on, `M` mute, `F` floors, `↑↓` choose, `Enter` go,
`Alt+PgUp/PgDn` travel (from the cinematic shortlist), `R` replay. V5 adds
`W` (where am I) and V6 adds `P` (ping).

**Build.** All six pages come from one template plus one voice file each:
`_src/base.html`, `_src/sound-common.js`, `_src/vN.js`, put together by
`python3 _src/gen.py v1.js …`. `build.py` skips `_` folders, so only the six
standalone pages publish. The engine enforces Brewster's numbers (notes of at
least 80 ms, at most 6 onsets per second, a 0.1 s gap between compounds, pitch
clamped to 150 Hz to 5 kHz), so no voice can break them by accident. Loudness
is "off, or 50–100% of one ceiling", behind a soft limiter. The
`AudioContext` is only created inside the enable gesture. All six were checked
at 1600×900 and 1280×800, with sound on and reduced motion. There are no
console errors.

---

## V1: Register ladder · `v1-register-ladder.html`

*Idea.* Each level owns a note, rising towards Org (You 262, Team 392,
Department 523, Org 784 Hz). A floor is its level's note plus a step: sibling
n adds 0, 2, 4 or 7 semitones. Arrival plays the parent's note (accented),
then the floor's own note (lengthened), which is a hierarchical earcon in the
literal sense. Passing floors makes a pitched tick each, so a climb rises. If
something waits, an octave-up pulse sounds per item (up to 3), and overdue
lifts and lengthens the last one. A closed floor gives a muffled double knock,
the second knock a semitone flat.

*Sources.* Brewster hierarchical earcons. Lift position indicators. Braun
detents for the ticks.

*What works.* It is the clearest variant. After a day you know "high = Org"
without being taught, and the ladder figure, the levels' Hz tags in the picker
and each row's two-note sign all teach it. It has the fewest new concepts and
maps straight onto `--sound-floor-<level>-base` tokens, like floor colours.

*What fails or risks.* Two siblings a whole tone apart are hard to tell apart
cold. You learn the level, not the floor. Every travel makes a sound (ticks
plus two notes) even when nothing waits, which is a small breach of "dark when
normal". Past about 4 siblings the steps run out (the table needs a rule: wrap
or stop). In a 2-step climb the travel ticks sit close to the arrival notes
and can blur together.

*After lunch.* I'd keep the pulses on and turn travel ticks off by about 2 pm.
The arrival pair is borderline: fine if it is quiet.

*Screen reader clash.* High while browsing the picker: a tick on every arrow
press lands on top of the reader speaking the row. Medium on arrival: the
two notes collide with the "Arrived: Platform…" announcement.

*Principles.* Letterbox: untouched (the sound plays on top of PDR-009's frame
and does not replace it). Focus stacking: none. Explain, never hide: every
sound is captioned and drawn, closed floors say why. Calm: mostly, once travel
ticks are off.

*Needs.* `--sound-floor-*`, `--sound-child-step`, and the shared limit and
gain tokens. Waiting counts per floor (already a gap from the cinematic run).

*Score.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4.

## V2: Timbre families · `v2-timbre-families.html`

*Idea.* Everything sounds in one register (440 Hz). The **level is the
instrument**: You pure sine, Team wood (triangle with a fourth partial,
struck), Department glass (inharmonic bell partials), Org reed (filtered saw).
The **floor is a rhythm**: first sibling long, second short-long, third
short-short-long. Waiting pulses come at an unhurried 360 ms, and overdue
plays the same pulses at double tempo. This is attention through rhythm, never
volume.

*Sources.* Brewster (timbre for families, rhythm for sub-groups, narrow
loudness band). Orchestration.

*What works.* It follows the guidelines most closely. The register never moves,
so loudness and pitch stay in the narrowest band of any variant. Double tempo
for overdue is the cleanest urgency cue in the set. The waveform glyphs make a
good visible sign.

*What fails or risks.* Most people cannot name a timbre, and tiny laptop
speakers flatten wood and glass towards the same thing. Rhythm per sibling
does not scale past 4 siblings and gives order meaning it does not have (who
is "second team"?). Org reed (saw) is the harshest sound in the run.

*After lunch.* Yes for the pulses. The reed would be the first thing I mute.

*Screen reader clash.* Medium. One fixed register sits in the middle of the
speech band.

*Principles.* As V1. It is the calmest of the identity variants.

*Needs.* `--sound-timbre-<level>` (as a partials recipe, which is a new kind of
token), `--sound-rhythm-<n>`, `--sound-pitch-home`.

*Score.* Clarity 3 · Distinctiveness 3 · Feasibility 4 · Fit 4.

## V3: Chord stack · `v3-chord-stack.html`

*Idea.* A floor's sound **contains every floor beneath it**. You is one note.
A Team adds a fifth, a Department an octave, the Org a tenth. Arrival builds
the chord bottom-up, one voice per 170 ms, and holds it. Siblings colour only
the top voice (plain, sus2, sus4). More voices means more people see what you
do here. A "voices" meter next to the floor mark says the same in light
("2 voices · seen by 8"). Waiting plays the top voice, an octave up, per
item. Overdue rocks it a semitone and never resolves.

*Sources.* Hierarchical earcons taken literally (the child includes the
parent). Organ registration. Choir divisi.

*What works.* It is the only variant where the sound carries a real fact the
mark does not shout: **audience size**. That makes it a privacy cue. You would
hear that you have just arrived somewhere 412 people read before you post. The
unresolved semitone for overdue is musically obvious without being loud.

*What fails or risks.* Four simultaneous voices are the loudest thing in the
run. The limiter catches them, but this is the opposite of a narrow band. Sus
colours on the top voice are too subtle to tell siblings apart. Building the
chord takes 0.9 s on every Org arrival.

*After lunch.* The arrival chord gets tiring. As a once-per-session cue, or
only when you are about to share, I'd keep it.

*Screen reader clash.* High on arrival. The held chord sits under the whole
announcement.

*Principles.* Fits explain-never-hide well: the audience is stated in words
too. Calm: no.

*Needs.* `--sound-voice-<level>`, `--sound-child-colour`, `--sound-arp-*`.
It is a candidate for the share or publish flow rather than for travel.

*Score.* Clarity 3 · Distinctiveness 4 · Feasibility 4 · Fit 3.

## V4: Room acoustics · `v4-room-acoustics.html`

*Idea.* There is one sound, a small click, and the **room it rings in is the
level**: You a dry booth (0.16 s), Team a room (0.5 s), Department a hall
(1.1 s), the Org an atrium (2 s). Sibling floors differ by their walls (bright,
plain, soft damping). The reverbs are synthesised impulse responses, with no
files. Waiting is higher clicks in the same room, closer together when
overdue. An optional **room tone** (off by default, its own far lower ceiling,
low-passed per level) **cuts to silence** when you arrive somewhere with
urgent work. The caption writes "Room tone drops to silence", and the room
chip next to the mark turns amber.

*Sources.* Walter Murch: worldizing and room tone. Film's silence before an
event. Architectural acoustics.

*What works.* It is the most atmospheric variant and the most "AUGUR". The
size of the room for the size of the audience is intuitive once heard. The
silence-as-cue idea is the strongest single moment in this surface, and it
belongs in the urgent path too. The decay-curve figure is a good sign.

*What fails or risks.* Reverb length is hard to judge on laptop speakers, in
open-plan offices and at low volume, which is exactly where it would be used.
Long Org tails smear consecutive sounds. A room tone that is "on" breaks dark
when normal, which is why it is off by default. It costs one convolver per
floor (fine for 7 floors; it needs a pool for 70). The prototype also has a
wiring shortcut to fix: the reverb follows mute but not per-kind volume.

*After lunch.* The click: yes. The room tone: no, except as a drop-out alarm
for people who choose it.

*Screen reader clash.* Low to medium. One short click, but the tails linger
under speech.

*Principles.* Letterbox: the drop-out is a sound partner for the 2.39 frame.
Calm: yes while room tone is off.

*Needs.* `--sound-room-<level>` (tail and wet share), `--sound-room-wall`,
`--sound-roomtone-*`. The kit needs an impulse-response generator.

*Score.* Clarity 2 · Distinctiveness 5 · Feasibility 3 · Fit 4.

## V5: Lift gong · `v5-lift-gong.html`

*Idea.* This one pushes back on the brief: **sound says motion, not place**.
A dry detent sounds per floor the car passes. The arrival gong strikes once
going up and twice going down, the real lift convention. A small hall-call
tick sounds per waiting item only when something waits, and overdue ticks
come in pairs. A hall lantern next to the floor mark lights with the gong. No
floor has its own sound, because the screen names it. `W` ("where am I")
counts you up from the ground, one detent per floor, then the gong. Each
picker row shows its count.

*Sources.* Lift arrival signals (EN 81-70, ADA 407: one tone up, two down).
Braun rotary detents.

*What works.* Everyone already knows it, and it is the cheapest variant. `W`
is the most useful thing for a blind user in this run: they can ask, so
nothing has to announce. The hall-call tick is a clean "something waits here".

*What fails or risks.* It fails the brief's first ask, because you cannot hear
which floor you are on. A gong on every arrival is the most "ding"-like sound
here. Counting 7 detents is slow, and directory order within a level is
arbitrary (the same issue the cinematic run raised).

*After lunch.* The gong goes. The hall-call ticks stay, and `W` stays forever.

*Screen reader clash.* Low for the ticks. `W` is designed around a screen
reader: it is on demand and speaks the count in words too.

*Principles.* Explain, never hide: the lantern and count make every sound
visible. Calm: almost, once the gong is off.

*Needs.* `--sound-detent-*`, `--sound-gong-*`, `--sound-call-*`. A keyboard
command for "where am I" in the shell's shortcut map.

*Score.* Clarity 4 · Distinctiveness 2 · Feasibility 5 · Fit 3.

## V6: Sonar echo · `v6-sonar-echo.html`

*Idea.* Browsing and travel are **silent**. Arriving sends one quiet ping, the
falling chirp that pairs with the combined V4 wavefront. The ping comes
**back only from floors where something waits**:
- the floor you arrived on answers first, at once ("something waits here");
  overdue answers twice;
- other floors answer later, one echo each, later and duller (low-passed, not
  quieter) with distance, each pitched at its level's register.

If nothing waits here, the ping goes out and nothing comes back. As each echo
returns, its diamond in the floor mark blooms. `P` pings on demand.

*Sources.* Submarine sonar and bat echolocation. The travel ping of cinematic
combined V4.

*What works.* It answers the brief most directly: **a ping only says
"something waits here" when it does**, and nothing else ever sounds. It also
turns the mark's "waiting above and below" diamonds into something you can
hear, using distance as time, which the ear reads well. Silence after the ping
tells you as much as an echo does. It fits "dark when normal" best and is the
most distinctive variant.

*What fails or risks.* Five echoes after an arrival (Platform → You,
Engineering, Northwind) is a phrase, not a cue, and takes about 1.3 s. That
is why "echoes elsewhere" is its own volume and should default to off. Pitch
by level is learnable but not instant. The outgoing ping sounds on every
arrival (it is your own action, like a footstep). With only the here-echo on,
it would fall silent too, and the ping could go.

*After lunch.* With elsewhere-echoes off: yes, all day. With them on: until
about 11.

*Screen reader clash.* High with elsewhere-echoes on, because they overlap the
arrival announcement. Low with only the here-echo: one note, which can be
timed after speech.

*Principles.* Letterbox: compatible, since the urgent here-echo doubles and
the frame opens. Explain, never hide: the drawn scope, the blooming diamonds
and the captions name who answered. Calm: best in set.

*Needs.* `--sound-ping-*`, `--sound-echo-*` (pitch per level, per-floor delay,
near and far filter). A cross-floor waiting query, which combined V4 already
needs.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit 5.

---

## Proposed sound tokens

Shared by all six (in `SOUND` at the top of each page):

| Token | Value | Note |
|---|---|---|
| `--sound-pitch-min` / `-max` | 150 Hz / 5 kHz | Brewster |
| `--sound-note-min` | 80 ms | |
| `--sound-rate-max` | 6 per second | onset limit |
| `--sound-compound-gap` | 100 ms | between earcons in a row |
| `--sound-gain-ceiling` | 0.14 | the loudest any note gets |
| `--sound-gain-floor` | 0.5 | the quietest an "on" kind gets, as a share of the ceiling: a narrow band by construction |
| `--sound-limit-threshold` / `-ratio` | −20 dB / 12 | soft limiter |
| `--sound-attack` / `--sound-release` | 8 ms / 220 ms | |
| `--sound-reduced-keeps` | waiting, refusal | what reduced sound still plays |

Per variant:
- V1 `--sound-floor-<level>-base`, `--sound-child-step`, `--sound-tick-*`,
  `--sound-motif-*`, `--sound-wait-*`, `--sound-refuse-*`
- V2 `--sound-pitch-home`, `--sound-timbre-<level>`, `--sound-rhythm-<n>`
- V3 `--sound-voice-<level>`, `--sound-child-colour`, `--sound-arp-*`
- V4 `--sound-click-*`, `--sound-room-<level>`, `--sound-room-wall`,
  `--sound-roomtone-*`
- V5 `--sound-detent-*`, `--sound-gong-*`, `--sound-call-*`,
  `--sound-where-ioi`
- V6 `--sound-ping-*`, `--sound-echo-*`

Visual tokens carried from combined V4 (`--x-travel-*`, `--x-dwell-*`,
`--x-focus-far-*`, `--x-hatch`) plus one new one: `--x-sound-col` (the width
of the sound column). Every page relies on `--font-mono` (still needs its
ADR).

## Answers for the shortlist

- **Which floor signals deserve sound at all?** Only "something waits here"
  (all variants agree, and V6 is built on it) and "can't go there". Travel and
  arrival identity are nice-to-have and should default to off.
- **Screen readers.** Helpful: on-demand queries (V5 `W`, V6 `P`) and a single
  short "waits here" note timed after the announcement. Clashing: browse ticks
  (every arrow press) and anything longer than about 300 ms at arrival. The
  shell cannot detect a screen reader, so this needs a user setting
  ("sound around speech: after / off").
- **Open plan and shared screens.** Off by default, per kind, and the
  narrow-band ceiling help. V4's reverb and V3's chords are pointless or rude
  on laptop speakers in a room. A shared screen in a meeting should mute
  "waiting" sounds, because they announce *your* work to the room. That needs
  the shell to know it is being shared, which it doesn't.

## Ranked

1. **V6 Sonar echo**: silent unless something answers; the mark's traffic
   made audible.
2. **V1 Register ladder**: the clearest identity; the tokens to borrow.
3. **V5 Lift gong**: the "where am I" key and the hall-call tick.
4. **V3 Chord stack**: audience as voices, a strong idea in the wrong flow.
5. **V2 Timbre families**: the most correct, the least learnable.
6. **V4 Room acoustics**: the best single moment (room tone drops to silence),
   the worst on real speakers.

## What I'd build first

Build V6 with V1's notes and V5's key. Browsing and travel are silent. On
arrival, the floor answers once only if something waits there, pitched on V1's
register ladder (level note plus step, so the hierarchy is still heard), and
twice if overdue. "Echoes elsewhere" ships off by default as an opt-in for
people who like to hear the building. `W` / `P` become one shell command
("listen: where am I and what waits"), spoken and sounded, for screen-reader
users and for glancing away. Travel ticks, arrival motifs, room tone and
chords stay as options, not defaults.

This goes beyond the ask in two places:
- **The arrival sound is dropped entirely** when nothing waits. The brief
  allows identity on every arrival, but that breaks "dark when normal"
  ten times a day.
- **V3's audience chord should move to the share flow** ("you are about to
  post where 412 people read"), where it carries a decision, not to floor
  travel.
