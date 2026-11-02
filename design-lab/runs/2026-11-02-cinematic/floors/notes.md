# Floors: floor picker and floor travel, six explorations

Surface: the floor mark at the top left of the shell, the picker it opens, the
move between floors, and the area title card that plays on arrival. Every page
uses the same mock shell (Artifacts home, dimmed) and the same sample data:
seven floors (You, three teams, two departments, the org). One team is **left**
("You left on 14 Oct · Priya Nair can add you back") and one department is
**locked** ("Locked while Upgrade 2.4 runs, until 22:00 · Sam Ortiz (Admin) can
unlock it early"). Names, counts, copy and the demo script all live in one
`DATA` object at the top of the script.

Each page auto-plays after about 1.2s: it opens the picker, selects the locked
floor (you see the explanation), tries to go there and is refused, then
selects Platform Team and travels. The arrival card plays in the 2.39:1
letterbox. `R` replays. Keyboard: `F` opens, `↑↓`/`PgUp PgDn` choose, `Enter`
travels, `Esc` closes. With the picker closed, `PgUp`/`PgDn` jumps to the next
floor you can reach. V4 also turns with `←→` and the mouse wheel. V6 has `M`
(mix into Home).

Files: `v1-altitude-tape.html` … `v6-patch.html` are generated. Edit
`_src/*.src` plus the shared `_src/common.{css,js}` and `_src/shell.html`, then
run `python3 _src/make.py`. `_src/shots.js` takes timed screenshots and can press
keys (`node shots.js page.html out 1600 900 "f@300,ArrowUp@700,2400"`); set
`RM=1` to emulate reduced motion.

Checked at 1600×900 and 1280×800, mid-animation, with the keyboard path
(including refusal) and with reduced motion. No console errors.

---

## V1: Altitude tape
*Idea.* The floor mark is an altitude window box: `FL 01 · TEAM · Platform
Team`, plus a traffic readout of what waits above and below (`▲ ◆◆ 2`,
`▼ ◆ 1`, diamonds in each floor's colour). Opening it unrolls a primary-flight-
display tape. Floors are flight levels 96px apart (`--travel-floor`), level
bands run down the left edge, waiting work shows as traffic diamonds, and the
selected floor gets a "bug" and a trend vector. When the waiting floors are off
the tape you see off-scale markers. Travel scrolls the tape on `--ease-spring`
(it overshoots a little, like inertia), and the drum digits and names roll.
On arrival the window box flashes ALT CAP. The arrival card is a flight-mode
annunciator: the top bar holds boxed mode cells (boxed for 2.4s, then plain, as
in a real FMA), the title wipes in, and the bottom bar runs a tape of the
waiting items.

*Sources.* Glass cockpit PFD (altitude tape, selected-altitude bug, trend
vector, off-scale traffic, FMA boxing), Territory Studio telemetry strips,
Bloomberg tick tape.

*What works.*
- The resting control is the best of the six: one glance tells you where you
  are and that things wait above you, without opening anything.
- It scales. Ten or twenty floors are still one scrolling tape.
- Off-scale markers obey "explain, never hide" for work you can't see.
- Locked floors use the speed-tape "barber pole", which pilots already read as
  "not here".
- The FMA boxing is a truthful way to say "this just changed".

*What fails or risks.*
- `FL 00…06` is an index, not data. It changes when you join a team, so people
  will learn numbers that aren't stable. Show level labels instead, or number
  floors per level.
- The PFD rule that the window stays on the current floor means a selection can
  sit off-scale (seen on the keyboard path: selecting Operations from You). The
  header still names it, but the bug isn't visible. The tape should pan towards
  the selection.
- Dense mono caps get tiring. The tape panel is tall and narrow, so it covers
  the rail.
- The parallax push of the screen during travel can cause motion sickness if
  it is any bigger than now.

*Principles.* Letterbox: the FMA strip and tick tape turn the bars into
information instead of decoration. Focus: the shell racks out (blur,
desaturate, 0.995) when the tape opens. Explain: hatched band plus the reason
in the selected-floor header, and the "Can't go there" refusal shake.

*Needs.* `--font-mono` as a token. A "traffic above/below" count per floor
(the shell knows only the current floor today). A stable floor ordering from the
directory.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 3.

## V2: Lift (split-flap indicator, car panel, doors)
*Idea.* The mark is a split-flap indicator with up/down lamps and a hall-call
lamp that counts work waiting on other floors. It opens a lift car operating
panel: round buttons grouped by level, Org at the top, with a call lamp per
floor. The locked floor's button shows a key ("key required"). The left team
shows a person-minus button and the reason inline. Pressing a floor lights its
button, the doors close over the screen, and the large indicator flaps through
each floor you pass. Then a ding ring plays, the doors open on the new floor,
and the flaps settle as the letterboxed title.

*Sources.* Hotel lifts (car panel, hall lantern, ding), Solari split-flap
boards, Make It So ("confirmation through motion").

*What works.*
- The car panel is the most legible and most accessible picker of the six. It
  is a grouped list of real buttons in a familiar order, with lamps, so it
  would survive a screen reader and many floors.
- The hall-call lamp is a lovely, honest signal of what waits elsewhere.
- The arrival title is the most charming of the six.

*What fails or risks.*
- Travel takes too long: about 2.5–3s with doors and flaps, and longer for far
  floors (one flap cycle per floor passed). People who switch floors many
  times a day will hate it. Doors should be first-visit only, or skippable.
- Doors are a full-screen opaque wipe, the "abrupt black scrim" Harry wants to
  avoid, just in brushed metal.
- Split-flap cells are fixed width (the longest name), so the resting mark
  grows with data. Long names need truncation plus a tooltip.
- The cycling letters are unreadable mid-flip. That is fine as motion but noisy
  for a screen reader (live region announces only the result).

*Principles.* Letterbox: the hall lantern card. Focus: weak, because doors hide
instead of defocusing. Explain: strong, inline why/who under the selected
button.

*Needs.* Nothing new beyond the mono token. A "doors" pattern would need a
first-visit flag per floor.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 2.

## V3: Sonar
*Idea.* Floors are rings of reach. You are the centre, teams are the first
ring, departments the second, the org the outer ring, so the further out, the
more people see it. Each floor is an arc of its ring, and waiting items are
returns that brighten as the sweep passes and then decay. A locked floor is a
hatched "shadow zone". A team you left is a dotted "contact lost". The mark is a
48px scope with a slow sweep. Travel is a ping: a ring runs out to the
contact, then a wavefront expands from the mark across the whole screen and
reveals the new floor behind it (clip-path circle on a clone of the shell
plane). The arrival card is a contact report with an echo of the title that
drifts and fades.

*Sources.* Naval PPI sonar and radar (sweep, phosphor decay, bearing, shadow
zones), Make It So (glow for attention), Territory Studio.

*What works.*
- The geometry carries meaning. Radius = audience is the best mapping of
  "floor" in the set.
- The ping reveal is the best travel moment. It starts at the control you
  pressed, keeps the layout in place, takes 1.2s, and is cheap (clip-path, no
  blur).
- "Shadow zone" and "contact lost" are evocative ways to explain
  unavailability.

*What fails or risks.*
- Polar layouts don't scale. With more than four teams the arcs get thin and
  labels collide (they already did at 7 floors until offsets were tuned by
  hand).
- Bearings (`BRG 082`) are decoration, which Tufte would call non-data ink.
- The sweep is a perpetual loop in the band, which goes against the dark
  cockpit. It should stop when nothing waits.
- Reading order in a circle is ambiguous for keyboard users: ↑↓ follows level
  order, not angle.
- My first reveal used a radial-gradient mask on the full plane and ran at 2
  frames in headless Chromium. Masks on large DOMs are a real cost. Clip-path
  fixed it.

*Principles.* Letterbox: the contact report. Focus: the wavefront is a literal
focus pull across the screen. Explain: shadow zone with why/who in the readout.

*Needs.* Audience size per floor (the mapping uses it). A ping/wavefront
component in the shell for any "you moved" moment.

*Scores.* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 4.

## V4: Rotary selector
*Idea.* The mark is a small detented knob with one dot per floor in its colour,
the lit dot marking where you are. It opens a Braun-like device face. A large
knob turns with detents on `--ease-spring` (arrows, ←→, wheel). The locked floor
has a stop pin, and turning onto it reads the explanation, but Go is disabled
and Enter kicks the knob back. A radio band scale with a needle repeats the
position, and spec cells give Seen by, Needs you and Level. Travel is "tuning
in": film grain rises over the defocused shell, a band of floor names slides
under a fixed needle, signal bars fill, and the picture clears. The arrival card
is Rams-plain: sentence-case name in Jost 200 with three spec cells.

*Sources.* Braun / Dieter Rams (rotary selector, discrete push buttons, one
accent), Braun radio dial scales, Make It So.

*What works.*
- The detent plus kick-back is the most physical refusal of the six, and the
  disabled Go key explains itself through `title`.
- The arrival card is the calmest and most "AUGUR". It is also the only one
  that isn't uppercase-tracked, which reads better for long names.
- Wheel-to-turn is a fast expert path.

*What fails or risks.*
- A knob is a poor control for a variable list. With 7 positions over 270° the
  labels crowd, and at 12 floors it breaks.
- The knob and the band scale show the same thing twice.
- Grain is decorative noise (a Make It So failure) and washed the screen grey
  until I halved it to `--breathe / 2`.
- Rotation with a pointer needs drag handling that I didn't build (click on
  labels instead).

*Principles.* Letterbox: the tuning band and title. Focus: tuning is a focus
metaphor (signal clarity). Explain: stop pin, disabled key, inline why/who.

*Needs.* A grain token (opacity/frequency), if grain survives at all.

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 3.

## V5: Rack focus
*Idea.* Floors are tilted glass planes stacked in depth. The open picker is the
stack. The focal plane is sharp, and every other plane blurs by
`--x-dof-step × distance`, desaturates and dims. Moving the selection racks
focus. A focus-ring scale on the left with a witness mark names each plane. An
unavailable plane is frosted and hatched, and when you focus it the lens
**hunts**, breathing in and out without resolving, while the explanation beside
it stays sharp. Travel racks focus through every plane between here and there,
so the planes you pass come sharp and go soft. The target plane then comes
forward, un-tilts and becomes the screen. The arrival title resolves out of blur
(blur 16px → 0, scale 1.04 → 1). The letterbox bars carry camera-assistant
marks: the focus mark, planes passed, and a follow-focus tape whose witness
slides from the old floor to the new.

*Sources.* Cinematography (rack focus, focus puller marks, follow-focus tape),
Harry's own depth and focus principle, Territory Studio, Make It So.

*What works.*
- This is the most faithful expression of principle 2. Depth is the
  navigation, and focus is the selection.
- "Lens hunts and can't resolve" is the most original explain-never-hide device
  in the set. It shows that you can't go there before you read why.
- The resolving title is the most cinematic arrival, and it reuses the same
  attenuation tokens as the rest of the shell.

*What fails or risks.*
- Cost. N planes, each with its own `filter: blur()` and a 3D transform,
  animate every frame during travel. That is fine for 7 and bad for 30, so it
  needs virtualising (draw ±3 planes).
- Tilted sheets are thumbnails you can't read. The sharp side labels carry the
  meaning, so the planes are mostly atmosphere.
- The dolly is the biggest motion in the set, a vestibular risk. Reduced motion
  crossfades instead.
- The picker is big (about 900px wide) for a frequent action.

*Principles.* All three, strongly. Letterbox with marks; focus stacking as the
mechanism itself; explain via hunting focus plus sharp why/who.

*Needs.* Tokens for `--x-dof-step` (blur per plane) and `--x-plane-tilt`. A
shared defocus token set (see gaps).

*Scores.* Clarity 3 · Distinctiveness 5 · Feasibility 2 · Fit 5.

## V6: Patch bay
*Idea.* Floors are modules in a rack, all the same height. Each has a level
strip, name, audience, an LED ladder of waiting items, a small **MIX** jack and
a big **VIEW** jack. Home is the first module. One thick cable patches Home's
VIEW into the floor you're on, so travel is re-patching. Thin cables from
Home's MIX IN show which floors also feed your Home (`M` toggles). This goes
beyond the ask: it makes "what Home listens to" visible and editable. Locked
and left floors are blanked panels with capped jacks. Travel carries the cable
end along an arc, plugs in (the jack flashes), and a signal runs down the cable
to Home. The arrival card is a patch sheet: "Patched View → Platform Team · Home
also hears You, Engineering, Northwind", the waiting items as channels, and a
scope trace that settles in the bottom bar.

*Sources.* Eurorack (HP modules, jacks, LED ladders, patch cables, blanking
plates), Territory Studio.

*What works.*
- It is the only variant that shows the relationship between floors and Home.
  That is real, missing information. A person in three teams needs to know
  which ones reach their Home.
- Capped jacks plus blank panels are an honest "not available".
- The rest-state LED row (one LED per floor: off, mixed, viewing) is a dense,
  Tufte-ish summary.

*What fails or risks.*
- Highest cognitive load. Two kinds of connection (view and mix) are one too
  many for a floor switcher. Mixing belongs in Home's own settings.
- Cables cross jack labels and each other. That looks authentic but is
  illegible at scale.
- Horizontal modules run out of width at around 9 floors.
- The scope trace is decoration.

*Principles.* Letterbox: the patch sheet. Focus: the rack defocuses the shell.
Explain: blank panels with inline why/who.

*Needs.* Data the shell doesn't have: a per-person "floors mixed into Home"
list (`DATA.homeMix` here). An LED/meter part in the kit.

*Scores.* Clarity 2 · Distinctiveness 4 · Feasibility 2 · Fit 2.

---

## Ranking
1. **V1 Altitude tape.** The best resting control (where you are, plus what
   waits above and below) and it scales. Needs stable floor labels instead of
   FL numbers.
2. **V3 Sonar.** The best travel moment (the ping reveal from the control) and
   the truest mapping (radius = audience). Polar layout limits scale.
3. **V5 Rack focus.** The purest expression of Harry's principles and the best
   arrival title. Too costly and too big as the everyday picker.
4. **V2 Lift.** The most practical open picker (a grouped list with call
   lamps). Doors and flaps are too slow for daily travel.
5. **V4 Rotary.** Tactile, with a lovely calm arrival card. A knob is the wrong
   control for a variable list.
6. **V6 Patch bay.** It surfaces a real missing concept (which floors feed Home),
   but it is a different feature, not a floor picker.

## What I'd build first
A composite, built as four kit parts:
- **FloorMark**, the resting control: V1's window box (level, name, `▲ n / ▼ n`
  waiting traffic in floor colours), in the dark-cockpit spirit, so it is
  silent when nothing waits.
- **FloorPicker**, the open state: V2's grouped car-panel list (real buttons,
  Org on top, a call lamp per floor, inline why/who for left and locked
  floors). The shell behind it racks out with the shared attenuation tokens.
- **FloorTravel**: V3's clip-path wavefront from the mark. It is about 1.2s,
  cheap, keeps the layout in place, and becomes a crossfade under reduced
  motion.
- **AreaTitleCard**: V5's title that resolves into focus inside the 2.39:1
  letterbox, generated from the floor's data (level, name, Seen by, what needs
  you).

The tape, the stack and the patch bay stay as optional "expert" skins once the
data exists. I'd also lift V6's question ("which floors reach my Home?") into a
Home setting, not the picker.

## Kit, token and data gaps found
- **Attenuation tokens:** `--x-defocus-blur` 6px, `--x-defocus-saturate` .55,
  `--x-defocus-scale` .995, `--x-defocus-dim` .72. Every surface invents its
  own today.
- **Depth tokens:** `--x-dof-step` 2.2px and `--x-plane-tilt` 58deg (V5).
- **Mono font:** `--font-mono` (IBM Plex Mono) is used by every variant for
  numerals and eyebrows. It needs a token and an ADR.
- **Dwell vs motion:** the kit's reduced-motion rule (and a naïve
  `T()=1ms`) also shortened how long the arrival card stays up, so it vanished.
  The tokens should separate *motion* durations from *dwell* durations
  (`--motion-title` is really a dwell).
- **Small optical sizes:** 1–5px hairlines, LED sizes and SVG geometry are
  still literals. A `--led` / `--hairline-width` pair would cover most of them.
- **Hatch pattern:** a warning hatch for "locked" appears in four variants as
  ad hoc gradients. It should be a shared token or kit part.
- **Class collisions:** the shell's own `.rail`/`.row` collided with an
  exploration's classes. Kit parts should namespace.
- **Data the shell lacks:**
  - waiting counts for *every* floor, not just the current one
  - membership state "left", with date and who can re-add
  - floor locks, with until and who can unlock
  - audience size per floor
  - a stable floor order
  - (V6) the floors mixed into a person's Home
