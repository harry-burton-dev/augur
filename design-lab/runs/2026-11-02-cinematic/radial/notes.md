# Radial menu: six explorations

Surface: the right-click object menu for every AUGUR app. All six share one backdrop: an Artifacts library (collection cards and document rows) and a Data Atlas "facts cited" column. They also share one stage:

- **Rack focus, no scrim.** The far plane takes `blur() saturate() brightness()` and `scale(.995)` around the object, with `translateZ(0)` and `will-change` set only while racked.
- **The object stays sharp.** It is cloned into a foreground layer at its exact rect, so it stays sharp and lifted.
- **Hover hierarchy.** Cards lift and cast a shadow, rows tint with a left rule, and facts only brighten their rule (quieter lower down).
- **A ⋯ button on hover and focus** opens the same menu. This is the keyboard, touch and discoverability path.
- **Keyboard.** The ContextMenu key and Shift+F10 open the menu, arrows move, 1-8 pick, Enter confirms and Esc closes. Focus goes back to the object.
- **Demo.** Each page runs an auto-demo with a ghost cursor 1.2 s after load. `R` replays it. Any real input stops the demo and hands control to you.

Every page loads with no console errors, at 1600×900 and 1280×800. I smoke-tested keyboard open, move and close plus right-click open on all six.

Sample data lives in one `DATA` object. Unavailable actions read their reason and owner from `DATA.reasons`, for example "Only library owners can publish from Standards library. Ask Sam Patel."

---

## V1: Rack-focus pie (`v1-pie.html`)
*Idea.* A classic 8-wedge pie centred on the pointer. Direction alone selects: a wedge extends to 3R, so you don't have to land inside it. Labels sit outside the ring with number keys. A telemetry readout under the ring names the action, its target and its state. A green needle on the tick rim tracks your exact bearing. Near an edge the pie shifts inward and draws a dotted tether back to the click point.
*Sources.* Hopkins/Callahan pie menus, Fitts's law, Territory Studio tick rims and readouts.
*What works.* It is the fastest to learn: every action has the same size and distance. The readout puts "why not" in one predictable place. The hatched wedge plus lock shows an action is unavailable without hiding it.
*What fails or risks.* The disc covers the middle of the object you right-clicked, and the labels land on top of the lifted row. The tether breaks the "the menu is where I clicked" promise, and direction memory suffers once the pie moves. Eight is the hard ceiling.
*Principles.* Rack focus: yes. Explain, never hide: yes, in the readout. Letterbox: not used.
*Needs.* `--x-radial-r` and `--x-radial-hub` (derived from `--space-8 + --space-5` and `--target-md`), rack tokens, a hatch pattern.
*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V2: Marking menu (`v2-marking.html`)
*Idea.*
- **Novice.** Right-press and wait `--motion-slow` (320 ms). A compass rose of labelled boxes appears.
- **Expert.** Flick before the delay and no menu appears: only a glowing ink trail and a label at the pointer ("↘ → Move → Team").
- **Two-segment marks.** A corner in the stroke picks the target (Move ↘ then → Supplier onboarding).
- **Teaching.** After a novice pick, the ideal mark is drawn where you clicked ("Next time flick ↘ →").
- **Fallback.** A half-finished mark that you release opens the second level where you let go.

*Sources.* Kurtenbach & Buxton marking menus, the Maya hotbox, Make It So ("confirmation through motion").
*What works.* It is the only variant that gets faster with use and costs nothing on screen for experts. The teaching trail turns every menu use into a lesson. Submenu entry dims the parent and keeps the chosen spoke lit, which is the **navigation path** principle applied to menus.
*What fails or risks.*
- **Invisible to newcomers.** Nobody discovers flicks unaided.
- **Platform conflicts.** Right-button drag fights browser and OS gestures. On Windows, `contextmenu` fires on release, so we must own `pointerdown`.
- **Accessibility.** Gestures don't help screen-reader or switch users; the rose and keyboard path carry them.
- **Directional consistency.** Experts depend on the same verb staying in the same direction, so app authors can't reorder actions freely. This is a governance rule, not a UI rule.

*Principles.* Rack focus starts on press, before the menu appears, so the moment registers even for experts.
*Needs.* A per-kind "direction contract" in the manifest (verb → compass slot), gesture recognition in the kit, a teaching state.
*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V3: Rotary selector (`v3-rotary.html`)
*Idea.* A Braun-style dial with one detent per action and a "0 · Off" detent at 12 o'clock, which doubles as the cancel zone. The wheel, arrows or pointer bearing turn a ridged knob with a spring detent. You push the knob (click or Enter) to act. Labels are printed around the bezel like a scale. A readout window with an LED gives the action, its position and the reason in large caps. For small objects the dial stands beside them so the object stays visible.
*Sources.* Dieter Rams / Braun selectors, avionics rotary knobs, Territory Studio readouts.
*What works.* It is the calmest and most "honest material" of the six. Only one action is ever lit, so it reads at a glance. The wheel is a natural input on desktops, and "Off as position 0" is a lovely cancel metaphor.
*What fails or risks.* It is slow: reaching action 6 takes 6 detents, and pointing to skip makes it a pie in disguise. The knob is decoration around a list, so it gives the poorest information density per pixel. Spring rotation can feel laggy. It also doesn't scale past about 10 detents.
*Principles.* Explain, never hide: strong, because the window always carries the reason.
*Needs.* A detent sound or haptic (no token or ADR for audio), a knob material (gradients made from tokens only).
*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V4: MFD soft-keys (`v4-mfd.html`)
*Idea.* This is not a circle. The object becomes a display: corner brackets frame it, and a telemetry strip shows doc version, owner, floor and cited-by. Eight bezel keys sit above and below it with leader lines, numbered 1-8. Unavailable keys are hatched, and the reason appears in the strip's message line. Delete is a guarded key: press 5 twice, and it blinks while armed. A `0 · 1/2` page key holds actions 9-12, which is how this one scales to 12.
*Sources.* Glass-cockpit MFDs, the Bloomberg function-key habit, Territory Studio.
*What works.* It is the best keyboard story and the best route to 12+ actions. The object never gets covered. The labels are words in a row, which is the most readable layout here. The edges are predictable: keys flip to one side when there's no room.
*What fails or risks.* It isn't radial, so it breaks Harry's agreed direction and gives no directional muscle memory. Pointer travel to the far key is long on wide rows. A double-press guard is a weaker confirm than a hold. Paging hides actions behind a key, which is legal under "explain" because the key is visible, but weaker.
*Principles.* Focus stacking is very literal here: the object becomes an instrument.
*Needs.* A message line component, a guarded-action state.
*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 3

## V5: Two rings, verbs and targets (`v5-tworing.html`)
*Idea.* The inner ring holds verbs. Pointing at a verb that has targets sweeps out an outer arc of its targets, centred on that verb:
- Publish shows floors in floor colours with head counts.
- Move shows collections with floor dots.
- Share shows people.

So "Publish → Department" is one continuous stroke. A path readout ("Weekly report › Publish › Department · Operations · 42 people will see it") lights only the route taken. Org is hatched: "needs an approval, Request approval". Near a screen edge the ring becomes a 200° fan facing away from the edge, centred where you clicked, with bigger radii and labels shown only on the active wedge.
*Sources.* Hopkins pies, the Maya hotbox, the AUGUR floor palette, the navigation-path principle.
*What works.*
- **Fewer steps.** It removes the second dialog for the commonest two-step actions.
- **Real meaning for floor colours.** Colour shows where the thing will go.
- **A gentle edge strategy.** The fan keeps the click point instead of tethering away from it.
- **Scales to 12.** It reaches about 12 by putting secondary verbs into a verb's outer ring (for example "More → Download, Pin, Copy link, Export PDF").

*What fails or risks.* Outer arcs collide with the screen edge and with the lifted object. The fan compresses wedges to 25°, which is small. Long target lists (40 collections) don't fit; you need "Recent 4 + Choose…". Two concentric decisions add cognitive load.
*Principles.* Navigation path: the strongest of the six.
*Needs.* Target providers per verb from the manifest, floor audience counts from identity.
*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V6: Consequence focus (`v6-consequence.html`)
*Idea.* A compact pie whose hover state is a **focus pull**: pointing at an action pulls the objects it touches back out of the blur, sharp and in place, with tags and leader lines.
- **Move** brings the target collection card forward ("+1 · 10 items").
- **Delete** brings forward the two documents whose links break (red frame, "Link breaks") and the two Data Atlas facts that lose a citation.
- **Publish** (unavailable) explains why and offers an **Ask Sam Patel** button, so the dead end becomes a request.

Delete needs a hold. The hub ring fills over `--motion-run` while 2.39:1 letterbox bars (from `--scrim` gradients) frame the moment: "DELETE · Supplier due-diligence policy … 2 links break · 2 citations lost · Release to cancel". Letting go early does nothing.
*Sources.* Make It So (transparency for context, countdowns for urgency), rack focus, PDR-009 letterbox, Tufte's "layering and separation".
*What works.* It is the only variant where the menu answers "what happens if…" before you commit. It uses depth for meaning, not decoration, and it fits all three of Harry's principles at once. The hold plus letterbox gives destructive actions a distinct, cinematic weight without a modal.
*What fails or risks.*
- **Missing data.** It depends on a dependency graph (citedBy, cites, audience) that the shell doesn't have yet. Without it, the variant degrades to V1.
- **Cost on large lists.** Pulling clones out of a large virtualised list is expensive, and off-screen dependents need an "and 14 more" chip.
- **Too much motion.** Hovering quickly across wedges churns pulls. It needs a dwell of about `--motion-quick` before pulling.
- **Small targets on hold.** Hold-to-confirm is hard for tremor or switch users; Enter-hold and an "Undo for 30 s" fallback must stay.

*Principles.* Letterbox, focus stacking and explain-never-hide are all used, and used for their purpose.
*Needs.* A consequence API per action (affected object ids and a short tag), a letterbox component, a hold timing token (`--motion-run` works), a request-access endpoint.
*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 5

---

## Honest cross-cutting notes
- **Discoverability.** Right-click is invisible. Keep the ⋯ button on hover and focus on every right-clickable object. It opens the same radial anchored to the button, which also serves touch, pen and keyboard. Consider a one-time hint the first time someone hovers an object for longer than `--motion-calm`.
- **Max items.** 8 per ring is the comfortable limit (45° wedges). 12 per ring gives 30° wedges, which is still Fitts-friendly at R 144, but labels start to collide and directional memory degrades. Don't put 12 in one ring. Use 8 primary actions in fixed slots, and put the rest in a **More** verb whose outer ring holds them (V5), or page them (V4).
- **12-action apps.** App manifests should declare `priority` and `slot` per action. The kit fills the 8 slots and moves the rest into More automatically, so no app hand-tunes geometry.
- **Accessibility.**
  - **Semantics.** A radial is a visual layout of an ordinary `menu`. Screen readers must get `role="menu"` and `menuitem`, `aria-disabled` plus the reason as a description, and `aria-activedescendant`.
  - **Keyboard.** Arrow order is clockwise from 12 o'clock.
  - **Low vision.** Labels outside the ring and the readout can reach `--type-meta`, so a magnifier never has to orbit.
  - **Reduced motion.** It crossfades: no scale, no sweep, no spring. The rack still applies, because it is a state, not an animation.
  - **Contrast.** Racked brightness of .82 keeps contrast on menu text above 7:1 against the blurred plane.
- **Cost.** `filter: blur()` on the whole app plane is cheap when composited (one layer, GPU), but cloning the lifted object breaks in React unless the kit owns a portal for it. Racking a live, updating list also means the clone goes stale. The kit should freeze it or re-render it from the same component.
- **Where I went beyond the ask.**
  - The ⋯ button.
  - "Ask Sam Patel" as an action, not just text.
  - Guarded delete, both as a double press (V4) and as a hold (V6).
  - Off-as-cancel (V3).
  - The edge fan (V5).
  - Teaching trails (V2).

## Ranking
1. **V6 Consequence focus.** The most AUGUR idea here: depth carries meaning and Delete becomes a framed, held decision.
2. **V5 Two rings.** Turns the commonest two-step actions into one stroke and gives floor colours a job.
3. **V1 Rack-focus pie.** The honest baseline: clear, cheap, and the geometry everything else builds on.
4. **V2 Marking menu.** Brilliant for experts, invisible to everyone else. Ship it as a free layer, not as the menu.
5. **V4 MFD soft-keys.** The best for keyboard use and 12+ actions, but it abandons the radial direction. Keep it as the overflow and keyboard fallback idea.
6. **V3 Rotary.** The most beautiful object and the slowest tool.

## What I'd build first
I'd build one `RadialMenu` in the kit:
- **Geometry from V1:** 8 fixed slots, labels outside, a readout.
- **Outer target ring from V5:** for verbs that declare targets, plus "More" for actions 9 and up.
- **Edge fan from V5.**
- **Consequence slot from V6:** an optional per-action `preview(obj)` that returns affected ids and tags. Wedges without it show the readout only.
- **Hold to confirm from V6:** for actions marked `danger`.

The marking-menu behaviour from V2 falls out for free once direction selects and the open delay is `--motion-slow`, so add the trail later. Start with Artifacts documents, because the citedBy/cites data exists there first, then Data Atlas facts.

## Spec sketch: RadialMenu (recommended)
- **Geometry.**
  - Hub (cancel) radius `--target-md` (48).
  - Inner ring outer radius `--space-8 + --space-5` (144).
  - Outer target ring `+ --space-6 + --space-4` (to 176 from 116 in the two-ring version; tune).
  - 8 slots × 45°, slot 0 at 12 o'clock, clockwise, 1° gap.
  - Labels at R + `--space-3`, anchored away from the centre.
  - Selection by bearing from `--target-md` out to 3R; beyond that, nothing is selected.
- **Edges.** If any edge is closer than outer radius plus about 130, use a 200° fan facing away from the nearest edge or edges, keeping the click point, with radii ×1.3. Otherwise clamp with `--edge`.
- **Timings.**

  | Step | Token |
  |---|---|
  | Rack in/out | `--motion-base` `--ease-standard` |
  | Scale | `--motion-slow` `--ease-out` |
  | Open | `--motion-base` `--ease-spring`, stagger `--motion-instant / 4` |
  | Marking delay | `--motion-slow` |
  | Outer sweep | `--motion-base` `--ease-out` |
  | Consequence pull | `--motion-slow`, after a `--motion-quick` dwell |
  | Hold to confirm | `--motion-run` |
  | Toast | `--motion-toast` |

- **States.**
  - Object: idle → hover → pressed.
  - Menu: pending (pressed, before delay) → open → item-active → item-unavailable (reason shown, Enter does nothing, "Ask" offered) → targets-open → holding → committing → closed (focus returns).
- **Keyboard.**
  - ContextMenu or Shift+F10 opens on the focused object.
  - ←/→ (and Tab) move clockwise or anticlockwise; 1-8 jump.
  - ↓ or Enter goes into targets; ↑ or Backspace comes back out.
  - Enter picks. Hold Enter for danger actions.
  - Esc backs out one level, then closes.
- **ARIA.**
  - Object: `aria-haspopup="menu"` plus a visible ⋯ `button`.
  - Menu: `role="menu"` with `aria-label="Actions for {title}"`; it holds focus and drives `aria-activedescendant`.
  - Wedges and targets: `role="menuitem"`, with `aria-disabled` and `aria-describedby` pointing at the reason. Verbs with targets get `aria-haspopup="menu"`.
  - Announcements go through a polite live region. The far plane gets `aria-hidden` while racked.

## Needs (tokens and kit)
- **Needs token:**
  - `--x-rack-blur` (6px), `--x-rack-saturate` (.35), `--x-rack-dim` (.82), `--x-rack-scale` (.995).
  - `--x-radial-hub` and `--x-radial-r` (derivable from tokens but deserve names).
  - `--font-mono` (IBM Plex Mono, which needs an ADR).
  - A hatch pattern for "unavailable" (currently drawn with `--hairline-strong`).
  - `--letterbox-ratio` is unitless, so it can't be used directly in `calc()` lengths. A `--letterbox-bar` helper would be useful.
- **Kit:** `RadialMenu`, `useRackFocus` (a portal for the lifted clone), `Letterbox`, `HoldToConfirm`, `ReasonLine` (why + who + Ask).
- **Data the shell lacks:**
  - Per-action availability with reason and owner.
  - Audience counts per floor.
  - A dependency graph (citedBy / cites) across Artifacts and Data Atlas.
  - A request-access endpoint.
  - Manifest `slot`, `priority` and `targets` per action.
