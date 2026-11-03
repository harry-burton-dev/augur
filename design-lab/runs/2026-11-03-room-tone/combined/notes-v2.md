# Round 2 · V2: Urgent path heard (`v2-urgent-path-heard.html`)

Built by `_src2/build-v2.py` from the round 1 urgent screen (`urgent/v1-caution-chime.html`,
which carries cinematic combined V3 and the shared sound dock) plus `_src2/v2-*.{css,js}`.
Run the probes with `KIT=../../../_kit node _src2/probe-v2.js file://$PWD/v2-urgent-path-heard.html`
(add `cap` to let the question ring to its end).

## What it combines
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

## What works
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

## What fails or risks
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

## Screen reader clash risk
**Low to medium, and better than round 1.** The beat of silence is where the alertdialog's
announcement goes, so the first ask comes *after* the headline is read. In AUGUR, the first ask
should wait for the screen reader to finish speaking, or for a cap of `--sound-silence-before` × 3.
Later asks still land mid-reading. Duck them under speech, or with a screen reader on, set
`--sound-ask-max` to 2. The caption strip is not a live region, so it never talks over speech.

## Principles
Letterbox: kept, and now it is also a sound moment (silence while the bars close, the question as
they land). Focus stacking: kept. Explain, never hide: the lamp says why it is lit, how many asks
remain and what happens after them, and every silent event is written in the strip ("never
sounds", "silence", "sound stopped"). Calm: the repeat is the one exception, and it is bounded
and slowing.

## Needs
Tokens: `--sound-floor-*` (grammar V1), `--sound-timbre-glass`, `--sound-chord-needs|question|moving|answer`,
`--sound-cut`, `--sound-silence-before` (= `--motion-calm`), `--sound-ask-every` (= `--motion-still`),
`--sound-ask-stage` (3), `--sound-ask-grow` (2), `--sound-ask-max` (6, per deployment),
`--sound-listen-lo|hi|points` (262 Hz, 1047 Hz, 18), plus the shared `--sound-gain-*`, `--sound-note-*`,
`--sound-rate-max` and `--sound-gap-compound`. A **lamp** state for the kit `Button`. A **reduced
sound** setting. Data: the notice's floor (exists), a cadence state on the notice record (question,
held, moving, answered, which maps to the existing ack, act and resolve), and the on-call rota for the
hand-off. Also relies on `--font-mono` (needs an ADR) and the combined V3 proposed tokens.

## Scores
Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## Where it goes beyond the ask
The repeat rule hands over to a person instead of to more sound. L (listen to the chart) is the
thing the subtraction cuts. The caption strip writes out the silences too.
