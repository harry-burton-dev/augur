# Combined V1: Home, "what needs you", as it should ship

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
