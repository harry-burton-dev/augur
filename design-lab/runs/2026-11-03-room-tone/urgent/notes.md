# Urgent path and Letterbox: six sound ideas

Surface 2 of the room-tone run. Every page is the full cinematic `combined/v3-urgent-path.html` screen (the same data, ladder, letterbox, verbs and keys) with one sound layer on top. The auto-demo runs: notice, needs you, urgent (letterbox), acknowledge, step back, reopen, decide, hold to roll back, release, resolve. Sound plays only once you press **Enable sound** (or **S**). Until then every sound is still written into the caption strip and marked "silent", so a screenshot reads without audio.

**Shared by all six** (one engine, one dock):
- **The dock** sits in the top right at rest and in the top bar while framed. It holds the one switch (Enable sound, then mute: S), the variant's own sign, the **live caption strip** (kind in its colour, then the sentence), and the volume button (V). That button doubles as a level meter, one bar per kind. It opens per-kind sliders, the **Reduced sound** toggle (D) with what it does in this variant, and a "Heard so far" log.
- **The parameters:** every one comes from one `SOUND` object at the top of the script (see "Proposed tokens"). The engine enforces Brewster's numbers: pitch is clamped to 150 Hz–5 kHz, notes last at least 80 ms, at most 6 notes a second, 0.1 s between the parts of a compound, the first note is accented and the last lengthened. Loudness sits in a band from 60% to 100% of one ceiling. **Acknowledge stops everything in its kind at once:** a 20 ms ramp, only so it doesn't click.
- **The AudioContext** is created only inside the Enable click or key press, so nothing throws or warns on load. Reduced motion (M) leaves the sound alone; reduced sound (D) is its own toggle.
- **The caption** (`.x-cap`) moves to the bottom bar while framed, so the dock can use the top bar's empty band.
- Shots: 1600×900 and 1280×800, no console errors. I ran the full demo with sound on for every page (headless, AudioContext running, no errors, no leftover nodes), plus D, V, S, Esc, Q, L and F.

---

### V1: Caution and warning (`v1-caution-chime.html`)
*Idea.* The flight-deck vocabulary, kept to four sounds. Notice is an **advisory**: one quiet sine at the floor's root. Needs you is **master caution**: a single bell chime, played once. Urgent is **master warning**: a falling two-stroke chime that repeats every `--motion-still` (3 s) until someone acknowledges it. The Acknowledge button becomes the **lit Master Warning lamp**: as in a cockpit, the light that calls you is the thing you press to silence it. It shows "Chime 3 · every 3 s · press to silence". Resolve plays two falling notes, once.
*Sources.* Airbus/Boeing single chime vs continuous repetitive chime; the master caution/warning lamp as a push-button; Brewster (accent, rate).
*What works.* You can tell the three levels apart on the first hearing. The repeat is honest: it stops the instant you press the lamp, and "stepping back does not silence it" is said in the caption. "Acknowledged ≠ resolved" stays visible on the lamp ("Silenced 21:14:07 · not resolved"). Acting also silences it, which is what a pilot expects. Cheapest to build.
*What fails or risks.* A 3 s repeat is harsh if you step back to think. Avionics accepts that; an office may not. The lamp brightens with each chime, a visual loop that pairs with the sound (it is off under reduced motion). Bell partials around 1.4–2.8 kHz cut through open-plan noise, which is good for you and bad for your neighbours.
*After lunch.* Keep it on. Urgent is rare, the advisory is nearly inaudible, and caution plays once. I'd want the repeat interval to lengthen after about 30 s rather than run forever (needs a decision).
*Screen reader clash.* Medium. The chime pair (~0.5 s) lands while the alertdialog is being read. The cure is to start the repeat only after the first announcement, or to duck it under speech.
*Principles.* Letterbox: kept. Focus stacking: kept. Explain, never hide: the lamp says why it is lit and how to stop it. Calm: it **conflicts with combined V3's "urgency is carried by space, never by loops"**; that conflict is the point of a warning, and it is limited to urgent.
*Needs.* `--sound-warning`, `--sound-repeat-every`, a lamp state for the kit `Button`, and a decision on whether the repeat ever backs off.
*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

### V2: Room tone drop (`v2-room-tone-drop.html`)
*Idea.* While sound is on, a near-inaudible **room tone** plays: low-passed brown noise plus a 165 Hz hum, set *below* the loudness band. A notice dips it once; needs you darkens it and it stays darker. Before urgent it **drops out entirely**: the frame waits through `--motion-run` of silence (the rules thin and the bloom stops), then lands on **one low note**, and the room stays silent until you acknowledge. Acknowledge brings it back thin ("you're on it, not resolved"); resolve brings it back whole with one soft note. The dock shows a static trace whose height is the room's level. Flat means silence.
*Sources.* Walter Murch on room tone and worldizing; the film convention of silence before the event (pre-lap drop-out); calm technology (noticed when it stops).
*What works.* It is the most cinematic of the six, and the only one where urgent is *quieter* than normal. On headphones the drop-out is unmistakable and strangely calm. Taking something away does not startle, which is the right register for Letterbox. The silent beat also gives the eye time to read the needs-you card before the frame closes.
*What fails or risks.* It **breaks dark-when-normal**: there is sound at rest. On laptop speakers a 380 Hz low-pass bed is close to inaudible, so the drop-out goes unnoticed, and in an open-plan office it is lost under HVAC. An always-running noise source costs CPU and battery. The ~1.2 s of silence before the frame **delays an urgent item on purpose**, which the incident lead may hate. A deaf user gets only the trace, which is a weak sign.
*After lunch.* For most people, no: a constant bed is the first thing they would mute. The drop-out *gesture* is worth keeping without the bed: duck all other ambient sound (sync hum, telemetry) for a beat before Letterbox.
*Screen reader clash.* Low for masking (the bed is low-passed below speech), but it adds constant fatigue under speech. The silent beat means nothing to someone already listening to speech.
*Principles.* Letterbox: it becomes a sound moment (silence, then one note). Focus stacking: kept. Explain, never hide: the trace and caption show the state. Calm: **conflicts with dark-when-normal**.
*Needs.* `--sound-room-gain`, `--sound-room-cutoff`, `--sound-room-hum`, `--sound-room-drop`, `--sound-room-hold`, `--sound-room-return`, `--sound-arrival`. It also needs the shell to delay the Letterbox open by a token, which the current kit can't do.
*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 3

### V3: Lens ladder (`v3-lens-ladder.html`)
*Idea.* One family for the whole path, built as hierarchical earcons. Each level adds a note: notice 1 (the root), needs you 2 (root, fifth), urgent 3 (root, fifth, octave, repeating every 3 s until acknowledged). The resolve walks back down (octave, fifth, root). The **root is the register of the floor the notice comes from** (You 220 Hz, Team 294 Hz, Department 392 Hz, Org 523 Hz), so an Org urgent is higher than a Team one. The motif is drawn twice: on a four-line floor staff in the dock, and as 1, 2 and 3 pips on the lens marks 10, 3 and 1. **F** plays the urgent motif on all four floors.
*Sources.* Brewster, Wright and Edwards on hierarchical earcons (children inherit and add); the combined V3 lens ladder (∞ 10 3 1).
*What works.* The most *systematic*: the same rule could cover every notice in the shell, and the lens marks already promise "closer = more". The register gives you the floor before you look. It sits closest to the run's grammar sheet, so it is a good candidate for the base vocabulary.
*What fails or risks.* The urgent motif isn't very distinct from needs you: one extra note, and the gap is pitch rather than rhythm. Brewster would want a rhythm change for that. Telling floors apart by register works relative to the last sound you heard, not absolutely: no one hears "392 Hz, Department" cold. The pips on the lens are small.
*After lunch.* Yes for notice and needs you. Urgent's three-note repeat would wear on you, as in V1.
*Screen reader clash.* Medium. The glass timbre at 523–1046 Hz sits in the speech band.
*Principles.* All four kept. Calm: the repeat is the same conflict as V1.
*Needs.* `--sound-ladder-*`, `--sound-floor-*` and floor data on every notice (the shell has it: `DATA.urgent.floor.kind`).
*Score.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4

### V4: Closing bars (`v4-closing-bars.html`)
*Idea.* **Every sound sits in the stereo field where its sign is on screen.** The notice comes from the ribbon phrase's x position and needs you from the card. The **letterbox closing is heard**: the top bar's tone glides down from an octave above and the bottom bar's glides up from an octave below. Over `--motion-calm` they meet as a fifth, while the stereo spread closes to the centre as the bars travel in. Urgent repeats as a short "squeeze" from the centre. Once you step back (Esc), it comes from **the pill at the top edge**, where the notice now waits. A marker pill rides the rules in with the sound, and the dock has an L–R pan meter.
*Sources.* Murch's worldizing (sound placed in the space it belongs to); Brewster's spatial position as an earcon family dimension; the Letterbox bars as physical objects.
*What works.* The frame closing as a sound is the best single "Letterbox opening as a sound moment" in the set: the glide lasts exactly as long as the motion. "The warning moved to where it waits" is a genuinely new idea: after Esc, the sound tells you where to look.
*What fails or risks.* Stereo is fragile: mono laptop speakers, one earbud, a monitor off to one side, or a screen share in a meeting all lose it. The glides read as "sci-fi" when sound designers aren't tuning them. Markers that travel with sounds are one more moving thing. Positions need layout reads (`getBoundingClientRect`) on every sound.
*After lunch.* The close is fine (it's rare). The squeezes from the edge would annoy if they never stop, as with any repeat.
*Screen reader clash.* Medium. Many screen reader users run one earbud, so the spatial part is lost to the people it could help most.
*Principles.* Letterbox: it gains sound that *is* its motion. Focus stacking: kept. Explain, never hide: the marker shows where each sound belongs. Calm: the moving marker is a cost.
*Needs.* `--sound-pan-width`, `--sound-frame-close`, `--sound-frame-open`, `--sound-frame-repeat`, and a shell service that knows where a notice's sign is.
*Score.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 3

### V5: Live pulse (`v5-live-pulse.html`)
*Idea.* **Urgent's repeat *is* the measure.** It plays only when a new sample lands (every `--motion-still` in the demo) and is a compound: first the **limit's tone** (quiet), 0.1 s later the **value's tone** (accented). Value maps to pitch on a log scale (0 → C4, the chart's 4% max → C6), so the interval tells you how far over the limit you are, and it widens as things get worse. Acknowledge stops the pulse at once. **L** plays the last 12 samples as pitch at the maximum rate (about 2 s, Audio Graphs style) with a playhead on the plot. After you act, the expected samples play quietly, and **crossing back under the limit** is heard as the value tone dropping below the limit tone. Under the live readout, a **pitch rail** on the same scale as the chart shows the dot you are hearing.
*Sources.* Apple Audio Graphs (WWDC 2021); sonification of limits; the combined V3 limit bands and readout.
*What works.* It carries the most real information: you can look away and still know "worse, better, under the limit". L is the most valuable accessibility piece in the whole surface: on-demand sound for a chart, with nothing playing unasked. The crossing earcon is good resolution feedback, because it is the data saying so.
*What fails or risks.* A pulse every sample is only calm when samples are slow. At real telemetry rates it must be throttled, which needs a token. The interval only reads well to a musical ear; most people hear "higher" and "lower", which is enough. It only works for notices that have a measure (the upgrade halt does; a share request doesn't).
*After lunch.* The pulse, no. Most people would set its volume to zero, and L stays. Crossings are welcome.
*Screen reader clash.* The live pulse has the highest risk of the six (it plays during reading), so turn it off when a screen reader is running. L is low-risk and is the reason to build this.
*Principles.* Explain, never hide: the rail and the playhead show what you hear. Calm: the pulse is a loop tied to data. Letterbox and focus stacking: kept.
*Needs.* `--sound-value-low`, `--sound-value-high`, `--sound-pulse`, `--sound-listen`, a throttle token, and a series API on notices (the kit's `StripPlot` data).
*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

### V6: Suspended cadence (`v6-suspended-cadence.html`)
*Idea.* **The three verbs are heard as harmony.** Urgent asks a **question**: a suspended chord (root, fourth, fifth, arpeggiated), repeated every 3 s until acknowledged. Acknowledge stops it at once and **does not answer it**. Acting plays the **dominant** once ("moving towards"). Only the system's resolution plays the **answer**: the fourth falls to the third, then the octave, then silence, even minutes later. Notice is the bare root; needs you is root plus fourth, left hanging. A **cadence line** in the bottom bar shows Question › Held › Moving › Answered, each step with a tiny chord glyph. The dock shows the last chord and its word (unresolved, on its way, resolved).
*Sources.* Western harmonic cadence (the sus4 resolution, the perfect cadence); combined V3's rule that acknowledge, act and resolve are three separate verbs.
*What works.* It is the only variant where you can *hear* that acknowledging is not resolving: something is still unfinished in the ear. When the resolution comes, it feels like closure, and that makes the sound pleasant rather than alarming. It fits "the past is silent": once answered, nothing more. Of the six it is the most distinctive and the closest to AUGUR's calm water language.
*What fails or risks.* It relies on Western tonal expectations. People who don't hear the "pull" of a sus4 get three pleasant chords and no meaning; the cadence line has to carry it. The answer arrives minutes later, out of context, so it needs its caption. The question still repeats (V1's conflict). Chords in 523–1177 Hz overlap speech.
*After lunch.* Yes. It is the most pleasant to live with, and the answer is a small reward.
*Screen reader clash.* Medium. The arpeggios sit in the speech formant band, so they should be scheduled into speech gaps.
*Principles.* All four kept. The cadence line adds to explain-never-hide, because it shows the state of the three verbs at once. Calm: the repeat is the only conflict.
*Needs.* `--sound-chord-question|moving|answer`, plus a cadence state on the notice record (question, held, moving, answered), which maps one-to-one to the existing ack, act and resolve.
*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit 5

---

## Ranked
1. **V1 Caution and warning**: the vocabulary to build first; the lit lamp as the acknowledge button.
2. **V6 Suspended cadence**: the most AUGUR-like; harmony for acknowledge ≠ act ≠ resolve.
3. **V5 Live pulse**: keep **L (listen)** and the crossing earcon; drop the always-on pulse.
4. **V3 Lens ladder**: the floor register and note-per-level rule belong in the grammar sheet.
5. **V2 Room tone drop**: keep only the gesture (duck everything for a beat before the Letterbox), not the bed.
6. **V4 Closing bars**: keep the frame-close glide as *the* Letterbox sound; drop stereo placement.

## What I'd build first
V1's four-sound vocabulary, with V6's harmony as its timbre. Notice is the root; needs you is a single chime (root plus fourth); urgent is the suspended chord repeating every `--motion-still` until the lit lamp is pressed (it stops at once). Acting plays the dominant once, and resolution plays the answer. Pitch everything at V3's floor register, and use V4's glide for the moment the bars land, once per arrival and never on reopen. Add V5's **L** as an always-available "listen to this chart" for any notice with a series. That is about six sounds, one repeat rule and one on-demand sonification. Before any of it ships, two decisions: does the urgent repeat back off after about 30 s, and does it duck under screen reader speech?

## Proposed `--sound-*` tokens (from the `SOUND` objects)
| Token | Value | Notes |
|---|---|---|
| `--sound-gain-ceiling` | 0.16 (linear) | the loudest anything gets |
| `--sound-gain-floor` | 0.6 | quietest = 60% of the ceiling (~4 dB band) |
| `--sound-pitch-min` / `-max` | 150 Hz / 5 kHz | Brewster |
| `--sound-floor-you|team|department|org` | 220 / 294 / 392 / 523 Hz | the register rises towards Org |
| `--sound-note-min` | 80 ms | = `--motion-instant` |
| `--sound-note-base` | 120 ms | |
| `--sound-note-last` | ×1.5 | lengthen the last |
| `--sound-accent-rest` | 0.8 | notes after the accented first |
| `--sound-rate-max` | 6 notes/s | |
| `--sound-gap-compound` | 100 ms | |
| `--sound-attack` / `-sustain` / `-release` | 8 ms / 0.5 / 240 ms | release = `--motion-base` |
| `--sound-cut` | 20 ms | acknowledge stops at once |
| `--sound-repeat-every` | `--motion-still` | urgent repeat |
| `--sound-timbre-soft|glass|bell` | partial lists | |
| V1: `--sound-advisory`, `--sound-caution`, `--sound-warning`, `--sound-cleared`, `--sound-confirm` | | |
| V2: `--sound-room-gain` 0.3, `-cutoff` 380 Hz, `-hum` 165 Hz, `-drop` `--motion-calm`, `-hold` `--motion-run`, `-return` `--motion-run`; `--sound-arrival` | | |
| V3: `--sound-ladder-notice|needs|urgent|resolve` (ratios) | | |
| V4: `--sound-pan-width` 0.8, `--sound-frame-close|open|repeat` | | |
| V5: `--sound-value-low` 262 Hz, `--sound-value-high` 1047 Hz, `--sound-pulse`, `--sound-listen` (12 points) | | |
| V6: `--sound-chord-question|moving|answer` (ratios) | | |
| Setting: **reduced sound** | boolean | separate from reduced motion |

Also relied on: `--font-mono` (needs an ADR, as in combined V3) and the combined V3 proposed tokens (`--focus-far-*` and the rest), unchanged.

## Answers this surface gives the shortlist
- **ADR?** Yes, but only for: urgent (repeat until acknowledged, stop at once), resolution, and on-demand sonification (L). Notice and needs you can stay silent by default.
- **Screen readers.** On-demand sound (L) helps. Repeats clash, so schedule them into speech gaps or duck them. The caption strip is deliberately not a live region, so it never talks over the screen reader; the events it describes are already announced by the polite live region or the alertdialog.
- **Open plan or shared screen.** Per-kind volume is not enough. A "meeting" preset should turn everything except urgent to zero and play urgent once (V1's reduced sound). The visual lamp and cadence line carry the rest.
