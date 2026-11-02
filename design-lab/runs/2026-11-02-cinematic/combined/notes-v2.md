# Combined V2: Artifacts in focus

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
