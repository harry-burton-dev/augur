# Telemetry ribbons: critique

Six ribbons around the same dim Artifacts screen. They share one data object (services, events, upgrade,
agents, queues, presence, one locked feed) so you can compare them fairly. Each page runs the same three
beats on load: **ambient** (soft focus, about 58% presence, 0.5px blur, half saturation), then a **change**
(that ribbon or segment sharpens for `--motion-hold`), then a **limit crossed** that **hands off** to a
shared alert: a 2.39:1 letterbox (bars are `--scrim` gradients, the layout stays put, the stage racks to
blur 6px, saturate .35, scale .995). Only the ribbon that tripped stays sharp. Esc steps back and focus
returns to where it came from. R replays and Space steps through the beats.

The locked feed (Security notices, Org admins only) is always there, always looks locked, and says who can
grant access. Pages are built from `_src/*.tpl` with `node telemetry/_src/gen.js`. The build ignores `_src`.

---

## V1: Tick tape
*Idea:* A Bloomberg tape along the bottom edge. Fixed counters on the left (LIVE, EVT/h, APR, UPG bake, AGT, SEC locked). Events print into a **LAST** cell on the right and then drift left into the tape, so new items enter where your eye already is, not off-screen. Hover or focus pauses the tape with an eased stop, never a jump. Clicking an item opens an in-place peek card and racks the app slightly. When the limit is crossed, the tape stops, and the LAST cell flies up into the letterbox and becomes the first row of a `SYN <GO>` function panel, which is the tape filtered to one mnemonic.
*Sources:* Bloomberg (tape, mnemonics, `<GO>`), dark cockpit (colour only for warning and danger), Make It So (confirmation through motion).
*What works:* The LAST cell answers "what just happened?" without reading the moving part. The mnemonics are dense and learnable. The hand-off is the clearest motion story of the six because you watch the item travel. Locked items still count on the tape ("1 notice you can't open").
*What fails or risks:* Constant horizontal motion in peripheral vision is the classic distraction. Even at about 23 px/s it pulls the eye, and some people with vestibular sensitivity will want it off (reduced motion stops it). At 1280 px only one or two items are visible between the head and LAST. You can't read a moving tape for detail, so it relies on pause plus peek. Mnemonics are jargon that needs a legend.
*Principles:* Letterbox hand-off ✓. Focus pulling: the tape stops and sharpens ✓. Explain-never-hide: the SEC head cell and the locked tape item explain the lock ✓.
*Needs:* An events stream from the gateway with mnemonic, floor and app. A per-person "quiet this mnemonic" setting. Tokens for tape speed and for ambient blur and opacity.
*Cost:* One `translate3d` per frame on a single track. One DOM move when an item leaves (one layout read). The loop stops completely when the tape is paused or stopped.
*Score:* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit with calm water 2

## V2: Limit strips
*Idea:* Open MCT stacked plots in a right-hand column, one 5-minute strip per service. Each has a yellow watch band and a red limit band, the line is recoloured inside each band, "now" is the right edge, and the time axis is shared at the bottom. A feed that stops is **hatched** from its last sample, with the last value carried as a dashed line and a STALE counter. On a crossing, the other strips blur and the tripped strip stays lit. The letterbox shows the same plot at full size with WATCH and LIMIT labels and a crossing marker.
*Sources:* NASA Open MCT (limits, stale data, stacked plots), Tufte (small multiples, shared axis), dark cockpit.
*What works:* It is the most *honest* instrument. You see trend, limit and freshness at once, and the stale hatching is a strong "explain, never hide" pattern for data. Per-strip sharpening means only what changed comes into focus. The hand-off evidence is self-explanatory.
*What fails or risks:* It takes about 256 px of width permanently, which Artifacts wants. Most of the time the strips are flat lines near zero, because the scale runs to the max and not to the data. That is low data-ink. Seven canvases redraw every 3 s (cheap), but they need DPR handling and colours read from CSS. Limit bands in two colours on every strip get noisy if many services sit in watch.
*Principles:* Focus stacking per strip ✓. Navigation path (click a strip to open it in place and dim its neighbours) ✓. Explain-never-hide: stale and locked strips ✓.
*Needs:* Per-service limits in Admin (watch and act), a health time series endpoint, a staleness signal from the Updater, and an `--x-type-micro` (11px) token.
*Cost:* Canvas redraws only on a new sample, never per frame. A worker or OffscreenCanvas is possible later.
*Score:* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit with calm water 3

## V3: LED rack
*Idea:* A Eurorack row in the bottom band. Modules have honest HP widths, segmented vertical LED meters (green, then amber at watch, red at the limit) and a peak-hold bar that decays one segment at a time. Discrete LED modules show agents, approvals (amber means it waits for you), upgrade servers baked, and who is here (floor colours). The locked feed is a **blanking plate** that says why. Dark cockpit: ambient LEDs glow at half strength. When storage crosses its limit, a **patch cable** is drawn from the module's OUT jack into an IN jack on the alert, and the alert shows a 40-segment meter with watch, limit and stop marks and a projection.
*Sources:* Eurorack (HP, jacks, patch cables, blanking plates), avionics dark cockpit, Braun (discrete states, one accent per state).
*What works:* Most distinctive and most *physical*. The cable makes the hand-off legible: you can see where the signal went. The blanking plate is the nicest locked-state metaphor across all the surfaces. LEDs are glanceable at the edge of vision without reading.
*What fails or risks:* Gimmick risk is high. The cable crosses content and must be redrawn on resize. Segmented meters lose precision, which is why there is a big numeral too. Audio-style meters invite fast jitter. I limited updates to once per `--motion-run` with stepped transitions, because faster jitter is motion noise in the periphery. Green, amber and red in tiny segments are hard for colour-blind people, so position (segment height) carries the meaning and colour only repeats it. The band is 96 px, so labels have to be terse.
*Principles:* Hand-off as routing ✓. Focus pull: the tripped module stays sharp and the others blur ✓. Explain: the blank plate and tooltips ✓.
*Needs:* An HP unit token (`--x-hp`), a cable style (danger stroke and plug), and a meter component in the kit. Storage growth projection data.
*Cost:* `clip-path` on 4 small meters once per tick, plus one SVG path with a dash animation on hand-off.
*Score:* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit with calm water 3

## V4: Sparkline sentence
*Idea:* One typeset line in Jost at lead size: "events **1.2k** an hour ⌇ · **3** approvals waiting ⌇ · upgrade **0.14** baking, **2 h 10 m** left ▬ · …". Each phrase has a word-sized sparkline with Tufte's grey normal band and an end dot. **Micro to macro:** hovering a phrase raises the same series as small multiples (min, max and now dotted) with that one lit and the others dim. A change underlines the phrase. A crossing turns it red, flies the phrase up and grows it into the **headline** ("5 approvals waiting ⌇ and one is past its two-day limit"), with an age table where every bar is drawn against the 48 h limit.
*Sources:* Tufte (sparklines, micro/macro, data-ink, small multiples), FUI "type as instrument", Make It So (motion as confirmation).
*What works:* Calmest and most humane. It reads as AUGUR (Jost, words first), has no peripheral motion at all, and states things like Territory does but in sentence case. The sentence is natively accessible (a screen reader just reads it) and localisable. The hand-off reuses the same words, so nothing has to be re-learned.
*What fails or risks:* Line wrapping changes with width and content, so phrases jump lines when numbers change. Sentence grammar has to come from data per locale ("1 approval" / "3 approvals"). Sparklines this small hide outliers. Seven phrases is the limit before it becomes a paragraph. It is weak for "is it live?", because nothing moves until something changes.
*Principles:* Focus pull on the phrase, letterbox headline ✓. Navigation path in the macro panel ✓. Explain: "security notices 🔒 locked" stays in the sentence ✓.
*Needs:* Phrase templates in the manifest with ICU plurals, per-hour normal bands (baseline service), and a sparkline primitive in the kit.
*Cost:* Inline SVG, re-rendered only per changed phrase. No animation loop.
*Score:* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit with calm water 5

## V5: Edge frame
*Idea:* Territory Studio telemetry on all four edges. The top is a rule with 11 numbered segments in mnemonic caps (01 IDN 84 MS … 11 SEC 🔒 NO ACCESS). The bottom states your **coordinates** (FL Finance / APP Artifacts / AREA Actions / ITEM — · build · clock). The left is a vertical 60-minute event tape where labels only appear when there is room. The right is a **floor altimeter** (Org at the top down to You) with how many people are here. Changes flicker in as a brief glyph scramble. On a crossing, the **top and bottom rules physically travel inward to become the letterbox edges**. The frame *is* the hand-off. The alert speaks in caps with a numbered log.
*Sources:* Territory Studio (thin rules, numbered segments, short caps statements, one alert colour), avionics (tapes, altimeter), FUI layering.
*What works:* The strongest cinematic moment. The letterbox doesn't appear from nowhere, the frame you already had closes in, which makes PDR-009 feel inevitable. The coordinates line is useful beyond telemetry: it tells you where you are on the floor, app, area and item path, which suits "navigation path". It stays monochrome with one red.
*What fails or risks:* Framing every edge costs about 72 px on each side. Caps mono at 11 px is at the legibility floor, and every segment needs a tooltip to decode. The scramble flicker is the riskiest motion here (it can read as a glitch, and it is bad for photosensitivity if overused). It must stay at two short steps and be off with reduced motion. It is heavily stylised, so it may feel like a film prop on a document app.
*Principles:* Letterbox as the frame itself ✓✓. Rack focus ✓. Explain: segment 11 is locked with its reason ✓.
*Needs:* An `--x-type-micro` token, a "where am I" coordinate source from the shell (floor, app, area, item), and presence per floor.
*Cost:* Static DOM. Text changes only on events, plus two transforms on hand-off.
*Score:* Clarity 3 · Distinctiveness 5 · Feasibility 4 · Fit with calm water 3

## V6: Swim lanes
*Idea:* A timeline in the bottom band from −2 h to +3 h, with lanes for Events, Upgrade, Intents, Agent runs and Security (locked, hatched, with the reason inline). The "now" needle is the MVP's glowing green needle turned on its side. Future windows are visible ahead of time (the maintenance window is hatched in Org blue, bake end, an intent deadline, and an off-screen deadline "audit 14 Nov · 12 d ›"). **Drag to scrub:** a replay head goes into the past, nearby items stay lit and the rest dim, and a card lists what happened within ±5 min. Release springs back to now, and arrow keys work too. When the bake halts, the bar splits into done, a red bit and a hatched "on hold" section. The letterbox shows **one lane per server** with the error curve against the 2% limit.
*Sources:* Open MCT timeline (swim lanes, now marker), Harry's MVP needle, film editing timelines (scrubbing), Make It So (countdowns).
*What works:* It is the only ribbon that shows the **future**, which is what an upgrade and maintenance-window product needs. Scrubbing to replay is a real feature, not decoration. The per-server hand-off explains a rollout better than any sentence. The needle ties it to Harry's visual language.
*What fails or risks:* It needs about 140 px of height, the heaviest bottom band. Labels collide at 1280 px (I hide the off-screen label there). Time density is uneven: a burst of events becomes one blob. Scrubbing implies the *app* replays too, which it doesn't yet, and that could disappoint. Five lanes is the most you can read.
*Principles:* Focus pull while scrubbing (rack-soft, nearby items lit) ✓. Letterbox hand-off ✓. Explain: the locked lane says why in the lane itself ✓.
*Needs:* A schedule source (maintenance windows, bake plans, intent deadlines from Mandate), an event history query for replay, and a timeline component in the kit.
*Cost:* Absolutely positioned DOM. No loop. Scrub work runs only on pointermove.
*Score:* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit with calm water 4

---

## Cross-cutting findings (honest)
- **Peripheral motion is the main enemy.** V1 is the only one that moves at rest. All the others are still until something changes, which matches the dark cockpit rule. Recommendation: no ribbon moves at rest by default, and tape motion is opt-in.
- **Ambient blur on text is a trade-off.** At 0.5px it reads as "out of focus" without being illegible. Any more and people squint. The ambient level needs to be a token so it can be tuned.
- **Overload.** Six or more metrics in a ribbon is the ceiling. All variants should come from a manifest-driven list per deployment and per app ("this app's ribbon shows Events, Approvals, Upgrade").
- **One hand-off contract.** Every variant used the same `handoff({eyebrow, title, detail, evidence, actions, why})` with an Esc step-back and a returned focus. That should become a shell primitive (an alert frame plus evidence slot), and the ribbons just supply the evidence.
- **Performance.** The rack-focus `filter: blur()` on the whole stage is the most expensive thing on these pages (a full-screen filter during transition). It is fine with `will-change` on a modest DOM, but it should be measured on a large Artifacts tree. The fallback is blur on a snapshot layer or saturate only.
- **Accessibility.** Every ribbon element is a real button or has an aria-label. Hand-offs are `role=alertdialog` with a live region announcement. Colour never carries meaning alone (position, words, hatching). Reduced motion stops the tape and loops and crossfades the letterbox.

## Kit and token gaps found
- **Needs token:** `--x-rack-blur` (6px), `--x-rack-saturate` (.35), `--x-rack-scale` (.995), `--x-ambient-blur` (.5px), `--x-ambient-opacity` (.58), `--x-type-micro` (11px mono numerals), `--x-hp` (16px rack pitch). Also tape speed, which is currently `--space-5` per `--motion-run`.
- `--font-mono` (IBM Plex Mono) is relied on by every variant and is still not a token (needs an ADR).
- No hatching/stripe token. Stale, locked and "on hold" all use the same 135° stripe built from hairline mixes, so a `--pattern-unavailable` token would make "unavailable" look the same everywhere.
- Kit parts needed: a sparkline, a strip plot with limits, an LED meter, a timeline lane, an alert frame (letterbox plus evidence slot), and a "locked feed" placeholder.

## Ranking
1. **V4 Sparkline sentence.** Calmest, most AUGUR, accessible by nature, and the cheapest to build.
2. **V6 Swim lanes.** The only one that shows what's coming. Scrub to replay is a real feature.
3. **V5 Edge frame.** The best letterbox moment (the frame closes in), and the coordinates line is valuable on its own.
4. **V2 Limit strips.** The most honest instrument, but it costs width and is mostly flat lines.
5. **V3 LED rack.** The most memorable, and the patch-cable hand-off is great, but it is the closest to a gimmick.
6. **V1 Tick tape.** Familiar and dense, but it moves at rest, which goes against dark cockpit and calm water.

## What I'd build first
I'd build the **V4 sentence as the ambient ribbon** in the shell's bottom band, and add **V5's hand-off mechanics** so the band's rule travels up to become the letterbox edge. The alert frame becomes one shell primitive with an *evidence slot*. A crossing then fills that slot from whichever instrument fits: a strip plot (V2) for service health, per-server lanes (V6) for upgrades, an age table (V4) for queues. The order is: (1) the alert frame and `handoff()` contract plus the rack-focus tokens, (2) the sentence ribbon driven by a manifest list of phrases with ICU plurals, (3) the sparkline and strip-plot kit parts, and (4) V6's timeline as a Glance or Upgrade Centre surface rather than a permanent ribbon. I'm recommending a combination, which goes beyond the ask of ranking variants.
