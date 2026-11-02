# Home, "what needs you": six explorations

All six use the same sample world: Harry on the You floor, with a Mandate intent 3 days past its deadline, an approval due at 17:00, a failed "Contracts" sync, a disputed Hartley Yard fact, the AUGUR 2.15 upgrade window, share requests, new Field reports and a sign-in notice. Two things are unavailable: the Org budget approval (Org owners only, ask Dana Whitfield) and Explorer, which is rebuilding its index. Each page keeps its data in one `DATA` object, runs an auto-demo about 1.2 s after load, replays with `R`, and was checked at 1600×900 and 1280×800 with no console errors.

---

## V1: Dark cockpit (`v1-dark-cockpit.html`)
*Idea.* The page is an annunciator panel. When everything is normal it stays dark, and only abnormal items light up. Master Warning and Master Caution flash until you acknowledge them. An ECAM-style list puts abnormal items first, each followed by its action lines. Then the camera pulls focus to the worst item and shows it in a 2.39:1 letterbox, with a limit tape ("deadline → now", hatched where it is over), a parts bar, and an "If you wait" line.
*Sources.* Dark-cockpit philosophy, master caution/warning, Airbus ECAM checklists, Open MCT limit hatching, PDR-009 letterbox.
*What works.* Status reads in 2 seconds: red or amber tiles mean act, and dark tiles mean leave it. "If you wait" is the strongest single line in any variant because it states the consequence and not just the status. Space walks through the abnormal items inside the frame, and A acknowledges, which stops the flash but keeps the lamp lit (the pilot's model).
*What fails or risks.* Unlit legends at 38% ink are below contrast guidance by design, which is a real a11y issue (needs a "show legends" preference or a hover reveal). The flashing master buttons can feel alarming in an office; use them only for real limit breaches. At 1280 the letterbox only fits once title and body step down a size, so the frame needs container-query typography. The tile grid is fixed at 16 and will not scale to many apps without paging.
*Principles.* Letterbox: yes, used for exactly one urgent item, and the bars are scrim gradients with hairlines. Focus stacking: the deck blurs, desaturates and scales to .995 behind the frame, and an ambient list of read-only docs sits blurred until hovered. Explain, never hide: Explorer is shown as an INOP tile with its reason printed under the panel, and the Org approval is struck through with a reason line.
*Needs.* `--lamp-off`, a `--panel` face token, a hatch token, IBM Plex Mono as a token, and per-item `limit` and `consequence` data from apps (the shell doesn't get "what happens if you wait" today).
*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit with water language 3 (it reads as an instrument rather than water).

## V2: Rack focus planes (`v2-rack-focus.html`)
*Idea.* Three depth planes share the screen instead of competing for it. "Needs you" is the near plane, "New since Friday" the middle plane, and a wall of ambient documents set as large type is the far plane. A lens-style focus-distance scale (0.5 · 2 · ∞) racks focus with keys 1/2/3 or the wheel, and blur and saturation fall off by distance from the focal plane. In the demo the lens hunts, racks in, and then an approval in "New" escalates: it physically travels from the middle plane to the near plane. Opening an item gives a drawer with rack-focus attenuation, and the opened row is lifted out of the blur so only your path stays lit. Right-click opens the context menu with the same lift.
*Sources.* Harry's focus pulling and rack focus, cinema lens distance scales, Make It So (transparency for context, motion as confirmation), the MVP's light-streak counter.
*What works.* This is the most literal and most convincing version of Harry's principles. The "lift the open row above the blur" pattern solves a real problem: blurring a parent blurs the thing you clicked. The escalation flight explains why the list changed. The context menu shows Open, Snooze, Pass, Step back to ambient, Copy link, "Why is this here?", and a disabled Mute with its reason, which is close to what I'd ship.
*What fails or risks.* Three blurred full-screen layers cost a lot of GPU on big DOMs; ship it with `filter` on at most 2 layers and drop the far wall to a static, pre-blurred render. Parallax plus blur might bother motion-sensitive users (reduced motion turns it into opacity only). The far-plane wall is decorative until you rack to it, and when you do it is just titles, with no actions. Scroll-to-rack hijacks the wheel.
*Principles.* Focus stacking: core to the idea. Letterbox: not used, because the drawer is the active surface. A letterboxed "escalation moment" could replace the drawer for warn-level items. Explain, never hide: the locked Org row carries its reason inline, and Explorer appears in the far wall as "unavailable · rebuilding · Dana Whitfield".
*Needs.* `--dof-step` and `--dof-saturate` tokens, a kit `FocusPlane`/`LiftedRow` primitive, and an event when an item escalates (the shell needs `level` changes as domain events).
*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 5.

## V3: Limit timeline (`v3-limit-timeline.html`)
*Idea.* Open MCT for a person: swim lanes per app against real time, a green now line, limit lines, and hatched "past limit" bands. A plot above the lanes shows open items over time against caution and warning lines. A right rail counts down to each limit (T−7h 46m, T+2d 16h). Selecting an item zooms the time axis to it, softens the other lanes, and opens a callout in place.
*Sources.* NASA Open MCT (timelines, limit bands, stale data), Make It So countdowns, Tufte (one axis, little ink).
*What works.* It's the only variant that answers "what's coming", such as the maintenance window tonight and the Dept review next Monday. Explorer's lane is hatched as stale from Fri 18:30, which is an honest way to show missing data. The semantic zoom to an item is a great "navigation path" moment.
*What fails or risks.* Collisions: labels on dense lanes overlap (Artifacts needed hand-placed `row` offsets, which won't survive real data, so it needs a label-placement pass). Hard to read for non-technical people. Items with no time (a share request) are forced onto the axis. The plot's caution and warning thresholds are made up, and nobody owns that number.
*Principles.* Focus pulling: lanes blur and desaturate when one is selected. Letterbox: not used, though the zoomed lane is effectively a widescreen crop. Explain, never hide: the stale lane plus a reason in the rail.
*Needs.* Time fields on every "needs you" item (`raisedAt`, `limitAt`, `window`), a stale/heartbeat signal per app, and a hatch token.
*Score.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 3.

## V4: Dense brief (`v4-dense-brief.html`)
*Idea.* A Bloomberg/Tufte brief with no cards. A command line takes 4-letter keys (type APRV + Enter), small multiples show 14-day sparklines per app, function keys run along the top, and a dense table is grouped into Needs you / New / Ambient with a trend sparkline per row. j/k moves, Enter opens the row in place and dims every other row, and a tick tape carries the "worth knowing" lines. Right-click gives a mono context menu with mnemonics.
*Sources.* Bloomberg Terminal (mnemonics, function keys, tape), Tufte sparklines and small multiples.
*What works.* Highest density and fastest for an expert, with everything one keystroke away. Opening a row in place is the cleanest navigation path of the set. The per-app small multiples give the macro view ("Artifacts is climbing") that no other variant has.
*What fails or risks.* Mnemonics are a learning tax, and each app has to register its keys (a manifest field). Amber key caps and mono everywhere drift from AUGUR's calm Jost and water look, so it reads as a tool and not a home. The right-click menu blurs the row you clicked (V2's lift fixes this, but I didn't port it). The tape is decorative motion, it stops on reduce.
*Principles.* Focus stacking: weak, only dimming, with blur only behind the menu. Letterbox: none. Explain, never hide: unavailable rows carry a short reason inline ("Org owners only · ask D. Whitfield") and the full reason when opened. The disabled menu item says who can change it.
*Needs.* `--row` dense height token, mono font token, a manifest field for `mnemonic`, and trend data per item (14-day counts).
*Score.* Clarity 4 (for experts) · Distinctiveness 3 · Feasibility 5 · Fit 2.

## V5: Briefing (`v5-briefing.html`)
*Idea.* A 3-second opening "briefing". Telemetry strips appear at the edges (timecode, ruler, segment index). One sentence states the situation, "THREE THINGS NEED YOU", with the number in the alert colour. The three segments slide in as short caps lines, and then letterbox bars close to a 2.39:1 frame on segment 01. Segments 02 and 03 step back into the top bar, blurred but clickable. The bottom bar carries "2 more · 4 new · 12 ambient" and the Explorer outage with its reason.
*Sources.* Territory Studio (one alert colour, numbered segments, edge telemetry, stating in caps), Pushing Pixels ("tell the story in 2 s"), PDR-009.
*What works.* The most cinematic and the clearest use of the letterbox, because the bars hold the stepped-back items, so nothing is hidden for good. It makes a morning arrival feel like an event, and the statement-first copy forces the system to commit to a number.
*What fails or risks.* The intro only works once a day; on the tenth visit it's a wall to skip (it needs "play once per session or when the count changes" and Space to skip, which exists). The telemetry (timecode frames, ruler) is decorative, which is the Make It So failure mode. Caps tracking at display size is slow to read for long titles. Only 3 segments fit, so a fourth is folded into "2 more", which could hide a real fourth urgent item.
*Principles.* Letterbox: the core of the idea, with scrim-gradient bars and the out-of-frame items blurred inside the bars. Focus pulling: the statement blurs out as the segments arrive. Explain, never hide: Explorer's reason is in the bottom bar, and the folded items are counted.
*Needs.* `--strip` height token, a "first visit today" signal, and a rule for ranking the top 3 across apps (who decides warn beats caut beats due-soonest?).
*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit 4.

## V6: Console (`v6-console.html`)
*Idea.* A Braun/Eurorack rack: one module per app at equal height and HP width, LED load meters, push-button items with status LEDs, and an output jack per item that needs you. Patch cables run from those jacks into an "Out" module that lists your queue and shows the selected item on a small 2.39:1 screen. A detented rotary picks the floor (You / Team / Dept / Org) and re-tints the accent to the floor colour. Picking an item softens every other module and dims every other cable.
*Sources.* Braun / Rams (rotary detents, push buttons, one accent), Eurorack (HP widths, jacks, patch cables, LED meters).
*What works.* Floor travel becomes physical and obvious, and the floor colour finally means something on Home. Cables literally show "this came from Mandate and lands on you", which is routing as information. Explorer's "No signal" module with its reason is the most natural unavailable state in the set.
*What fails or risks.* Cables are spaghetti at 6+ items and cross text. It's skeuomorphic, with knob and jack rendering that the kit would need to own. Module widths don't scale with app count (a deployment with 12 apps breaks the rack). A11y: the cables are decorative, so the Out list must carry everything (it does).
*Principles.* Focus stacking: the selected module plus Out stay sharp and the rest go to .995 scale with blur. Letterbox: only as the small screen, which is a nod and not a real frame. Explain, never hide: the No signal module, and the lock plus "Org owners only" on Org.
*Needs.* `--led-off` and `--face` tokens, a floor-scoped query for needs ("what's on the Department floor"), and kit `Rotary` and `LedMeter` parts.
*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 2 · Fit 3.

---

## Ranking
1. **V2 Rack focus planes**: the truest expression of focus stacking. The lifted-row and context-menu patterns are reusable across every app.
2. **V5 Briefing**: the letterbox done properly, with out-of-frame items stepped back into the bars. Best as a once-a-day arrival over V2.
3. **V1 Dark cockpit**: the clearest at-a-glance status and the "If you wait" line, but low-contrast dark legends.
4. **V4 Dense brief**: the power-user view; keep it as an alternate density, not the front page.
5. **V3 Limit timeline**: the only forward-looking view; belongs as a "Timeline" tab, not Home.
6. **V6 Console**: memorable and the best floor travel, but it costs the most and scales the worst.

## What I'd build first
V2's skeleton with V5 as its arrival state and V1's copy. Home opens on the "N things need you" statement and the letterbox frame for the single most urgent item once per session. Escape, or acting on the item, racks focus back to the V2 planes: Needs you sharp, New one stop back, Ambient at ∞. Every item carries V1's "If you wait" consequence and a limit tape. The first kit work is three primitives that every app needs anyway: `FocusPlane` (blur and saturate by distance, using filter on the plane, not each child), `Lift` (clone the active element above the attenuated plane so the path stays lit), and the context menu from V2 (verbs, mnemonics, and disabled items with a reason and an owner). V4's table can come later as a density toggle, and V3 as a Timeline view.

## Kit and token gaps found
- Mono font token (IBM Plex Mono is used in every variant; it is a new dependency and needs an ADR).
- Hatch token for "past limit", stale and unavailable, which is repeated in V1, V3, V4 and V6.
- Lamp/LED off, panel face, depth-of-field step and saturation, dense row height, and edge strip height (all defined as `--x-*` in the files).
- There are no duration tokens for choreography offsets. Demo timers (300/1200/2500 ms) are literals in JS, and a sequence token set like `--beat-1…n` would fix that.
- The data the shell doesn't have yet: per-item `level`, `limitAt`, `consequence`, raised time, a heartbeat/stale signal per app, floor-scoped "needs" queries, and a cross-app ranking rule.
