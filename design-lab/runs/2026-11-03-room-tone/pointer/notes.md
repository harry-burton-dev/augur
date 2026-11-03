# Surface 4: radial menu and pointer feedback

Six variants on the radial menu from `2026-11-02-cinematic/combined/v2-artifacts-in-focus.html`
(fixed compass directions, Publish target ring, hatched locked wedges with reason and who,
hold to confirm Delete, consequence readout). The screen is simplified to the menu so the sound
is the subject. Every page opens with sound **off**. A dashed "Click to enable sound" button (or `S`)
starts audio. The caption strip still writes out every sound it would have played, under the
heading "Heard · what you would hear", so the screenshot reads with no sound at all.

Shared across all six (from `_src/engine.js`):
- **Brewster is enforced in the engine, not trusted to callers.** Pitch is clamped to 150 Hz to
  5 kHz, every note lasts at least 80 ms, gain is clamped to a band where the quietest sound is
  60 % of the loudest, and there is a rolling cap of 6 notes a second. Detent-type sounds over
  the cap are dropped and merged ("3 detents merged"), never queued.
- **Every sound has a visible twin.** A caption row with a mini score (dots for notes, height for
  pitch, a dash for a tick), plus a sign on the menu: the detent mark lights, the hold ring or
  segments fill, the locked wedge is hatched and gives its reason, and the readout shows the score
  of what you heard.
- **Controls:** mute (`M`), a volume per category with four detents (0 means off), a separate
  reduced-sound toggle (each variant says what it drops), and a "day load" line that shows
  sounds in this menu and sounds per day, using a typical-menu model (`DATA.day.model`: one direction,
  10 % push out to a floor, 2 % try something locked, 1 % delete, 300 menus a day). The demo
  tours everything, so its own count would overstate the day.
- Unused categories stay visible, marked Off, with the reason (explain, never hide).
- All demos start after `--motion-run` and replay with `R`. Keyboard: right-click or Shift+F10 on a row opens the menu,
  `←` `→` turn, `↑` pushes out to the floor ring, Enter picks, hold Enter on Delete, `Esc` closes.
- No AudioContext exists until a click or key press, so nothing warns or throws before a gesture.
  Tested headless: demo, enable, the sound path with a running context, and the keyboard path all run with zero console errors.

Sources live in `_src/` (shared CSS, engine, data, one file per variant). Run `python3 _src/build.py`
to regenerate the six pages. `_kit/build.py` skips `_` folders.

---

## V1: Rotary detents (`v1-detents.html`)
*Idea.* The menu behaves like a Braun rotary selector. You hear a soft tick as you cross each
direction, a deeper "home" detent at Open (12 o'clock), and a stiffer, lower detent at Delete. A
locked direction has **no detent**: the knob slides through it (dead travel, and its boundary mark
is dashed). Choosing it gives a felt **end stop**, a low muffled 180 Hz thump, not a buzz. The
floor ring has higher detents because it sits "further out". A fast full turn shows the rate cap
merging ticks instead of machine-gunning them.
*Sources.* Braun rotary selectors (home and stiff detents), camera mode dials, Brewster (rate,
note length, loudness band).
*What works.* It is the most physical idea: the menu feels like hardware. Dead travel is an
"unavailable" signal that is literally an absence, so it can never sound like an error. The end
stop is calm and clear.
*What fails or risks.* About 660 ticks a day. Each one is quiet, but the count is the problem.
Ticks carry almost no information that the eye does not already have. A lot of tuning goes into
something people will turn off.
*After lunch.* Borderline. I would keep the end stop and the hold, and turn the ticks down to 1 or off.
*Screen reader clash.* Low. Ticks are 80 ms transients well clear of the speech band's centre, but
they land on the same keypress that starts the screen reader saying the verb, so they add clutter.
*Principles.* Calm: passes, provided ticks are opt-in. Explain-never-hide: the end stop pairs with
the hatched wedge and its reason. No letterbox or focus-stacking conflict.
*Needs.* `--sound-detent-*`, `--sound-detent-home-*`, `--sound-detent-stiff-*`, `--sound-detent-outer-*`, `--sound-endstop-*`.
*Score.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4 = **15**

## V2: Compass scale (`v2-compass.html`)
*Idea.* Each direction has its own note, climbing clockwise from Open up a major pentatonic scale
(G A B D E G A B), so Publish always sounds like Publish and you can learn the menu by ear.
Delete adds a sub-octave for weight. A locked direction plays its note **behind glass**
(low-passed and at the band's floor): it is still there but muffled. Publish targets play their floor
register. In reduced sound you only hear the note you land on, after you rest.
*Sources.* Camera mode dials (positions you learn by feel), hierarchical earcons, Brewster.
*What works.* It carries the most direction information of the six, which helps blind users and
anyone learning the menu. The pentatonic scale keeps any sweep consonant. "Behind glass" is a lovely
unavailable sound: it says "this exists but you can't reach it".
*What fails or risks.* It is melodic, so after a few hundred menus it becomes a tune that loops all day:
a xylophone. Pitch also competes with Department/Team register mapping elsewhere in the run, so
two pitch meanings collide.
*After lunch.* No for most people. Possibly yes for screen reader users who opt in.
*Screen reader clash.* High. Tonal notes overlap the speech that names the verb, and pitched
speech plus pitched notes muddles both.
*Principles.* Breaks "dark when normal": a normal sweep makes music. Explain-never-hide is good (behind glass).
*Needs.* `--sound-compass-root`, `--sound-compass-steps`, `--sound-unavailable-lowpass`, `--sound-danger-weight`.
*Score.* Clarity 3 · Distinctiveness 4 · Feasibility 4 · Fit 2 = **13**

## V3: Switch profiles (`v3-switches.html`)
*Idea.* The menu's feel is a personal setting, like choosing keyboard switches. **Linear** (a muted
thock, almost nothing), **Tactile** (a soft bump) or **Clicky** (a crisp click). Each profile is a
token set with its own detent, its own "bottom out" for locked directions (the press lands but
nothing actuates: no click), and its own hold, which is a smooth rise in Linear and Tactile and
stepped clicks in Clicky. Picking a profile auditions it with three ticks. The demo moves from
Tactile to Clicky to Linear.
*Sources.* Keyboard switch sound profiles (linear, tactile, clicky), Braun, Brewster.
*What works.* It turns annoyance into a choice people already understand. Profiles map neatly to
swappable `--sound-profile-*` token sets, as themes do for colour. "Bottoms out" is the best physical
metaphor for unavailable in the run.
*What fails or risks.* It is a settings surface, not a design: it pushes the decision onto the user.
Three timbres triple the tuning and QA. Clicky will be chosen and then regretted in open-plan offices.
*After lunch.* Yes in Linear. No in Clicky.
*Screen reader clash.* Low (Linear) to medium (Clicky).
*Principles.* Calm, provided the default is Linear or off. No other conflicts.
*Needs.* `--sound-profile-{linear,tactile,clicky}-{tick,stop,hold,done}`, `--sound-audition`, and a profile setting in Settings.
*Score.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 3 = **13**

## V4: Self-timer ladder (`v4-ladder.html`)
*Idea.* Hold Delete and six steps climb, one per lit segment of a six-part ring (a camera's
self-timer). The first step is accented and the landing an octave up is lengthened (Brewster). The ladder
**starts on the floor register of who can see the thing**: 196 Hz for something only you can see,
392 Hz for something the Org can see, so a wider audience sounds higher before you confirm. Let go and it
**stops dead, in silence**: cancelling never costs a sound, and the readout says "Released at step 3
of 6. Nothing deleted." Pressing a locked direction plays two **flat** notes, a ladder with no rungs.
Detents are a quiet tick at the band's floor.
*Sources.* Camera self-timer, hierarchical earcons (floor register), avionics (stops the moment you let go).
*What works.* Steps you can count are clearer than a glide: you know how far you are and the ring
shows the same thing. It is rare (about 1 % of menus), so it can afford to be satisfying. The
register gives the danger a scale that you hear.
*What fails or risks.* The register difference between floors is subtle unless you hear two in a row.
In the current visual the sixth segment lights at step 6 (5/6 of the hold), so the ring looks full
just before it confirms. A lit final segment that waits for the landing would be more honest.
*After lunch.* Yes. You hear it only when you delete.
*Screen reader clash.* Low. Holding is a moment with no speech. Announce "Deleted" after the landing note, not over it.
*Principles.* Conflicts slightly with combined V2's continuous hold arc: I propose segments instead.
Calm: passes. Explain-never-hide: the flat notes pair with the hatched wedge and its reason.
*Needs.* `--sound-ladder-steps`, `--sound-ladder-land`, `--sound-flat`, `--sound-floor-*`, `--radial-hold-segments` (6).
*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4 = **17**

## V5: Heard consequence (`v5-consequence.html`)
*Idea.* There are no detents. Sound plays only when you **rest** on a choice (`--radial-dwell`), and
then it plays the consequence. On the Publish floor ring, the **register says who** (You low, Org high)
and the **number of notes says how many** (1 / up to 10 / up to 100 / more = 1 to 4 notes, so
8 people = 2 notes and 42 = 3). The Org target is locked, so it plays the Org note behind glass and
then steps down to Department: "as far as you can publish". On Delete, low plucks say what breaks
(2 links, then a 0.1 s gap, 1 citation). A locked direction plays a falling major second. Plain verbs
(Open, Share, Rename, History) are **silent**, and the readout says so.
*Sources.* Apple Audio Graphs (data as pitch and count), hierarchical earcons, Brewster's compound
gap, `time-is-matter` (the past is silent: History makes no sound).
*What works.* Every sound carries information that is new to the ear. It is the only variant where
sound helps you decide, not just confirms. About 60 sounds a day. The readout's score makes the
mapping learnable by eye.
*What fails or risks.* Resting to read the readout triggers sound you did not ask for. A "who and
how many" grammar has to be learnt, and four buckets are coarse (42 and 99 sound the same). This is
the most work in the React kit, because the consequence data has to reach the sound layer.
*After lunch.* Yes.
*Screen reader clash.* Medium. The dwell sound lands as the screen reader starts reading the
readout. Either play the score after speech or offer it on a key (as telemetry does) for screen reader users.
*Principles.* Strong fit with consequence preview and dark when normal. Explain-never-hide: the
locked floor is heard and also explained.
*Needs.* `--sound-count-buckets`, `--sound-preview-note`, `--sound-breaks-*`, `--sound-door`, `--sound-floor-*`.
Data: link and citation counts at menu time (the shell has the visible ones only).
*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4 = **16**

## V6: Quiet hand (`v6-budget.html`)
*Idea.* No ticks at all. Only three things sound: a **closed door** (a soft falling pair, once per
menu per locked thing), a low **edge** note as you reach Delete, and the hold. The edge note
**retires once you have learnt it**: three times in the demo, about 20 a week proposed. After that it
shows "learnt · silent" in the caption strip, while the red wedge stays. The closed door never
retires because it carries a reason. A budget panel compares all six variants per day (V1 660 …
V5 60, V6 30).
*Sources.* Dark cockpit (silent when normal), avionics (a small fixed vocabulary), calm technology.
*What works.* It is the honest default: the menu is silent unless something is in your way or
about to be destroyed. Habituation-aware sound is a genuinely new rule: a sound has to earn its place
and can retire. The budget makes fatigue a number Harry can argue with.
*What fails or risks.* It may be too little to justify building a sound system for the pointer. A
sound that retires behaves differently for different people, which complicates support ("I don't hear it").
*After lunch.* Yes, and you would forget it is on.
*Screen reader clash.* Lowest. Three rare sounds, none on routine navigation.
*Principles.* Best fit with dark when normal and calm. Explain-never-hide: retiring is shown, not hidden.
*Needs.* `--sound-edge`, `--sound-door`, `--sound-learn-after`, and per-user learning state (the shell has none).
*Score.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 5 = **17**

---

## Proposed tokens (union)
| Token | Value here | Note |
|---|---|---|
| `--sound-gain-ceiling` | 0.18–0.2 | master gain. Loudness is the main annoyance, so it is the first knob |
| `--sound-gain-floor` | 0.6 | the quietest sound as a fraction of the loudest (narrow band) |
| `--sound-limiter` | −18 dB, 4:1 | safety ceiling only |
| `--sound-attack` / `--sound-release` | 3–8 ms / 50–60 ms | |
| `--sound-note-min` | 80 ms | Brewster |
| `--sound-rate-max` | 6 / s | Brewster. Detents over the cap are merged |
| `--sound-gap-compound` | 100 ms | Brewster |
| `--sound-pitch-min` / `-max` | 150 Hz / 5 kHz | Brewster |
| `--sound-floor-{you,team,department,org}` | 196 / 247 / 294 / 392 Hz | register rises towards Org (shared with floors surface) |
| `--sound-detent-*`, `-home-*`, `-stiff-*`, `-outer-*` | band / body Hz | V1, V3 |
| `--sound-endstop`, `--sound-door`, `--sound-flat`, `--sound-unavailable-lowpass` | | four candidate "unavailable" sounds |
| `--sound-hold-from` / `-to`, `--sound-ladder-steps` / `-land`, `--sound-confirm-last` (240 ms) | | hold and confirm |
| `--sound-count-buckets`, `--sound-breaks-*` | 1 / 10 / 100, max 4 | V5 |
| `--sound-profile-{linear,tactile,clicky}-*` | | V3 |
| `--sound-learn-after` | 20 a week | V6 |
| `--sound-sign-linger` | `--motion-calm` | how long the visual twin stays lit |
| `--sound-cat-{detent,hold,unavailable,preview}-ink` | existing colours | caption colours |
| `--radial-hold-segments` | 6 | V4 |
Settings: sound on/off, per-category volume, **reduced sound** (separate from reduced motion), and the switch profile (V3).

## Which "unavailable" sound?
There are four candidates, none of them a buzz. **Dead travel and end stop** (V1) is the most honest but needs the detents
around it to work. **Behind glass** (V2) is the most expressive. **Flat** (V4) is clear but close to a "wrong" sound.
**Closed door**, a soft falling major second (V5, V6), works without any other sounds. I recommend the closed door,
because it stands alone in a quiet menu.

## Ranked
1. **V6 Quiet hand**: the default. Silence for routine use, the closed door, and the edge that retires.
2. **V4 Self-timer ladder**: the hold-to-confirm sound for every danger action.
3. **V5 Heard consequence**: for the Publish and Share floor ring only, on dwell. The strongest new idea.
4. **V1 Rotary detents**: as an opt-in "Detents" category, off by default.
5. **V3 Switch profiles**: as the *shape* of the opt-in setting (Linear and Tactile only, no Clicky).
6. **V2 Compass scale**: keep "behind glass" and the idea of an accessibility mode. Drop the melodic default.

## What I'd build first
Build V6's rules as the menu's sound contract: silent by default, the closed door on locked
directions, and V4's six-step ladder on any hold-to-confirm, with the register taken from the
floor of who can see the thing. Then add V5's who-and-how-many score to the floor ring only, behind
the Consequence category, so publishing to 1,180 people sounds different from publishing to 8
before you commit. That is about 30 to 60 sounds a day, each one carrying something the eye might
miss. Detents (V1, in V3's Linear or Tactile profile) stay an opt-in for people who like the feel.
This goes beyond the brief: sound turns out to be worth it mostly for consequences and refusals, not
for pointer feedback. I would say that in the ADR and keep pointer ticks out of the default.

## Where it pushes back
- Harry's ask names "detent ticks per direction" as a default idea. After counting the day load (660 a day), I recommend against ticks by default.
- The combined V2 continuous hold arc should become six segments, so the steps you see match the steps you hear.
