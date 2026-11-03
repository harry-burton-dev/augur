---
batch: 1
kind: steered
concepts: [periphery-channel, dark-when-normal, time-is-matter]
---

# Prompt B: Room tone. Sound as a calm second channel.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/2026-11-03-room-tone/prompt.md`.

---

Spend this run exploring how AUGUR could use **sound** the way a cockpit, a
film's sound design or a well-made instrument does: almost silent when
things are normal, unmistakable when something needs you, and carrying real
information (which floor, how urgent, how much) rather than decoration.
Most software uses sound as a "ding" or not at all. Find out whether a
small, generated sound language could make AUGUR calmer and faster to read,
and where it would only annoy. Work in `design-lab/runs/2026-11-03-room-tone/`.

## Harry's direction for this run
- **Every sound pairs with a visible sign.** Sound never carries anything
  the screen doesn't also show (explain, never hide; muted rooms; deaf and
  hard-of-hearing people).
- **Off by default, one switch to turn on, per-category volume.** Each
  prototype shows the switch and says what you'd hear.
- **Dark cockpit for the ear:** silence when normal. Only abnormal things
  sound, and the louder signals are rare.
- **Generated, not recorded:** every sound is synthesised with the Web
  Audio API from parameters, so it can be tokenised like colour (no audio
  files, no network).
- Calm over a whole working day. Test each idea against "would I still
  keep this on after lunch?"

## References and what to take from each
- **Brewster, Wright and Edwards, earcon guidelines** (Glasgow): families by
  timbre, register and spatial position; rhythm for sub-groups; pitch
  between about 150 Hz and 5 kHz; notes no shorter than ~80 ms; no more
  than ~6 notes per second; accent the first note, lengthen the last; a
  0.1 s gap between compound earcons; keep loudness in a narrow band
  (loudness is the main cause of annoyance); attention through rhythm and
  pitch change, not volume. Take: these as the hard numbers for tokens.
- **Hierarchical earcons**: children inherit their parent's sound and
  modify it. Take: floors as a hierarchy (You, Team, Department, Org) that
  you can hear, for example register rising towards Org.
- **Avionics aural alerts**: master caution chime vs master warning, a
  small fixed vocabulary, voice only for the most critical, alerts that
  repeat until acknowledged and stop the moment they are. Take: three or
  four levels, never more, mapped to the AUGUR notice levels.
- **Film sound design** (Walter Murch on "worldizing" and room tone; the
  convention that silence before an event raises tension). Take: a near-
  inaudible room tone that drops out when something urgent arrives, so the
  silence itself is the cue; the Letterbox opening as a sound moment.
- **Calm technology** (Weiser and Brown; Amber Case): information that
  lives in the periphery, like the Dangling String that twitched with
  network traffic. Take: ambient sound for background activity (a sync, an
  upgrade running) that you notice only when it stops or changes.
- **Sonification and Apple Audio Graphs** (WWDC 2021): data series played
  as pitch over time, used for accessible charts. Take: hear a sparkline,
  hear a limit being crossed.
- **Physical controls**: detents of a Braun rotary selector, the click of a
  camera dial, keyboard switch sound profiles. Take: tiny tactile ticks for
  the radial menu directions and floor travel steps.

## Surfaces (6 variants each, each with its sound described in the caption)
1. **Sound language sheet** (the grammar): families, levels, the hierarchy,
   the tokens (`--sound-*` proposed: base pitch per floor, envelope times,
   gain ceiling), and a test bench page to audition each one.
2. **Urgent path and Letterbox**: the sound of escalation, acknowledgement
   (stops at once) and resolution, using the combined/v3 screen.
3. **Floor travel**: hear which floor you are on and arriving at; a ping
   on arrival that says "something waits here" only when it does.
4. **Radial menu and pointer feedback**: detent ticks per direction,
   hold-to-confirm Delete with a rising tone, an "unavailable" sound that is
   not an error buzz.
5. **Ambient activity**: background work (sync, upgrade, import) as room
   tone or a quiet pulse; what you hear when it stops, fails or finishes.
6. **Sonified telemetry**: the sparkline sentence ribbon and limit lines
   as sound, on demand (press a key to listen), for accessibility and for
   glancing away from the screen.

Round 2: combine into 3-4 screens. One must be "a full day compressed into
two minutes": a scripted run of typical events at their real frequency, so
Harry can judge annoyance honestly.

## Prototype rules for sound
- Audio only starts after a click or key press (browser autoplay rules);
  each page shows a clear "Click to enable sound" state first and says so
  in the caption. The screenshot state must still read without sound.
- A visible mute, a per-category volume and a live caption strip that
  writes out each sound as it plays ("Team floor · arrival · 2 waiting").
- All parameters from one `SOUND` object at the top of the script, mapped
  to proposed `--sound-*` tokens; no magic numbers in the code.
- Reduced motion does not mean no sound; respect a separate reduced-sound
  preference in the prototype and propose it as a setting.

## Questions the shortlist must answer
- Is sound worth an ADR at all, and for which signals only?
- Which sounds help screen reader users, and which would clash with a
  screen reader's own speech?
- What does an open-plan office or a shared screen in a meeting need?

## Carry from earlier runs
Read `design-lab/concepts/README.md`. In particular:
- `time-is-matter` (wear and time run): history never glows; the sound version is that the past is silent. Only what needs you makes a sound.
- `the-record-has-edges`: a sync or source going silent is a state worth hearing when it changes.
