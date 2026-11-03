# Sonified telemetry: critique

Surface 6 of the room-tone run. All six pages take the **sparkline sentence** from
cinematic telemetry V4 (`events 12k an hour ⌇ · 5 approvals waiting ⌇ · sign-in 84 ms ⌇ ·
storage 61% ⌇ · upgrade … · 4 here · security notices 🔒`) and make it something you can
**listen to on demand**. Nothing plays by itself. Each page asks one question of sound:
can you hear a limit being crossed, compare two series, or get a week's summary in two
seconds, without looking?

**What every page shares** (built from `_src/` with `node telemetry/_src/gen.js`; the build skips `_src`):
- **Off until you ask.** No `AudioContext` exists until you click *Click to enable sound* or
  press **S**. I checked this in a headless browser: `A.ctx === null` until the gesture, and no console errors
  before or after it. After that, the page is still **silent until you press L** (or the variant's key)
  on a phrase. The auto-demo at 1.2 s always runs its visuals. It plays sound only if you have
  turned sound on.
- **Every sound has a visible sign.** The instrument card shows a chart with a playhead, ticks, note
  heads or lanes. The **caption strip** above the summary writes each sound as it plays, for example
  `GRAPH · Approvals · limit note, then 24 h in 2 s · 1 → 5 · brightens at 14:00 · sound off · shown only`.
  Every line ends with *playing*, *muted*, *volume 0* or *sound off*. So the screenshot state reads
  fully without sound.
- **Dock:** the switch, mute (**M**, which stops sounds at once), a volume per category, and a
  **Reduced sound** toggle that is separate from reduced motion. Reduced sound makes everything quieter
  (×0.6) and cuts each phrase to three notes or fewer: start, extreme and now. Before you turn sound on,
  the volume sliders still show but are hatched and disabled, and say why ("Volumes unlock when
  sound is on").
- **Explain, never hide.** *upgrade*, *here* and *security notices* have no sound. They show an
  ear-off glyph, and pressing L on them writes the reason in the caption ("Progress, not a trend…",
  "Only Org admins can see security notices, so they have no sound either. Priya Shah (Org
  admin) can give you access.").
- **Words after sound.** When a sound finishes, its text summary goes to the polite live region.
  The live region is never updated while a sound plays (see the screen reader section).
- **The house note.** In V1, V2, V3 and V6 the pitch is *how close to its limit*: 0 is C4
  (262 Hz) and the limit is always G5 (784 Hz). So **the limit sounds the same on every series**.
  V4 deliberately breaks this rule (see V4).
- Brewster's numbers are hard limits in the engine. Every note is clamped to 150 Hz–5 kHz and lasts at
  least 80 ms. There are never more than 6 notes a second (V6 throttles key repeat to this rate, and the
  trace marks a skipped note). Compound parts are 0.1 s apart. Accents are +1.7 dB, and a
  compressor holds the narrow loudness band. Attention comes from rhythm and timbre, never volume.

### Proposed `--sound-*` tokens (all from the `SOUND` objects)
| Token | Value | Use |
|---|---|---|
| `--sound-pitch-min` / `-max` | 150 Hz / 5 kHz | usable range (Brewster) |
| `--sound-pitch-zero` | 262 Hz (C4) | a value of zero |
| `--sound-pitch-limit` | 784 Hz (G5) | **the limit, on every series** |
| `--sound-pitch-watch` | 523 Hz (C5) | watch-zone ticks (V2) |
| `--sound-floor-you / -team / -department / -org` | 196 / 233 / 262 / 311 Hz | home notes; register rises towards Org (V2 marks, V4) |
| `--sound-note-min / -base / -long` | 80 / 120 / 240 ms | shortest, ordinary, last-note-lengthened |
| `--sound-rate-max` | 6 notes/s | ceiling |
| `--sound-gap-compound` | 100 ms | between parts of a compound |
| `--sound-gap-pair` / `-series` / `-handover` | 200 / 300–400 / 300 ms | V3 pairs, between series, glyph→speech (V5) |
| `--sound-attack / -release / -sustain / -smooth` | 8 ms / 60 ms / 0.7 / 20 ms | envelope; smooth = mute and volume changes |
| `--sound-gain-ceiling` / `-body` | 0.22 / 0.82 | master before the limiter; ordinary vs accent (1.0) |
| `--sound-limiter-*` | −24 dB, knee 12, ratio 6 | narrow loudness band |
| `--sound-timbre-tone` / `-mark` / `-bright` | sine / triangle / 0.35 | data tone, marks and detents, partial above the limit |
| `--sound-graph-duration` | 2 s | any series in V1, and "together" in V3 |
| `--sound-rumble-rate` / `-watch` | 6 slots/s / every 2nd | V2 |
| `--sound-week-slot / -note / -double / -span` | 320 ms / 160 ms / 87 ms / 1 octave | V4 |
| `--sound-cadence-step` | ×1.5 (a fifth) | V4 resolution |
| `--sound-sr-transpose / -spacing / -wpm` | ×2 / 167 ms / 220 | V5 glyph and speech estimate |
| `--sound-scrub-big` / `--sound-detent-soft` | 6 h / 0.6 | V6 |
| `--sound-vol-<category>` | 0.5–0.8 | default volume per category |
| `--sound-reduced-gain` / `-max-notes` | 0.6 / 3 | the reduced-sound setting |

The CSS uses only kit tokens plus the cinematic run's proposed `--x-rack-*`, `--x-type-micro` and
`--x-unavailable`. Eyebrows and numerals rely on IBM Plex Mono, which still needs an ADR.

---

## V1: Audio graph
*Idea:* This is Apple Audio Graphs done the AUGUR way. Press L on a phrase. First you hear **one reference note, the
limit**. Then the last 24 hours play as a **single gliding tone over 2 s**, and **a second partial
fades in while the line is over the limit**, so the crossing sounds brighter, not louder. A short
accented note for **now** ends it. The card shows the chart, a playhead, a three-part sequence bar
(limit note · the line · now) and Apple's chart description in words. ← → moves to the next series.
*Sources:* Apple Audio Graphs (WWDC 2021) for the fixed-length tone and the chart summary; Brewster for
"accent the first, lengthen the last" and timbre for state; Bregman for reference-tone anchoring.
*What works:* It is the most familiar idea, so VoiceOver users already know it. The reference note
fixes the scale's top before the data plays, so "did it cross?" is answered by ear even if you don't
know the units. The fixed duration means a 24-hour series and a 7-day series take the same time.
*What fails or risks:* A gliding sine is the least *calm* sound here. It is continuous and slightly
sirenish when it climbs. Fine detail (the 06:00 bump) is lost at 2 s. Pitch-only mapping hides
absolute values, so the description text has to do that work. The brightness change is subtle
on laptop speakers.
*"After lunch":* Keep. It only plays when asked, and after a few listens it is 2.5 s you choose.
It would grate if it ran on every hover, so it doesn't.
*Screen reader clash risk:* **Medium-high.** The tone lasts 2.5 s and focus landing on the phrase
makes the reader speak its label at the same moment. That is why the text summary is held back
until the tone ends, but the reader's own focus speech is outside AUGUR's control. V5's ordering
fixes this.
*Principles:* Calm ✓ (on demand). Explain-never-hide ✓ (description, captions, quiet phrases).
Letterbox: none. A crossing found by listening could open the cinematic hand-off. Focus: the card
racks the app softly.
*Needs:* Hourly series per measure with watch and limit from Admin, a per-hour normal band (the baseline
service), phrase templates in the manifest, and a kit `sonify()` primitive.
*Score:* Clarity 4 · Distinctiveness 2 · Feasibility 5 · Fit with calm water 3

## V2: Rumble strip
*Idea:* **Dark cockpit for the ear.** Only the relationship to the limits makes a sound. Each series is
bracketed by **two low marks in its owner's register** (Org higher, You lower). Normal hours are
**silence between the marks**. The watch zone ticks every second hour (3 a second, C5). Over the limit
it ticks every hour (6 a second, on the limit note). A series that ends over the limit ends on a held,
bright limit note instead of the closing mark. **A** plays all four in order. Steady ones shrink to
just their two marks (0.4 s), so "the whole sentence, nothing wrong" takes about 1.5 s. The card
draws a rumble rail of hour slots under each chart. Slots light as their tick plays.
*Sources:* road rumble strips and parking sensors (rate = proximity); Geiger counter; avionics dark
cockpit; Brewster (rhythm for sub-groups, ≤6 notes/s); `time-is-matter` (the normal past is silent).
*What works:* It answers the glance-away question directly: **silence means fine, ticks mean look**.
It never sonifies the boring part. The bracketing marks make silence *a reading* rather than a fault
("it listened and found nothing"). Rhythm carries urgency, so loudness stays flat. It also maps onto
the cinematic levels (normal / watch / limit).
*What fails or risks:* You learn nothing about shape inside the normal band (by design). The tick rate
is the only scale, with two steps and no gradient. 6 ticks a second for 8 hours of breach is
insistent. That is right for a breach, but if you replay it often it is the most irritating sound on
this surface. In "all", the ticks lose which series they belong to unless you watch the rows, so the
owner-register marks have to carry it.
*"After lunch":* **Keep, and it is the one I'd leave on.** Most presses produce two soft marks. It
only gets busy when something is genuinely wrong, which is the bargain the run asks for.
*Screen reader clash risk:* **Low-medium.** The sounds are short and percussive with long silences, so
they mask speech less than a held tone does. "All" is up to 10 s, so it still needs V5's turn-taking,
and the summary words come after.
*Principles:* Dark when normal ✓✓. Calm ✓. Explain ✓ (verdict per row: "1 h in watch, 8 h over the
limit · still over"). It fits the light language: watch amber, limit red, marks muted.
*Needs:* Watch and limit per measure (Admin) and an owner floor per measure. It needs no new data beyond V1.
*Score:* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit with calm water 5

## V3: Call and response
*Idea:* Compare two series by ear. **Turns:** every 3 hours, a **pair** plays: the first series from
the left (smooth sine), then 0.1 s later the second from the right (hollow triangle). **The interval
between the two notes is the difference.** The same note means the same value. **Together:** both lines
glide at once for 2 s, split by timbre and side (auditory streaming). Pairs come from data: today
against the same day last week, or sign-in against events. Different units are compared as "share of
each one's own limit", so the limit is the same note for both. **C** changes the pair and **T** changes the mode.
*Sources:* Brewster compound earcons (0.1 s gap); Bregman, *Auditory Scene Analysis* (stream
segregation by timbre and location); psychoacoustic interval judgement.
*What works:* Turns is genuinely legible. People judge "the second note was lower" far better than
two absolute pitches. The chart shows each pair as two dots joined by a stalk with ↑, ↓ or =, so the
sign matches the sound one for one. Comparing a series against its own past ("is today normal?") is the
best use.
*What fails or risks:* **Together** is muddy for most listeners, especially on laptop speakers. Stereo
panning disappears in mono, on a shared speaker or with one earbud in, so side cannot be the only
cue (timbre and order carry it too). A 5 s answer is slow for a glance. Choosing pairs needs a
manifest or a menu, and a phrase without a pair has nothing to play (the caption says so).
*"After lunch":* Fine, because you'd use it rarely and on purpose. Not a daily sound.
*Screen reader clash risk:* **High** in Together (2 s, two voices). **Medium** in Turns (5 s of sparse
pairs). A screen reader user would get more from the sentence "Events today was higher in 3 of 9
pairs, at 07:00, 13:00, 21:00", which the card also writes.
*Principles:* Calm ✓. Explain ✓. It is the weakest fit with "dark when normal", because it is a sound
whose purpose is to sonify normal data.
*Needs:* Last-week series (baseline service), a pair definition in the manifest, and a pan-safe
fallback (mono detection isn't possible, so this needs a setting).
*Score:* Clarity 3 · Distinctiveness 4 · Feasibility 4 · Fit with calm water 3

## V4: A week in two seconds
*Idea:* Press **W** to hear **seven notes, one per day**. Each note's pitch is that day's peak, and it is
played in **the register of whoever owns the limit** (hierarchical earcons: Org 311 Hz home, Department
262, Team 233, You 196). **A day over the limit is a doubled note**, so rhythm carries it, not volume.
Then comes a **cadence**. If the week ended inside the limit, a falling fifth lands on the home note
(**resolved**). If it is still over, the limit note is held and bright (**unresolved**). The card is a
tiny staff: note heads on a home line and a limit line, daily range bars underneath, and a register
ladder. **A** plays all four series, each in its own register.
*Sources:* hierarchical earcons (children inherit the parent's register); Brewster (first note
accented, last lengthened, ≤6 notes/s, so the doubled note's gap is 87 ms); the tonal cadence as
"closure", which most people hear without any training.
*What works:* It is the most memorable and the most *summary* of the six. You remember the shape of
the week ("two hiccups, ends unresolved"). The cadence is a strong yes or no that needs no numbers.
The register answers "whose problem is this?" before any data plays. That is the Floors idea, heard.
*What fails or risks:* It breaks the house note. Here the limit is an octave above the owner's home
note, so the same breach sounds different on Org and on Department. I think register-as-owner is worth
it for summaries, but it has to be one rule or the other per surface, not both. It is the most
*musical* idea, and the risk is that it turns cute (a jingle). Keep the timbres plain. Daily peaks hide
the hour. Tonal resolution is culturally learned (it holds for Western listeners, and is weaker otherwise).
*"After lunch":* Keep. It is 2.5 s and you ask for it once a day, Monday-morning style. "All four" (about 12 s) is
the one to avoid repeating.
*Screen reader clash risk:* **Medium** (2.5 s). The cadence is the most useful part for a screen
reader user, because it is a yes/no earcon that could stand alone in about 0.5 s after the words.
*Principles:* Dark when normal ✓ (a resolved cadence is the "all clear"). Floors ✓✓ (register).
Calm ✓.
*Needs:* Daily peak and minimum per measure for 7 days, an owner floor per measure, and a decision on
house note versus owner register.
*Score:* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit with calm water 4

## V5: Turn-taking
*Idea:* This is not another sonification. It is **the rule for how sound and speech share the ear**, built for
screen reader users. L plays a **half-second glyph**: three short notes (start, extreme, now), an
octave up so they sit above most speaking voices. Then comes **0.3 s of silence**, and only then are the words
handed to the live region. So AUGUR owns the order and the two never overlap. The card shows it as
lanes (AUGUR / Screen reader / *Without turns*, where a 2 s graph sits on top of the words, hatched
red). There are three orders. *Glyph, then words* is the default. *Words, then glyph* waits an estimate of the speech
time, so it can still clash, and the page says so. *My screen reader plays charts* means AUGUR stays
**silent** and exposes the series as a real table (**T**) and as chart data the reader can play itself.
*Sources:* screen reader practice (NVDA and JAWS earcons are short and precede speech); Apple Audio
Graphs (AUGUR shouldn't duplicate VoiceOver's own); speech masking (energy in the 300 Hz–3 kHz
consonant band); Brewster.
*What works:* It is the only page that treats speech as a **sound source AUGUR must leave room for**.
The three-note glyph is enough for "up, down, over" and short enough to finish before the reader's
next utterance. The "reader plays charts" order is the honest answer for many VoiceOver users:
step aside.
*What fails or risks:* AUGUR can't know when the screen reader is speaking, because browsers expose no
such signal. "Glyph first" works because AUGUR decides *when the live region updates*, but focus
speech (the button label read on Tab) can still start under the glyph. The wpm estimate is crude.
Live regions are delivered differently by NVDA, JAWS and VoiceOver, so this needs testing with real users.
*"After lunch":* Keep. It is half a second, and only when asked.
*Screen reader clash risk:* **Lowest by design**, and zero in "reader plays charts". The residual risk
is focus speech starting while the glyph plays.
*Principles:* Explain ✓✓ (the lanes show why). Calm ✓. It applies to every sound AUGUR makes, not just
telemetry.
*Needs:* A per-person setting (order, and "my screen reader plays charts"), a data-table view for
every sparkline, and chart semantics a reader can sonify. None of this is detectable, so it is all
settings.
*Score:* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit with calm water 5

## V6: Scrub with detents
*Idea:* **Explore by hand.** The chart is a real `role="slider"`. ← → steps one hour and plays **one 80 ms
note** for that hour. **Crossing the limit plays a detent**: the limit note in the sharper mark timbre,
accented, like a rotary selector clicking into a position. Leaving or re-entering the normal band
plays a softer detent. Shift+← → jumps 6 hours as one glide, and a detent still sounds if you
passed one. Home and End jump to the ends, and ↑ ↓ changes series. Key repeat is throttled to 6 notes a second, and the trace under
the axis marks each step as a note, a detent or a skipped note. The pointer scrubs too.
*Sources:* Apple Audio Graphs interactive mode; Braun rotary selector detents and camera dials (the
run's physical-controls reference); Brewster.
*What works:* It is the best tool for **finding where** something happened, which playback (V1) can't
do. The detents give the limit a *physical* edge, so you feel the crossing rather than judging a
pitch. Silence when you stop moving is perfect dark-cockpit behaviour. `aria-valuetext` carries the
words ("14:00, 5, crossed the limit"), so the sound is an addition, never the only channel.
*What fails or risks:* Holding an arrow key past 6 a second drops notes. That is correct by Brewster,
but it feels laggy, and the trace shows it. The band-edge detent and the watch line coincide in this data,
which makes them easy to confuse. The pointer scrub is for sighted users, and is mostly redundant there.
*"After lunch":* Keep. It only sounds while your hand moves.
*Screen reader clash risk:* **Medium-high.** Every arrow press makes the reader announce
`aria-valuetext` while the note plays. The note is 80 ms and starts before the reader usually
speaks (100–300 ms latency), which is the same trick NVDA's progress beeps use, but detents and glides
are longer. It needs a setting for "notes instead of values" (terse valuetext) for people who prefer
to scrub by ear and ask for the number.
*Principles:* Calm ✓✓. Explain ✓ (the trace and the readout). It fits the radial menu's detent language
(pointer surface), so one vocabulary covers both.
*Needs:* Same data as V1. A kit chart component with slider semantics.
*Score:* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit with calm water 4

---

## For screen reader users, directly
- **Helps you:** **V6** (scrub) and **V2** (rumble strip). V6 lets you find *when*, with the limit as
  a detent you can feel, while your reader still speaks the value. V2 answers "is anything wrong?"
  as near-silence or ticks, short and sparse, so there is little to mask. **V4's cadence** on its own
  (about 0.5 s, resolved or held) is a good yes/no earcon to append after the reader speaks a phrase.
  **V5** is not optional: it is the rule all the others should follow.
- **Clashes with speech:** **V1** (a 2.5 s continuous tone) and **V3 Together** (two voices at once) mask
  consonants if your reader is talking. Use them only with V5's "glyph, then words" order, or not at all
  if your reader already sonifies charts (VoiceOver Audio Graphs). In that case AUGUR should stay silent and
  give you the table.
- **What AUGUR cannot do:** know when your reader is speaking. So turn-taking means AUGUR controls when
  *its* words reach the live region, and keeps every sound short enough to fit in a gap. Captions and
  the polite live region always carry the same information as the sound.

## Office and meetings (for the shortlist)
On-demand only, so nothing surprises a room. Mute stops sounds at once. Captions keep the information
when muted, and on a shared screen they are the sound. Don't rely on stereo (V3): a meeting-room speaker
is mono. Reduced sound is a good default for open plan.

## Ranked
1. **V2 Rumble strip**: dark cockpit for the ear; silence is the normal reading. Leave it on.
2. **V5 Turn-taking**: not a sonification but the rule that makes all of them usable with a screen reader.
3. **V6 Scrub with detents**: the best "where did it cross?" tool; detents tie in with the pointer surface.
4. **V4 A week in two seconds**: the most memorable summary; floors as register; the cadence is reusable.
5. **V1 Audio graph**: solid and familiar, but a continuous tone is the least calm sound here.
6. **V3 Call and response**: Turns works, Together doesn't, and comparison is a rare need.

## What I'd build first
A small kit primitive, `sonify(series, limits, mode)`, built on Web Audio with the `--sound-*` tokens and
the engine rules above (clamps, rate ceiling, narrow band, nothing before a gesture, caption out,
words after sound). Ship it with exactly two modes on the sparkline sentence: **V2's rumble strip on L**
(and on A for the whole sentence) and **V6's scrub** inside the chart that opens from a phrase. Both obey
**V5's turn-taking**, with "my screen reader plays charts" as a setting. Adopt **the house note** (the limit
is always G5) as the one pitch rule for telemetry. Keep V4's owner register for the start and end marks
only, as V2 already does, rather than moving the limit. Adding Web Audio as a platform dependency and
the settings model needs an ADR. I'd write it only for these on-demand data sounds, not for
notifications. Where I went beyond the ask: V5 is a policy page rather than a sonification, and
I think the shortlist needs it more than a seventh sound.

## Candidate concepts (for `concepts.md`)
- **the-limit-is-a-note**: every limit in AUGUR sounds the same pitch, and values are heard as distance
  from it, the way the red line is the same red everywhere (V1, V2, V3, V6).
- **bracketed-silence**: silence only means "normal" when something marks that the instrument listened
  (start and end marks, a resolved cadence). Silence is a reading, not an absence (V2, V4).
- **turn-taking**: AUGUR's sounds and assistive speech never overlap. AUGUR owns the order or steps aside,
  and the words always follow the sound (V5, V6).
