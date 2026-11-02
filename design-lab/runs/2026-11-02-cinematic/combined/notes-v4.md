# Combined V4: floor control and floor travel, as they should ship

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
