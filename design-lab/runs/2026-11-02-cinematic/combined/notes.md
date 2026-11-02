# Round 2: combined screens

---

## Combined V1: Home, "what needs you", as it should ship

File: `combined/v1-home-day.html`. One `DATA` object holds the content, labels, floors, ribbon phrases, menu copy and demo script. Checked at 1600×900 and 1280×800, with and without reduced motion, through the keyboard path (briefing, skip, j/k, Enter, Space, 1/2/3, F, B, R, U, ContextMenu) and right-click. No console errors.

## What happens on screen
1. **Arrival (once a session).** The Home stage is already behind the briefing, racked out (blur, desaturated, scale .995). A statement reads "FOUR THINGS NEED YOU", with the number word in danger because one item is past its limit. The four segments slide in. Then scrim bars close to a 2.39:1 frame on the most urgent item: the Mandate intent, past its limit. The frame shows its readouts, a limit tape, "If you wait" and three actions. The other items step back into the top bar, blurred but clickable. The bottom bar names the one item you can't act on, why, and who can. Any key skips. Enter opens the item. Esc goes to Home.
2. **Release (match cut).** The bars open, the stage racks in, and the frame's title settles into row 01 of Needs you.
3. **Resting Home.** There are three planes. **Needs you** is near and sharp. **New since Friday** is one stop back. **Worth knowing** is a wall of type at ∞. A lens scale on the right racks between them, each stop with a streak count. Every needs-you row carries app · floor · who, the title, **If you wait** and a mini limit tape. Top left is the altitude window box (level, name, then needs-you traffic above ▲ and below ▼ as floor-coloured diamonds). The bottom edge has the sparkline sentence.
4. **Demo beat.** A ribbon phrase changes (flicker). Then the approval in New escalates: focus pulls to the mid plane, the chip flickers, it flies into Needs you at its rank, focus racks back, and the streak count flickers 4→5. The bloom cap moves: the dispute loses its bloom when the approval arrives.

Interactions: j/k/arrows move a cursor (it glints once on arrival). Enter opens the drawer: rack-focus attenuation, the opened row lifted above the blur, neighbours dimmed. Space brings a New item forward, and an information-only item refuses with a reason. 1/2/3 rack. Clicking a soft plane pulls focus to it first and opens on the second click. Right-click or ContextMenu/Shift+F10 opens the menu with a placeholder ring at the origin. Menu actions are Open, Snooze (the row flies to the far wall), Pass, Step back to New (the row flies back to the grid), Copy link, Why is this here? (rank and reasons shown inline), and a disabled Mute with its reason and owner. Actions in the drawer complete the item, which dims in place with "Done · what · when", and U undoes it. F opens the floors list (where your work comes from). Hovering a diamond or a floor dims the rows that came from other floors. B replays the briefing, and R replays everything.

## What I took from each source
| Source | Taken | Changed |
|---|---|---|
| Home V2 rack focus | Three planes, lens distance scale, escalation flight, lifted row, drawer, context-menu verbs | Wheel-to-rack removed (it hijacked scroll). Far wall is now actionable (cursor, read-only peek, menu). Pointer events off on the d=2 plane so the far wall is never "clicked through". Click on a soft plane pulls focus first. Step back and snooze added as reverse flights so every move between planes has a direction. |
| Home V5 briefing | Statement → numbered segments → 2.39 letterbox, stepped-back items in the bars | Plays **once a session or when a new item passes its limit** (signature of warn ids in sessionStorage), not every visit. Decorative timecode, ruler and segment index removed: the real Home sits behind it instead. Lists every actionable item (up to 5, then "and N more, all on Home"), so a fourth urgent item is never folded away. Title in sentence case, with caps kept only for the 3-word statement. Release is a match cut into the row, not a cut to a different screen. |
| Home V1 dark cockpit | "If you wait" on every item, limit tape with hatched "past" band | Legends are never under ink-muted (V1's 38% legends failed contrast). The consequence label is ink, the text is ink-muted at 14px. Consequences are capped at about 64 characters so they fit one line at 1280, and they clamp to two lines at worst. |
| Telemetry V4 sparkline sentence | Ribbon with Tufte bands, micro→macro panel on hover | Ambient blur .4px and opacity .82 (V4 used .5px / .58, which took ink-muted below AA). Ember added for the stale sync. The phrases tie to the work: "Policy team storage 100%" is the cause of the sync fault above it. |
| Floors V1 altitude tape | Resting window box with traffic above and below | No `FL 00` index (the critique: numbers people would learn that aren't stable). Level label and name only. Traffic counts **what needs you**, by source floor, and hovering a diamond lights the rows from that floor. Travel itself stays in Floors V1, and the popover says so. |
| Grammar V2 light language | Streak, bloom, beacon, flicker, ember, shadow, horizon, glint, dim | Caps enforced in code: one beacon (top warn, the one the briefing frames), two blooms beside it, and every other row is plain. Shadow on the Org approval, the Explorer wall item, a floor you left, a drawer action and a menu item. Each says why and names who can act. |

## Challenging the brief (where I went beyond the ask)
- **The letterbox shouldn't auto-dismiss in the product.** It does here only because the demo needs to move on (`DATA.demo.autoRelease`). In use it should hold until a key or click, because an urgent item that leaves by itself was not truly urgent.
- **Rank must be a shell rule, not app order.** "Why is this here?" prints the rule I assumed (past its limit, then due soonest, then what you own). Someone has to own it. I'd write it into `docs/app-patterns.md` and let apps supply only `level`, `limitAt`, `consequence`.
- **"If you wait" is the most valuable field and the one apps don't send today.** Without it the row degrades to a status. I'd make it required for `level: warn|caut` in the manifest/event schema, with a length budget.
- **Briefing on every visit would be a wall.** Once a session, plus re-arm on a *new* warn item, is the rule here, and B replays it on demand.

## Remaining risks
- **GPU cost.** Stage filter plus two plane filters during a rack is three full-viewport blurs in one transition. That's fine on this DOM. On a large Artifacts tree, ship with the far plane pre-blurred (a static layer) and keep `filter` on at most two layers. The `will-change` hints stay only on the stage and the planes.
- **Motion load.** Briefing, match cut, flights, flickers and a breathing bloom all happen in the first 8 seconds of the demo. In real use only the briefing (once) and the occasional escalation would play. Reduced motion turns all of it into cuts or opacity, and blooms and the beacon go static.
- **Blurred text is unreadable by design.** Mid and far planes rely on rack (1/2/3, click) and the lens counts to be legible. Screen readers get the full DOM. Under reduced motion the planes become opacity-only, and the far wall drops to 10% so it doesn't fight the rows.
- **Ribbon reflow.** Two lines at both sizes, and a changing number can push a phrase to the other line. A manifest list of at most 6 phrases with ICU plurals is still needed.
- **Height at 1280×800.** Six rows plus header fit with about 10px to spare. A seventh needs-you item needs a "+N more" row or scrolling inside the near plane (not built).
- **Drag-and-drop between planes is not built.** Step back and snooze are menu and keyboard only.

## Kit parts it needs (Quill / Aerie)
- `FocusStage` + `FocusPlane` (distance → blur/saturate/opacity via tokens, one filter per plane, pointer policy per distance).
- `Lift` (clone the active element above an attenuated plane, restore on close).
- `Letterbox` (scrim bars from `--letterbox-ratio`, frame slot, stepped-back slots top and bottom, match-cut release callback).
- `Briefing` (statement + segments, once-per-session rule with a signature).
- `NeedRow` (eyebrow, title, `consequence`, `limit`, `MiniLimitTape`, signal slot) and `LimitTape` (full).
- `Signal` with kinds `streak | bloom | beacon | flicker | ember | shadow | glint | dim`, with caps enforced by the shell.
- `LensScale` (stops with streak counts and mark).
- `ContextMenu` (header, verbs with mnemonics, separators, disabled item with reason + who, inline "Why is this here?", origin ring for the radial variant).
- `FloorBox` (window box with traffic diamonds and hover-to-highlight) and `FloorList`.
- `SparkSentence` (phrases, `Sparkline` with normal band, ember, progress, locked phrase) + `SmallMultiples` macro panel.
- `Toast` with Undo (U).

## Tokens
Used from the kit: `--letterbox-ratio`, `--scrim`, `--surface-*`, `--hairline*`, floor `-high/-low`, `--danger/--warning/--info/--success/--green`, all `--motion-*` (choreography is built from them in JS: `quick`, `run`, `still`, `calm`, `slow`), `--ease-*`, `--glow-blur`, `--breathe`, `--band-top`, `--measure-*`, `--space-*`, `--radius-*`, `--type-*`, `--tracking-*`, `--layer-*`.

**Needs token** (defined as `--x-*` at the top of the file):
- `--x-far-blur` 6px, `--x-far-saturate` .35, `--x-far-scale` .995 (active-surface attenuation; same as grammar's `focus-far-*`)
- `--x-dof-step` 3px, `--x-dof-saturate` .55 (per-plane depth of field)
- `--x-ambient-blur` .4px, `--x-ambient-opacity` .82 (ambient ribbon; raised from .58 for contrast)
- `--x-type-micro` 11px (mono caps and numerals)
- `--x-ribbon-h` (ambient ribbon height, 80px)
- `--x-pattern-unavailable`, `--x-pattern-over-danger`, `--x-pattern-over-warning` (hatches, repeated across every round-1 surface)
- `--font-mono` (IBM Plex Mono): still not a token, and it's a new dependency, so it needs an ADR.
- A choreography/beat set (`--beat-*`) would replace the sums of motion tokens in `brief()`.

**Data the shell doesn't have yet:** per-item `level`, `limitAt` (and raised time for the tape), `consequence`, `rank` rule, source `floor`, an escalation domain event (New → Needs you), the per-floor needs count for the window box, the "first visit this session / new warn" signal, and 24 h series with normal bands for the ribbon.

## Scores
Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 5

Clarity loses a point for the number of signals a newcomer must learn (lens, streaks, bloom vs beacon, floor diamonds). Feasibility is 3 because the parts are straightforward but the data contract (`consequence`, `limitAt`, rank, escalation events) touches every app, and the blur budget needs measuring on a real tree.

## What I'd build first
`FocusStage/FocusPlane` + `Lift` + the four `--x-far-*` tokens, then `NeedRow` with a required `consequence` field, then `Letterbox` with the once-a-session `Briefing`. The ribbon and floor box can follow as independent parts.

---

## Combined V2: Artifacts in focus

File: `v2-artifacts-in-focus.html`. Checked by screenshot at 1600×900 and 1280×800, in normal and reduced motion, with no console errors (`_shots-v2/check.js`, `timeline.js`, `replay.js`).

**The demo.** After about 1.2 s the menu opens on the "Access control standard" document, glides to Publish and then to Department. That shows the consequence preview: the floor ladder is pulled sharp, the readout says "+41 people", and the horizon tints to the Department floor. Org stays in place but unavailable, with a reason and "Request approval". The demo then cancels and focus returns to the row. Next, an escalation waits for a pause in typing, lifts out of the rail, opens the 2.39:1 letterbox with its consequence chips, and is approved: the count drops, a toast appears and the note is kept. Press R to replay, even while a menu is open.

## What I took from each source

| Source | Taken |
|---|---|
| Focus V1, focal planes | Four named planes (ground, work, active, decision) and the far and deep recipe. Planes that step back get `inert` and `aria-hidden`, and `will-change` is set only while racking. |
| Focus V2, lit path | The base layout: 3 columns, a collapsible rail, a tree that opens in place, distance dimming, an SVG trail drawn on, sticky path rows as the breadcrumb, and the About panel. |
| Focus V6, escalation | The idle wait, the armed → pulled → decide → released or snoozed states, the item lifted out of the rail with a tethered card, and the 2.39 letterbox. |
| Radial V1, pie | Fixed slots with a direction contract, labels inside the wedges, the hub as cancel, and the readout. |
| Radial V5, two rings | The outer ring of targets: Publish → floors with head counts, Move → collections. The edge fan. |
| Radial V6, consequence | The pull (sharp clones of the rows that will change, with a tag and a dashed lead), hold-to-confirm Delete, and letterbox bars in the decision plane. |
| Light language | Streak counts, bloom (needs you), ember (stale), shadow (locked), beacon (armed), glint (escalation Open), flicker (changed), and a dark cockpit with ambient "Needs you". |

## What I changed and why

- **Far blur is 6px, not 8px.** Radial used 6px and focus used 8px. At 6px the text behind the menu still reads as a layout, but you can't read the words, which is the point.
- **No glass on glass.** The menu is a solid disc on the active plane. A backdrop-blur behind a menu that sits over an already blurred plane cost frames and muddied the wedge edges.
- **One readout instead of three.** V1, V5 and V6 each had their own readout: label, target, consequence. Now one block shows the path (Publish › Department), the consequence, the affected list, how to undo, and the Ask button. It sits at a fixed distance (r2 + `--space-6`) and tries below, above, right, then left, avoiding pulled clones. Before this it jumped around and covered target labels.
- **About follows the menu's subject.** Right-click a collection and the About panel shows that collection while the menu is open, then goes back when it closes. The panel acts as a large, free preview.
- **Slide, then fan.** Near an edge the centre slides by at most one band. Beyond that the menu becomes a 200° fan facing away from the edge. Before this, sliding moved the hub far from the pointer, and a full ring was clipped.
- **Latch with hysteresis.** Once the pointer is out among the targets, the verb only changes when it comes back inside (hub + r1)/2. Without this, moving along the target arc switched the verb under you. Each target arc's rotation is also limited to floor(n/2) target widths, so it always overlaps its verb.
- **Enter on an unavailable action sends the Ask.** An unavailable action is still a real menu item. It stays in its slot, hatched with a lock, and shows its reason and owner. Enter or the Ask button sends the request, with Undo in the toast. A reason with no owner (Publish when the document is already at Org) shows an explanation and no button.
- **Native menu inside text fields.** Right-clicking in the note keeps the browser's menu. Spelling and paste matter more there than our verbs.
- **Horizon preview.** Pointing at a floor target tints the ground horizon to that floor's colour. It's a light-language signal with no added text.
- **Horizontal streaks.** Streak counts run in a strip, so they don't wrap at 1280.
- **Bloom bubbles up.** A library row blooms when anything inside it needs you, so you can find the signal while the tree is collapsed.
- **Consequence in the letterbox.** The decide frame shows the same chips as the readout (who gains access, how many people), so the urgent path and the menu use one vocabulary.
- **Delete is the only hold.** Every other verb commits on release or click. A hold everywhere would be slow, and Undo covers the rest.

## RadialMenu: kit spec (refined)

### Geometry (tokens)
| Token | Value in prototype | Meaning |
|---|---|---|
| `--radial-hub` | `--target-md` (48) | Hub diameter. The hub is cancel and shows the hold ring. |
| `--radial-r` | `--space-8 + --space-3` (128) | Inner radius of the verb ring. |
| `--radial-gap` | `--space-1` (4) | Gap between rings and between wedges. |
| `--radial-band` | `--space-6` (44) | Depth of the target band. r2 = r + gap + band ≈ 176. |
| `--radial-reach` | 3 | Selection by bearing reaches out to 3 × r2, so a flick works. |
| (fan) | r × 1.3, 200° arc | Used when sliding one band can't keep both rings on screen. |

### Slots
There are 8 fixed slots, and each verb always has the same direction (muscle memory):

| Slot | Document | Collection | Library |
|---|---|---|---|
| N | Open | Open | Open |
| NE | Share | Share | Share |
| E | Publish | Add | Add |
| SE | Move | Move | Sync |
| S | Delete | Delete | Delete |
| SW | History | Archive | Archive |
| W | Rename | Rename | Rename |
| NW | More | Pin | More |

Tree rows use the action set of their kind (library, collection or document).

### Limits and overflow
- At most 8 wedges. Seven are verbs; when there are more actions than slots, the last slot becomes **More**. More opens its own ring of up to 8; past that it becomes a searchable list, never a third ring.
- Actions are ranked by the order in the manifest, so the app decides what goes into More, not the shell.
- At most 5 targets per verb, plus "Choose…", which opens the full picker. The target arc stays at 170° or less.
- 12+ actions: 7 slots plus More (up to 8 more) covers 15. Beyond 15, More shows a type-to-filter list. The prototype's document has 12 actions, and 5 of them go into More.

### Timings (tokens)
| Token | Value | Use |
|---|---|---|
| `--radial-stagger` | `--motion-instant` / 4 | Wedges open one after another. |
| `--radial-dwell` | `--motion-quick` | Rest on a target before the consequence pull. |
| `--radial-hold` | `--motion-run` | Hold-to-confirm fill. |
| `--motion-rack` | `--motion-slow` | Focus moves to the active plane. |
| `--motion-pull` | `--motion-calm` | Clones lift. |

Reduced motion turns off the stagger, the rack and the pull movement (the states still change). The hold becomes an explicit second press (Enter twice), and Undo stays.

### States
- **Menu:** closed → opening → open(verb) → open(verb, target) → committing → closed.
- **Wedge:** idle · hover/active · path (a verb whose targets are open) · unavailable (hatched, lock, reason) · danger (Delete) · holding.
- **Target:** idle · active · blocked (reason and Ask) · current (where the item already is, shown but not selectable).

### Pointer
- Right-click opens the menu centred on the pointer, adjusted by slide or fan.
- Press-drag-release commits the verb under the pointer. Click-move-click also works.
- Releasing on the hub, or pressing Esc, cancels.
- A drag only stops the auto-demo when the pointer has really moved (more than 2px).

### Keyboard
- Shift+F10 or the ContextMenu key opens the menu on the focused row.
- Arrow keys move by bearing; ArrowRight or ArrowDown, outward, enters the target ring. Home and End go to the first and last items.
- Enter commits. On Delete, hold Enter for `--radial-hold`; releasing it early cancels. Enter on an unavailable action sends the Ask.
- Esc steps back out of the targets, then closes the menu and returns focus to the row that opened it.

### ARIA
- `role="menu"` with `aria-activedescendant`. Items are `menuitem` with stable ids.
- An unavailable item is `aria-disabled="true"`, and its reason and owner go into `aria-describedby`. It stays focusable.
- Target rings are `role="group"` with a label naming the verb.
- A polite live region announces the consequence ("Department: 41 more people can read this").
- Delete announces "Hold Enter to delete".

## Remaining risks
1. **The shell lacks the consequence data.** The preview needs a dependency graph (what cites this document, links that would break) and audience counts per floor, available in under 100 ms. Today's registry and storage have neither. Without them, the menu's best feature becomes a guess. **This is the top risk.**
2. **Cost of blur and clones.** Blurring the whole work plane and cloning rows is fine on the demo's data. With 500+ rows or on weak GPUs it needs measuring. Fallback: dim only, with no blur.
3. **Clones go stale.** If the list changes while the menu is open, the pulled rows are out of date. They need to subscribe to updates or close the menu.
4. **Hold-to-confirm accessibility.** Holding is hard for some motor impairments. Enter-hold, Undo and the reduced-motion double press help, but this needs testing with real users.
5. **Accidental requests.** Enter on an unavailable action sends an Ask. The toast's Undo handles it, but owners could still get noise.
6. **Geometry trade-offs.** Fans hide some wedge labels (the readout carries them). Slides and fans move the hub away from the pointer. Straight lines between distant targets can cross wedges.
7. **Prototype-only overlaps.** The toast can cover the masthead title, and the caption covers the lowest tree rows at 800 high.

## Kit parts needed
- **FocusStack:** planes, depth, rack, inert, and the frozen far plane.
- **RadialMenu:** described above. It takes actions from the manifest, plus reasons and targets.
- **ConsequencePreview / Pull portal:** a clone at its exact rect, a tag, a dashed lead and a dwell. Fed by the consequence API.
- **ReasonLine + Ask:** reason, owner and request, shared with the "Explain, never hide" rules.
- **HoldToConfirm:** ring, keyboard and the reduced-motion fallback.
- **Letterbox:** a 2.39 frame on the decision plane, with bars.
- **EscalationPull:** idle wait, lift, tether, snooze.
- **PathTree:** opens in place, distance dimming, sticky path rows, trail.
- **Signal:** streak, bloom, ember, shadow, beacon, glint, flicker, horizon.

## Tokens needed
- **Focus:** `--focus-{near,far,deep}-blur`, `--focus-{far,deep}-{saturate,dim,scale}`, `--focus-idle-wait`.
- **Motion:** `--motion-rack`, `--motion-pull`.
- **Path:** `--path-dim-1..3`, `--path-soft`, `--trail`.
- **Radial:** `--radial-hub`, `--radial-r`, `--radial-gap`, `--radial-band`, `--radial-dwell`, `--radial-hold`, `--radial-stagger`, `--radial-reach`.
- **Also:** `--font-mono` (counts and paths), a hatch pattern for unavailable and locked items, and `--letterbox-bar`.

New `floor-*` tokens: none. The horizon reuses the floor colours.

## Where I'd push back on the principles
- **Explain, never hide.** In a radial menu, this makes the menu the right place to explain. An unavailable verb keeps its slot, so the geometry never changes between users or items.
- **Escalation needs a rule.** Letting an item lift out of the rail by itself goes against "never interrupt". The idle wait plus a single lift per item per session is the rule I'd write down. It's worth Harry's call before shipping.

## Scores (1-5)
- **Clarity: 4.** One readout and fixed directions make it clear. The fan near the bottom edge is the weak spot.
- **Distinctiveness: 5.** Depth, a consequence preview and the light language together look like nothing else.
- **Feasibility: 3.** The UI is buildable now. The consequence data and the cost of blur are the work.
- **Fit: 5.** Every unavailable action explains itself and names who can change it, and everything comes from the manifest and tokens.

---

## Combined V3: the urgent path (PDR-009 letterbox, end to end)

`v3-urgent-path.html`: one scenario, one system. During the 0.14 rollout, server 3's error rate rises past its limit, the bake halts itself, and someone has to choose: roll back, retry or hand over. All sample data sits in one `DATA` object.

**The path (the auto-demo takes about 13 s; Space steps through it, R replays):**

1. **Ambient.** The Artifacts home is sharp. A thin edge rule runs top and bottom. The top one is the "where you are" line (FL Finance › APP Artifacts › AREA Actions, plus build and clock). The bottom one holds a lens focus scale at ∞ that reads "Nothing needs you". Above it, the sparkline sentence sits softly out of focus.
2. **Notice.** "server 3 errors 1.1%" sharpens and turns amber, and the lens index moves to 10. Nothing interrupts.
3. **Needs you.** The phrase turns red and the upgrade phrase reads "halted at 2 of 5". The app racks *soft* (blur at a third of the far plane). A card rises from the phrase with five small multiples, one per server. Server 3 is lit and the others are dimmed (the navigation path). Lens: 3.
4. **Urgent.** The two edge rules travel inward and *become* the letterbox bars, and the bars carry metadata. Server 3's small multiple grows (FLIP, transform only) into the 2.39 plot with limit bands, the likely cause, a projection and a live readout. The phrase flies up and becomes the headline. The overview panel holds the four-part explanation, three actions and one unavailable action. Lens: 1.
5. **Acknowledge (A).** The chip changes from "Not acknowledged" to "Acknowledged 21:14:02 · not resolved".
6. **Esc steps back.** The frame opens and the notice waits as a lit segment of the top rule: "Urgent · server 3 bake halted · acknowledged · Enter". Enter reopens it with a fast cut.
7. **Decide (Enter on Roll back).** The plot racks back inside the frame. Three planes show: how it got here, the decision (hold to roll back), and what happens if you roll back (212 dots). Every plane stays sharp.
8. **Act.** Hold Enter, or use "Confirm in two steps instead". A green sweep runs along the rule and the dots light. The status reads "Acted · not resolved yet", with what changed, who was told, when it resolves, and what is still to do.
9. **Release, then resolve.** The rules slide back out. The phrase reads "server 3 rolling back" (Notice, info blue). After the resolution condition is met, the history shows "Resolved 21:19:40", the lens returns to ∞ and the line reads "Nothing needs you".

Q queues a second urgent item. It shows as "1 of 2 · next: …" in the top bar and never stacks. M toggles reduced motion.

## What I took from each source, and what I changed

| Source | Taken | Changed, and why |
|---|---|---|
| telemetry V5 edge frame | Rules that close in to become the letterbox; the coordinates line | Kept only the top and bottom edges: the left and right ones cost about 72 px each (critique). The rule **is the bar at rest**: the bar element is always there, translated so only its 28 px strip shows, so the transition is one transform and needs no second layer. The coordinates line turns into a **path**: where you came from dims, and the alert's path (Org › Upgrade Centre › Rollout 0.14 › Server 3) is lit. Dropped the glyph-scramble flicker (photosensitivity risk). |
| telemetry V4 sparkline sentence | The ambient ribbon; the phrase becomes the headline | The sentence never wraps. Phrases drop out by manifest priority until it fits (`fitRibbon`). The locked "security notices" phrase has high priority so it never drops: explain, never hide. The phrase's sparkline is the first of three sizes of the same series (sparkline, small multiple, frame plot). |
| alerts V1 letterbox arrival | Bars carry kind, sequence/queue, floor, source and escalation reason (top); seen-by, acknowledgement state and when it resolves (bottom). Four-part explanation. Stepped-back pill. Resolve-from-blur. Confirmation sweep. | The pill lives **in the rule it came from**, so there is no new notification surface (critique: "the pill must not become a second notification system"). Dropped the big clock because it duplicated the headline. Only the first arrival plays the staged resolve; a reopen is a 240 ms cut, which fixes the "slow the tenth time" note. |
| alerts V5 limit violation | Tile-to-frame growth, limit bands, line coloured by band, likely cause, NOW, projection, live readout | The projection says "If this rate continues" and gives a time. The other servers are drawn as ghost lines, which *is* the evidence for the likely cause (server 2's bump during the same step). The cause label narrows rather than slide under the panel, the critique's 1280 risk. |
| alerts V6 approval | Provenance, decision and consequence planes; hold to confirm; dots for reach | **All three planes stay sharp** (no rack between planes). Provenance merges the chain of custody with the **escalation history** from V3, so "why is this urgent" reads as a chain. Hold progress is drawn per frame in JS, so it stays honest when the OS turns transitions to 1 ms. The accessible alternative is two presses: the first arms the action for `--motion-hold`, and the second confirms. |
| alerts V2 annunciator | Acknowledge is not resolve | There are three separate verbs, each with its own state: **acknowledge** (A, a chip in the bar), **act** ("Acted · not resolved yet") and **resolve** (a condition the system checks: "< 1% for 5 min"). Esc is never dismiss. No flashing anywhere: urgency is carried by space, never by loops. |
| alerts V3 escalation ladder | Four levels; one item recognised at every depth; history | The lens is a **small instrument in the bottom rule**, not a demo rail. Marks sit at 1/distance like a real barrel (∞ 10 3 1), with a square-root throw so ∞ and 10 don't collide. The index travels further at each level, so the closer the focus, the more it needs you. Level colours follow the light-language grammar: notice in info blue, needs you in green (it asks), urgent in red (it interrupts). |

Beyond the brief, I also added the ultrawide rule (side curtains), the "+ queued" rule, a demo clock that jumps to each stage's recorded time so timestamps never run backwards, and focus return after every step.

**The unavailable action.** "Continue to servers 4–5" is hatched and dashed and has an info line: "The Org upgrade policy stops a rollout while any server is over its error limit. Priya Nair (Org owner) can change the policy in Admin › Upgrades." It appears in the overview and again in the decision plane. Pressing it pulses the reason instead of doing nothing.

## Letterbox kit part: a refined spec

Today's `kit-common/src/letterbox.tsx` is a solid frame (`background: var(--slate)`), uses a hard-coded `blur(6px)`, sets `overflow: auto`, and has no bar slots. Proposal:

**Anatomy.** `<Letterbox>` = `FarPlane` (wraps the app) + `Bar top` + `Frame` + `Bar bottom` (+ `Curtain`s on ultrawide). The frame is transparent over the racked far plane, never a solid block.

**Bar slots** (all optional, filled from the notice record, never written by hand):
- `top.meta`: kind · `n of m` (queue) · floor dot and name · source · escalation reason (truncates with an ellipsis).
- `top.path`: from-path (dimmed) → alert path (lit), then build and clock. This row is the at-rest edge rule.
- `bottom.instrument`: level (lens), level history, context keys. Also the at-rest rule.
- `bottom.meta`: acknowledgement chip · seen-by (who, when, not yet) · resolution condition.

**Ratio handling.** `fh = min(100vh − 2·letterbox, 100vw / letterbox-ratio)` and `fw = min(100vw, fh · ratio)`; the bars are `(100vh − fh)/2` and the side curtains `(100vw − fw)/2`.
- 1600×900: frame 1600×669, bars 115 px.
- 1280×800: frame 1280×535, bars 132 px. This is the content floor everything is designed for.
- 2560×1080: frame 1962×821, with the 12% minimum bars kept and 299 px curtains that carry nothing.
- Below 1280 wide (not supported yet): hold a minimum frame height (needs token, about 480 px) rather than shrink text. Legibility beats the ratio.

**Overflow.** No scrolling inside the frame. Content past the frame goes behind a "More" disclosure. Long lists go to the destination app (Open Upgrade Centre).

**Motion (tokens only).**
- Entry: the bars translate `--motion-calm` / `--ease-out` while the far plane racks over `--motion-calm`. Content resolves from blur with staggers of `--motion-base` × 1–2.5; the first arrival totals about 1.4 s.
- Re-entry: `--motion-base`, no stagger.
- Exit: the bars translate back over `--motion-calm` and the frame fades in parallel.
- Confirmation sweep: `--motion-run`. Auto-close after acting: `--motion-hold`.
- Reduced motion: no transforms. Crossfades run at `--motion-base`, and the hold indicator stays because it is functional.

**Focus.**
- On entry, focus goes to the primary action, and Tab and Shift+Tab cycle within the frame.
- The far plane, the ribbon and any needs-you card are `inert`. The hidden view inside the frame is `inert` too, which fixes a focus bug I hit with inherited `visibility` transitions.
- On exit, focus returns to the pill (stepped back) or to the source phrase (resolved).

**ARIA.**
- The frame is `role="alertdialog" aria-modal="true"`, with `aria-labelledby` pointing at the headline and `aria-describedby` at the lead and the acknowledgement chip.
- Notice and needs-you are announced in a polite live region. Urgent is announced by the alertdialog.
- The hold button has `aria-describedby` for its hint. The unavailable button is `aria-disabled` with a `describedby` link to the reason.

**One at a time.** The shell holds at most one open letterbox. A new urgent item joins a queue shown in `top.meta` ("1 of 2 · next: …") and as a queued pill once this one closes. It opens after a calm gap (`--motion-still`), never on top of another. The order is by severity, then age.

**Verbs.** `stepBack()` (Esc) puts the item on the edge, `acknowledge()` (A) records who saw it and when, `act(id)` runs the decision, and `resolve` comes from the system. Dismiss does not exist.

## Kit parts and tokens needed

**Parts.**
- `Letterbox` with bar slots; `FarPlane` (soft and far levels); `EdgeRule` (bar at rest).
- `LensLevel`; `SentenceRibbon` with `Phrase` and `Sparkline`; `StripPlot` (limit bands, marks, projection, ghosts).
- `SmallMultiples`; `Explain` (4-part); `Unavailable` (button plus reason and who); `AckChip`.
- `HoldButton` with its two-step alternative; `Planes` (provenance / decision / consequence); `ReachDots`.

**Tokens (proposed, all defined at the top of the page).**
- Far plane: `focus-far-blur` 6px, `-saturate` .35, `-dim` .78, `-scale` .995.
- Soft plane: `focus-soft-blur` (far/3), `-saturate` .7, `-dim` .9, `-scale` .998.
- In-frame rack: `focus-near-blur` (far/2), `-dim` .3.
- Ambient: `ambient-blur` .5px, `ambient-opacity` .58.
- Type and texture: `type-micro` 11px mono, and `font-mono` (needs an ADR, it is a new dependency); `pattern-unavailable`.
- Layout: `edge-rule` (= space-5), `letterbox-min-frame` (about 480 px).
- Level aliases `level-notice`, `-needs`, `-urgent`, which map to info, green and danger.

**Data the shell doesn't have yet.**
- Escalation rules and history per notice, and acknowledgement records (who, when).
- Seen-by and paged state from on-call; a resolution condition per alert.
- Per-server time series and limits from the updater; step annotations ("search index rebuild") to back the likely cause.

## Remaining risks

1. **Top risk: two kinds of fidelity in one frame.** The plot, the projection and the likely cause are only as trustworthy as the updater's telemetry and annotations. A confident red headline on wrong data is worse than no letterbox. The kit should refuse the urgent level when the evidence series is stale; it should fall back to needs-you with the stale hatching.
2. The arrival choreography has three things moving at once (bars, plot, headline). It reads well at 1600, but it is the most motion-sickness-prone moment. User-test it, and consider dropping the phrase flight and keeping the plot growth.
3. A blur over the whole app (`filter` on a large DOM) during a `--motion-calm` transition needs measuring on a big Artifacts tree. The fallback is saturate and dim only.
4. The bottom bar is dense: lens, history, keys, acknowledgement, seen-by and resolution. At 1280, seen-by truncates. It needs a priority order and would benefit from the type-micro token being tested on real screens.
5. The needs-you to urgent rule ("still rising 60 s after the halt") is invented. Thresholds belong in Admin per deployment, with a per-person ceiling (critique of V4).
6. The caption and key hints are exploration chrome: they sit in the rail foot at rest and over the top bar's outer edge while framed.

## Scores
Clarity 5 · Distinctiveness 5 · Feasibility 4 (one new part with slots and four token groups; the telemetry data is the long pole) · Fit 5 (monochrome until something matters, one colour per level, light spent only on meaning).

---

## Combined V4: floor control and floor travel, as they should ship

File: `v4-floor-travel.html`. One shell (Artifacts, plus Upgrade Centre as the
"same on every floor" app), one `DATA` object, auto-demo after 1.2s, `R`
replays.

**Demo (about 34s):** rest on You → open the picker → select Platform → travel
(ping) → letterboxed arrival card, because an overdue intent waits there →
rest → open again → walk up past Research Guild, **Ops Rota (left)** and
Engineering to **Operations (locked)** → Enter is refused → back to
Engineering → travel up → plain establishing title → rest. Then two beats go
beyond the brief: switch to Upgrade Centre, where the gauge rests dimmed with
its reason, and switch back.

**Keys:** `F` or click opens the picker. In the picker, `↑↓` choose,
`PgUp PgDn` jump a level, `Home End` go to the top or bottom, `Enter` travels,
`Esc` closes. A click on an open floor travels at once. A click on a closed
floor shows why. With the picker closed, `PgUp PgDn` travels to the next floor
you can reach. On a card, any key dismisses it, and `Enter` on an urgent card
pulls focus to the urgent item. `U` toggles Upgrade Centre. `R` replays.

Checked at 1600×900 and 1280×800: rest, open, path lit, ping mid-sweep, urgent
card, plain card, quiet arrival, refusal, inert explanation, a keyboard-only
path, a mouse path and reduced motion. The standalone build (`build.py`) runs
the full demo with no console errors or warnings.

---

## What I took from each source

| Source | Taken | Changed |
|---|---|---|
| floors V1 Altitude tape | The resting window box: where you are, plus waiting traffic above and below as floor-coloured diamonds with counts. The tape as the spine of the picker. The "altitude captured" ring on arrival. | **No FL numbers.** Floors are named by level ("TEAM · Platform"). The tape is shrunk to a 20×40 **gauge** in the mark (level bands, one tick per floor, a diamond where work waits, a bug that rolls during travel), and inside the picker it becomes the left edge of the panel. There is no separate tall PFD panel. |
| floors V2 Lift | The car panel: a grouped list of real buttons, Org on top and You at the bottom, with a call lamp per floor. Inline why and who under a closed floor. | No doors and no flaps. Lamps follow the light language: **bloom** (lit, something waits), **ember** (ring, something overdue), **held** (dashed, work is waiting but locked). Each closed floor gets **one useful action** ("Ask Priya Nair to add you back", "Tell me when it opens"), not just a reason. |
| floors V3 Sonar | The ping: a clip-path wavefront from the control reveals the new floor on a clone of the plane, with a ring in the target floor's colour. | Ease changed to `standard` so the front is visible as it crosses the screen; `out` finished most of the sweep in its first third. The water drift is phase-locked between the clone and the plane (Web Animations `currentTime`), so the swap has no jump. The ping starts at the gauge, not at a scope. |
| floors V5 Rack focus | The title resolving from blur (blur 16px → 0, scale 1.04 → 1). | **Sentence case, Jost 200, tight tracking** (V4 Rotary's finding: long names read better). It is generated from data: level, direction and origin ("Up from Platform"), who sees it (count plus two names), what needs you, and up to three items. It **fades out where it is**, and the floor racks into focus at the same moment, so there is one focus pull, not a blur-sharpen-blur pump. |
| Light language | **Horizon:** the floor's own high colour as one line of light at the top of the bottom band, swept in by the ping. **Bloom, ember, beacon, shadow** (hatch), **dark** (an empty "Needs you · 0" heading is unlit). | In an app that ignores floors the horizon goes **neutral** (navy water, grey line), so floor colour is only spent where floors mean something. |

## Where I challenged the brief

1. **The letterbox is not the default arrival.** PDR-009 reserves the 2.39:1
   frame for urgent and important things. A floor change that someone makes
   ten times a day is neither, and letterboxing every arrival would teach
   people to ignore the frame. So the arrival card is an *establishing title*
   with no bars. It escalates to the letterbox **only when the floor you
   arrive on holds something urgent**. The urgent item then sits in the bottom
   bar with `Enter open it` and `Esc later`, and Enter pulls focus to that row
   (it blooms and its neighbours step back). The demo shows both.
2. **The full card plays only on a first visit per session** (`DATA.card`).
   After that, arrival is a **quiet caption** under the mark, sharpening from
   blur and fading out, along with the horizon and the gauge roll. This
   answers round 1's "people who switch floors many times a day will hate it".
3. **PgUp/PgDn collide with scrolling.** Artifacts is a document app, and
   global PgUp/PgDn already scroll pages. Here, with the picker closed,
   they travel only when focus is on the mark or nowhere; `Alt+PgUp/PgDn`
   travels from anywhere. In the shipped app, a scroll container with focus
   must win. My recommendation is `Alt+PgUp/PgDn` as the documented shortcut.
4. **"Above" and "below" within a level are arbitrary.** Traffic counts follow
   the directory's stable order, so Research Guild sits "above" Platform. That
   is honest only if the order is visible, which the gauge and the picker both
   show. The directory needs a rule for ordering within a level (my pick:
   the order you joined, which you can change).
5. **Click travels; keys choose then travel.** V2 needed two clicks. A pointer
   is already a precise choice, so one click travels. Keys still select first,
   because arrows are for looking.

## Refined spec: Aerie kit parts

### `FloorMark` (resting control, in the band at top left)
- Anatomy: `gauge | level eyebrow + floor name | traffic ▲ n / ▼ n | chevron`.
  Height `--target-md`. Name truncates with a title. Traffic uses diamonds in
  each waiting floor's colour; a zero row dims to 45% (dark cockpit).
- Gauge: one tick per floor in directory order, level bands in level colour,
  a diamond where work waits, dotted for *left*, warning-dashed for *locked*,
  and a bug (window) on the current floor. During travel the bug rolls
  (`--x-travel-roll`, `--ease-spring`). Past about 12 floors, draw ticks only
  for floors with waiting work plus the current one.
- States: `rest`, `open` (aria-expanded, border in floor colour), `travelling`
  (bug rolling), `captured` (one ring flash, `--motion-calm`), **`inert`**
  (desaturated, 62% opacity, eyebrow "Floor not used here", the name kept, a
  "Same on every floor" note; click, `F` or `PgUp/PgDn` show the reason
  popover with the apps that follow floors).
- A11y: a real `button`, `aria-haspopup="dialog"`, and a label that speaks the
  floor, level and traffic. `aria-controls` switches to the reason popover when
  inert.

### `FloorPicker` (car panel)
- Groups per level (Org → You) with the level icon and plural label. Each row
  is `tape tick | name (+HERE) / audience · needs · urgent kind | lamp + count`.
- Closed rows stay in place (`aria-disabled`, `aria-describedby` to the
  reason) and show their kind inline ("You left · 14 Oct", "Locked · until
  22:00 · 2 held"). When selected, a dashed block holds **why**, **until**,
  **who**, and **one action**. Enter on a closed row is refused: the row shakes
  (`--motion-slow`), the reason flashes, and the header says "Can't go there".
- Opens with a clip-path unroll from the mark (`--motion-slow`). The shell
  plane racks out using the `focus-far` tokens. While travelling, only the rows
  on the path stay lit and the others drop to 28% (navigation path).
- Keyboard: roving tabindex; `↑↓ PgUp PgDn Home End Enter Esc`. Focus returns
  to the mark on close.

### `FloorTravel` (transition), in tokens

| t (ms) | what | token |
|---|---|---|
| 0 | Enter: target lamp registers, path lit | `--x-travel-register` (= `--motion-quick`, 160) |
| 160 | picker collapses; plane stays racked | `--motion-slow` |
| 160 | ping wavefront from the gauge, clip-path on a plane clone; ring in target colour | `--x-travel-ping` (= `--motion-run`, 1200), `--ease-standard` |
| 160 | gauge bug rolls | `--x-travel-roll` (= `--motion-spin`, 900), `--ease-spring` |
| 760 | (first visit) title starts resolving | `--x-title-lead` (= run × .5) |
| 1360 | commit: plane becomes the new floor, clone removed, ring flash on mark | `--motion-calm` |
| 1960 | title readable | `--x-title-resolve` (= `--motion-run`) |
| +dwell | title stays | `--x-dwell-arrival` (2400) / `--x-dwell-arrival-urgent` (4000) |
| end | title fades where it is; plane racks sharp | `--motion-calm` |

Repeat visit: the same up to commit, then the caption is held for
`--x-dwell-quiet` (1600). Time from Enter to a usable floor is about 1.4s,
and any key or click dismisses the card early.

**Reduced motion (fixed properly).** JS reads two kinds of time.
`motion(token)` becomes `--x-crossfade` (240) under reduced motion, and
`dwell(token)` is never shortened. The ping becomes a plain crossfade of the
clone. The title fades in sharp (no blur, no scale) and stays for the full
dwell, then fades. Because blur can't ease when it's turned off, the card
fades *first* and the plane comes sharp *after* it, so a sharp, busy plane
never sits under the card. The dwell tokens are registered `<time>`
properties, so `calc()` resolves and the kit's 1ms rule can't touch them.

### `AreaTitleCard`
Input: `{floor, from, direction, audience{count,names}, waiting[], urgent?}`.
Output: eyebrow (level icon · level · Arrived · ↑/↓ from X), name, floor-colour
rule, who sees it, what needs you (bloom, or an unlit ring when clear), and up
to three items. With `urgent` it adds the letterbox bars: top "Needs you now ·
floor · Esc later", bottom the item with "Enter open it". Live region: one
sentence with the floor, level, audience, needs and the urgent item.

## Data the shell must provide
- **Directory:** the person's floors in a stable order with level, name,
  audience count and two sample names, plus the within-level ordering rule.
- **Membership state:** `left` with date, who can re-add, and a request
  endpoint.
- **Floor locks** (from the updater): reason, until (absolute time plus
  "about 3 h"), who can unlock, a "notify me" subscription, and a **held**
  count of waiting items behind the lock.
- **Waiting counts per floor, for every floor**, not only the current one,
  with an `urgent` flag (overdue, security). This comes from events.
- **Manifest flag `followsFloors`** per app, plus the list of apps that follow
  floors (for the inert explanation).
- **Session memory** of floors already visited (first-visit card).

## Remaining risks
1. **Top risk: waiting counts for every floor.** The mark's traffic, the lamps
   and the "held" count all need a cross-floor, per-person aggregate kept live
   from events. That is a new service query and a privacy question (a locked
   floor's "2 held" leaks that work exists). If it lags, the dark cockpit
   lies.
2. Urgent escalation inside travel could be abused: if every app flags things
   urgent, every arrival is letterboxed. The shell must cap it (one beacon
   platform-wide, as the light language already says).
3. The gauge is a 20×40px instrument. It is legible at 1× only as a pattern,
   not as numbers. Test with people; it may need to be 24px wide.
4. A clone of the whole plane for the ping is fine for this shell but costly
   for a heavy app DOM. Ship it as a snapshot layer (or a captured bitmap)
   rather than `cloneNode`.
5. `backdrop-filter` plus a full-plane `filter: blur` during the ping is two
   blur passes. That is fine on desktop GPUs; low-end laptops need checking.
6. Within-level "above/below" (challenge 4) still needs Harry's call.

## Tokens needed (all `--x-*` in the file, top of `<style>`)
- `focus-far-blur` 6px, `focus-far-saturate` .55, `focus-far-scale` .995,
  `focus-far-dim` .72. These are the same four that grammar and floors asked
  for; one set for the whole shell.
- Motion: `travel-register` (quick), `travel-ping` (run), `travel-roll`
  (spin), `title-lead` (run × .5), `title-resolve` (run), `title-blur`
  (space-4), `crossfade` (base).
- **Dwell (new category):** `dwell-arrival` (title), `dwell-arrival-urgent`
  (title + shimmer), `dwell-quiet` (shimmer). Recommend a `dwell-*` family in
  `common` tokens and moving `--motion-title`/`--motion-toast` there.
- `hatch` (locked pattern).
- Still literal: 1px and 2px hairlines and the gauge's SVG geometry
  (a `--hairline-width` token would cover them). `--font-mono` is still not a
  token and needs an ADR.

## Scores
Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

Clarity loses a point for the 1× gauge and for the arbitrary within-level
order. Feasibility loses a point for the per-floor waiting aggregate and the
plane snapshot. Fit is the strongest of the floor work so far: calm at rest,
one focus pull per move, light spent only on meaning, and the letterbox kept
for what is actually urgent.
