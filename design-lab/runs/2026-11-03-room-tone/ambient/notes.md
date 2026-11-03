# Ambient activity: critique

Surface 5 of the room-tone run. Background work (sync, upgrade, import) as
sound: room tone, a quiet pulse, or nothing, and what you hear when it stops,
fails or finishes. Weiser and Brown's Dangling String is the model. Every page
opens silent with "Click to enable sound", shows its moment about 1.2 s after
load, replays with R, and writes every sound into the caption strip whether it
played or not ("(sound off)", "(muted)", "(reduced sound: not played)").

**I could not listen to these.** The pages were rendered and checked headless,
so every judgement about how a sound *feels* comes from the parameters, the
Brewster numbers and the arithmetic of rates. Harry should audition V4 and V6
first, then V1, before trusting any "after lunch" verdict below.

All six share one engine and one `SOUND` object (tokens at the end). Shared
earcon shapes, over the job's floor pitch:

| Meaning | Shape | Family (timbre) |
|---|---|---|
| Finished | two notes rising a fifth (0, +7) | sine, `change` |
| Source silent | two notes falling a fourth (+5, 0) | triangle, `edge` |
| Source back | two notes rising a fourth (0, +5) | triangle, `edge` |
| Failed | short-short-long (0, 0, +3) | triangle, `alert` |

Floors set the register: You 196 Hz (G3), Team 262 (C4), Department 330 (E4),
Org 392 (G4).

---

## V1: Dangling string (`v1-dangling-string.html`)

*Idea.* Each job hangs a string from a "ceiling" line. It twitches in
proportion to its traffic, hangs still and dashed when its source goes quiet,
snaps when it fails and is drawn up when it is done. One shared room tone (a
band of soft noise) gets thicker with total traffic and thins when a source
stops. Silence itself is the first cue. After a grace period, two falling notes
say "source silent".

*Sources.* Weiser and Brown, *Designing Calm Technology* (the Dangling String);
Murch on room tone; Brewster for the earcons.

*What works.* It is the most faithful version of the brief. The silent-source
card says "Silent, not stopped", shows the last value held and names who can
change it, which is `the-record-has-edges` done properly. A finished job is
drawn up and goes grey, so the past is silent and never glows. The room tone
never says anything the strings don't already show.

*What fails or risks.* The strings move the whole time work is running. That is
exactly why the tick tape was rejected last run: it breaks "dark when normal"
unless you accept that background work is not "normal". The room tone runs from
160 to 900 Hz, the same band as speech fundamentals, so it partly masks voices
and screen readers. In an office it fails both ways (see V5): quiet enough for
the next desk means masked for you. Animating a string per job costs little
(SVG, one rAF that stops when nothing moves), but in the shell it would need
its own lane, and it does not scale past about five jobs.

*Principles.* Letterbox: not involved. Focus stacking: none. Explain, never
hide: strong (silent and failed cards name a reason and an owner). Calm: visual
yes once done; sound no, because a continuous bed is the opposite of a dark
cockpit.

*Needs.* A per-job rate (bytes or rows a second) and a "last heard" time from
the events service. `--sound-bed-*` tokens. The `--pattern-unavailable` hatch
(already asked for last run).

*After lunch.* The strings stay. The room tone goes off by two o'clock on
speakers. On headphones it might stay on for someone who likes it.

*Screen reader clash.* Medium. A continuous noise bed sits under the
synthetic voice. The earcons are short and fine.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 3

---

## V2: Held chord (`v2-held-chord.html`)

*Idea.* The four floors are drawn as a stave, with Org highest. Each running
job holds one quiet sine note on its floor's pitch, two semitones above home,
so it sounds unresolved. Finishing glides the note onto home and fades it out
(a cadence). A silent source drops its note to a ghost level, which is "value
held but stale" as sound. A failure cuts the note at once and plays the
caution. There are never more than three notes: a fourth job is drawn hollow
and labelled "shown, not voiced: 3 notes already held".

*Sources.* Hierarchical earcons (Brewster); film-score suspensions and
cadences; `the-record-has-edges` (ghost = silent source).

*What works.* It is the most distinctive idea, and the clearest statement of
"finishing = resolution". The ghost note is a good sound for "held but stale".
The voice cap is shown rather than hidden.

*What fails or risks.* A held tone all day is tinnitus. A chord that changes
when a job finishes is subtle, and most people cannot tell E4 from C4 without a
reference, so "which floor" is not really heard. Pitch only works inside one
earcon, as a contrast. Sine tones in the 200 to 400 Hz range sit right under a
screen reader's voice. The stave layout is lovely but uses a whole screen for
four facts.

*Principles.* Explain, never hide: good (the unvoiced job says why). Calm: no.

*Needs.* Progress for each job (0 to 1). `--sound-voice-max`,
`--sound-suspend`, `--sound-ghost-level`.

*After lunch.* Off.

*Screen reader clash.* High.

*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 4 · Fit 2

---

## V3: Missed beat (`v3-missed-beat.html`)

*Idea.* Each job "beats" once a minute in its own rhythm: one tick for a sync,
two for an upgrade, three for an import (rhythm for sub-groups), pitched by
floor. Past beats are ink marks on a strip. The next expected beat is drawn
hollow. A beat that does not come becomes a hatched slot at the time it was
due, and nothing plays. Only after two misses does the rhythm play with its
last tick missing, followed by a falling third. A finished job's last beat is
long (Brewster: lengthen the last note).

*Sources.* Brewster (rhythm families, lengthen the last note); lighthouse
characters (a light's identity is its rhythm); heart monitors.

*What works.* The strip is the best *visual* of the six: absence drawn at the
moment it was due, not "stale since". It makes `the-record-has-edges` concrete.
Rule worth keeping everywhere: **the first miss is silent** ("one miss is often
nothing"), which debounces flaky sources. Past is ink.

*What fails or risks.* The sound is a clock: sixty ticks an hour for each job.
With three jobs that is 180 ticks an hour, and many more from the desks around
you. The ticks also interrupt screen reader speech at random. The demo scales
one beat to one minute, which makes it look livelier than it would feel.

*Principles.* Explain, never hide: strong. Calm: the strip yes (static, it
changes only on a beat), the sound no.

*Needs.* A heartbeat or "expected next event" time per source from the events
service. This is new data and the real gain: a source that declares its
cadence can be called silent honestly. `--sound-miss-limit`.

*After lunch.* The heartbeat sound goes off. The missed-beat earcon (rarely
heard) and the strip stay.

*Screen reader clash.* Medium (periodic ticks).

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 3

---

## V4: Who is waiting (`v4-who-is-waiting.html`)

*Idea.* No ambient sound at all. A change makes a sound only when (1) it failed
or still needs you, (2) you started it and are waiting (within
`--sound-wait-window`, 15 minutes), or (3) a source that something you have
open relies on went silent. Finishes that land while you type are held and
played once at your next pause: the finish earcon, then the batch size in ticks.
Anything that happened while you were away stays silent (the past is silent),
except what still needs you, which plays once on your return. A ledger records
every change with "Heard: two rising / silent / held / with 1 other" and *why*.

*Sources.* The dark cockpit (avionics: only the abnormal sounds);
`time-is-matter` (the past is silent); notification batching in mobile
operating systems; explain, never hide.

*What works.* It is the only variant that clearly passes the after-lunch test,
and the ledger is a new idea: **explain, never hide, applied to silence**.
Every sound that did *not* play still says why, so turning sound on never
feels random. Holding finishes for a typing pause respects flow. The rule fits
in three numbered lines.

*What fails or risks.* It gives up the Dangling String's real promise:
noticing work *while* it runs. "Waiting" is a guess (fifteen minutes, still on
the page). "Typing" and "away" need idle and visibility signals (the browser
has `visibilitychange` and the Idle Detection API, though the latter needs
permission and is Chromium-only). "Something you have open relies on it" needs
dependency data the shell does not have yet (the same gap Delete's preview hit
last run).

*Principles.* Calm: strongest. Explain, never hide: strongest. This is
"dark when normal" applied to sound with no exceptions.

*Needs.* A `startedBy` field and a notice level on every job event. Presence
(typing, paused, away) from the shell. Dependencies between sources and open
documents. `--sound-wait-window`, `--sound-count-max`, a "hold for pause"
setting.

*After lunch.* On.

*Screen reader clash.* Low, but real: the earcon and the `aria-live` line for
the same change land together. Play the earcon first and announce after it
ends (the engine knows the earcon's length), or let screen reader users choose
"announce only".

*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 5

---

## V5: Open plan test (`v5-open-plan.html`)

*Idea.* An honest test bench, not a feature. Twelve desks with you in the
middle. One office hour runs in twelve seconds. Pick a strategy (room tone,
heartbeat, who is waiting, on demand) and an output (desk speakers,
headphones, sharing a screen in a meeting). Rings show every sound that
reaches you, panned to where its desk sits, over simulated office noise. Notes
beyond six a second are dropped and counted. A 4 × 3 table gives a verdict for
each pairing "if everyone did the same", with the reasoning written out for the
selected cell.

*Sources.* Weiser and Brown; office acoustics guidance (the 45 to 55 dB(A)
background is an assumption on the page, not a measurement); Brewster's rate
limit.

*What it found (the honest answer).*
- **Continuous sound fails on speakers, whatever its form.** A room tone quiet
  enough not to bother the next desk is masked for you by office noise. One
  loud enough to hear reaches about eight desks, all day, and nobody can tell
  whose it is. That holds for V1's bed and V2's chord.
- **Periodic sound fails everywhere.** V3's heartbeat is about 480 ticks an
  hour from eight neighbours on speakers, and a clock in your ear on
  headphones.
- **Event sound is borderline on speakers and good on headphones.** About four
  earcons an hour per desk (V4). With every desk sharing one quiet vocabulary
  it is tolerable at low volume. On headphones it passes.
- **On demand passes everywhere** (V6). Nothing plays unless something fails
  or you ask.
- **Meetings: nothing may reach a share.** The browser cannot tell that a tab
  or screen is being shared, so this needs an explicit "Presenting" mode (or
  the shell's own meeting view) that sends sound to your headphones or
  nowhere.

*What fails or risks.* The verdicts are my judgement written as data, so Harry
can disagree with each cell. The neighbour model (earshot of 1.5 desks, everyone
using the same setting) is crude. It should be checked once in a real office
with two laptops.

*Principles.* Calm: the page itself moves only during the scripted hour.

*Needs.* Nothing for the product. It feeds round 2's "a full day compressed
into two minutes" directly: reuse its event generator with all surfaces'
sounds.

*After lunch.* Not applicable: it is the instrument for this test.

*Screen reader clash.* Not applicable.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 5 (as a lab tool) · Fit 4

---

## V6: Stethoscope (`v6-stethoscope.html`)

*Idea.* Background work never sounds by itself, except a failure. Hold H (or
the button) and each job's last half hour plays in turn as one gliding tone:
left to right in time, higher when busier, *silence for a gap in the record*.
Each ends with a short earcon: two taps (still running), a rising fifth (done)
or short-short-long (failed). While you listen, the lane being played comes
into focus, the others dim (a rack focus), and a scan line follows the sound.
Let go and it stops at once. The same summary goes to `aria-live` when
listening starts.

*Sources.* Apple Audio Graphs (WWDC 2021) and sonification practice; Weiser
(the periphery as something you can reach for); the stethoscope as a pull
instrument.

*What works.* The sound is pulled, not pushed, so it passes the office test and
the after-lunch test. A gap is audible as silence, so `the-record-has-edges`
can be *heard* as well as seen. It is the most useful variant for blind and
low-vision users: one key press gives a spoken summary plus the shape of each
job. It reuses the focal planes from last run (the lane in focus, the rest
racked back). The sound pane's "Reduced" setting leaves it alone: sound you ask
for is not ambient.

*What fails or risks.* Nobody listens to something they don't know to ask
about, so V6 cannot replace V4's push for failures. H must not fire while
typing; in the product it needs a chord or a Glance action. Three jobs take
about six seconds, so twelve would need a summary first ("9 steady, 2 quiet, 1
failed") and drill-in. The contour tone in the 200 to 800 Hz range is fine when
asked for, but not under speech.

*Principles.* Focus stacking: yes (rack focus on the lane being played).
Explain, never hide: the gap is drawn and heard. Calm: yes.

*Needs.* A per-job time series (the sparkline ribbon from last run needs the
same data). `--sound-listen-*` tokens. A product key binding.

*After lunch.* On (it is silent until asked).

*Screen reader clash.* Low. It is designed *with* the screen reader: speech
first, then contours. Pause speech while a contour plays.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

---

## Ranked

1. **V4 Who is waiting**: the default sound policy for background work, with
   the ledger.
2. **V6 Stethoscope**: the on-demand layer, best for accessibility.
3. **V3 Missed beat**: keep the strip and the "first miss is silent" rule;
   drop the heartbeat sound.
4. **V5 Open plan test**: keep as the instrument for round 2's compressed day.
5. **V1 Dangling string**: keep the strings as a visual option for an
   Admin/Upgrade Centre "jobs" view. The room tone is headphones-only, opt-in,
   if at all.
6. **V2 Held chord**: not worth pursuing as ambient. Keep only the
   "suspension resolves" earcon idea for finishes.

## What I'd build first

V4's rule plus its ledger, in the shell's notice service, before any sound
ships: three conditions (needs you, you are waiting, something you rely on went
silent), a pause-batch, and "the past is silent" on return. Every change gets a
"Heard / silent, because..." entry visible in Glance. That ledger is useful even
with sound off, because it is the explanation of attention, and it gives the
four shared earcons (finished, source silent, source back, failed) one place to
be triggered and captioned. Then V6's hold-to-listen on the same data, as the
accessibility win. **Where I push back on the brief:** the Dangling String
should stay *visual*. In a shared office the ear should get only the *edges*
(changes of state), never the *state* itself. The "room tone that drops out"
belongs to the Letterbox moment, which happens a few times a day, not to
background work, which runs all day.

## Conflicts with the combined screens

- V1's moving strings conflict with "dark when normal", as the tick tape did.
  They are acceptable only in a dedicated jobs view, never in the shell's
  periphery.
- None of these sound the urgent path. A failed background job is "needs you"
  (the caution), not urgent. The Letterbox keeps its own sound (urgent surface).
- V6's rack focus reuses the focal planes as they are.

## Proposed tokens

Sound (all values in each page's `SOUND` object):

| Token | Value | Note |
|---|---|---|
| `--sound-gain-ceiling` | 0.14 | linear, after the limiter |
| `--sound-level-bed / -change / -edge / -alert / -listen` | 0.22 / 0.8 / 0.8 / 1.0 / 0.8 | narrow band, about 2 dB apart except the bed |
| `--sound-limit-threshold / -ratio / -knee` | -14 dB / 8 / 6 | holds the band narrow |
| `--sound-pitch-you / -team / -department / -org` | 196 / 262 / 330 / 392 Hz | register rises towards Org |
| `--sound-pitch-min / -max` | 150 Hz / 5 kHz | Brewster |
| `--sound-note-min` | 80 ms | = `--motion-instant` |
| `--sound-note` | 160 ms | = `--motion-quick` |
| `--sound-rate-max` | 6 notes/s | Brewster |
| `--sound-gap` | 100 ms | between compound earcons |
| `--sound-attack / -release` | 12 ms / 140 ms | |
| `--sound-accent / -lengthen` | 1.2× gain / 1.6× length | first note, last note |
| `--sound-fade` | 600 ms | = `--motion-calm`; continuous sounds in and out |
| `--sound-brightness` | 2.4 kHz lowpass | soft edges |
| `--sound-timbre-*` | sine (change, listen), triangle (edge, alert) | families by timbre |
| `--sound-bed-low / -high / -q` | 160 / 900 Hz / 0.7 | V1 only |
| `--sound-voice-max`, `--sound-suspend`, `--sound-ghost-level` | 3 / 2 st / 0.14 | V2 only |
| `--sound-miss-limit` | 2 | V3; the first miss is silent |
| `--sound-wait-window` | 900 s | V4 |
| `--sound-count-max` | 3 | V4 batch ticks, then one long note |
| `--sound-listen-lane / -range / -step` | 1.2 s (= `--motion-run`) / 12 st / 40 ms | V6 |
| `--sound-pan-width` | 0.8 | V5 neighbours |

Settings to propose: **sound on/off** (off by default), **per-category
volume**, **reduced sound** (no continuous or periodic sound, earcons cut to
two notes, on-demand listening untouched; separate from reduced motion),
**presenting** (nothing to a share), and **announce only** for screen reader
users.

Visual tokens (also flagged last run): `--type-micro` (11 px mono numerals),
`--pattern-unavailable` (the hatch, used here for silent sources and missed
beats). Every page relies on `--font-mono`, which still needs an ADR.

## Data the shell doesn't have yet

- for each job: `startedBy`, notice level, rate, progress, and a time series;
- for each source: its expected cadence (heartbeat interval) and last-heard
  time, so "silent" can be declared honestly;
- presence: typing, paused, away, presenting;
- which open documents depend on which sources.
