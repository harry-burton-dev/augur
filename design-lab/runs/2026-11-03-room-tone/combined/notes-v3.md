# Round 2 · V3: Travel and reach (`v3-travel-and-reach.html`)

Built by `_src2/build-v3.py` from the round 1 floors shell (`floors/_src/base.html` and
`sound-common.js`, carrying cinematic combined V4 floor travel and the shared sound column) plus
`_src2/v3-*.{css,js}`. Probes: `_src2/probe-v3.js` (demo with sound on) and `_src2/probe-keys.js v3`
(keyboard paths).

## What it combines
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

## What works
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

## What fails or risks
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

## Screen reader clash risk
**Low.** Holding is a moment without speech. Announce "Published" after the landing, not over it
(as here). W is built for screen reader users. The arrival echo can collide with the arrival
announcement, so in AUGUR, play it after speech, or skip it when the announcement already says
"N things need you here". E is medium risk, because it is a phrase, but it only plays on demand.

## Principles
Explain, never hide: every sound has a sign (the echo blip on the gauge, the W pill, the ring, the
thickness bars, the strip), and the locked target says why and who can change it. Calm: silence
is the default and the strongest sign ("nothing waits"). Letterbox: unchanged (an overdue arrival
opens it, as in combined V4). Focus stacking: the sheet racks the plane out of focus.

## Needs
Tokens: `--sound-floor-*`, `--sound-timbre-glass|pure`, `--sound-note-base|last`, `--sound-echo-double|first|per-floor|lp-near|lp-far|max`,
`--sound-where-gap`, `--sound-ladder-steps` (6), `--sound-ladder-hold` (= `--motion-run`),
`--sound-ladder-semis`, `--sound-ladder-land` (12), `--sound-reach-buckets` (1, 10, 100),
`--sound-reach-voices` (1, 1.5, 2, 2.5), `--sound-door`, and the shared gain, limit and rate tokens.
Visual: `--radial-hold-segments` (6), as proposed by pointer V4. Setting: **reduced sound**. Here it
makes figures shorter (the first rung and the landing only, and W plays only where you are)
rather than dropping kinds. Data: the audience count per target at share time, and a cross-floor
waiting query (combined V4 needs it too). Keys: W, E and P in the shell's shortcut map.

## Scores
Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

## Where it goes beyond the ask
Publishing answers the approval that asked for it (the waiting count drops). There is a "two steps
instead" path for anyone who can't hold, and its first press still plays the first rung, so the
reach is heard either way. Reduced sound shortens figures instead of removing them.
