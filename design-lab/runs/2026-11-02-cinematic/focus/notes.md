# Focus: depth and focus across an app (six explorations)

Test bed: the Artifacts app (rail with app tile, centre list, About panel; toolbar: search, Filters, Sort, Add). Every page has an FPS meter (frame-time histogram, worst frame and slow frames during the last transition, DOM node count), an auto-demo after about 1.2 s, and `R` to replay.

**About the numbers.** I measured in headless Chromium, which draws with the CPU (SwiftShader) and has no GPU. Treat the absolute numbers as a worst-case low-end machine. Only the ratios between methods mean anything. Before anything ships, Harry should re-run the bench buttons in V1 and V5 on a real laptop.

| Bench (10 racks of the inspector drawer) | avg frame | p95 / worst |
|---|---|---|
| V1 `filter` on one plane wrapper | 83 ms | 233 worst |
| V1 `backdrop-filter` veil | 105 ms | 283 worst |
| V1 filter on each item | 58 ms (but see V1) | 167 worst |
| V5 light + parallax (no filter) | 28 ms | 50 / 117 |
| V5 blur + saturate | 41 ms | 67 / 83 |
| V5 light, DOM ×10 | 28 ms | 50 / 83 |
| V5 blur, DOM ×10 | 45 ms | 83 / 100 |

What the numbers say:
1. Blur costs depend on **pixel area × blur radius**, not on DOM size. Ten times more rows (clipped) barely moved the result. The real enemy is a large blurred area that has to be re-rasterised every frame, which happens when something inside it animates (a caret, a spinner, the water).
2. One `filter` on a single plane wrapper beats a `backdrop-filter` veil. The veil re-samples everything beneath it on every frame, and if the far plane contains glass panes, those nested backdrop-filters multiply the cost.
3. Filtering each item looked cheaper on paper, but it is wrong. It misses anything not in the selector list (the "Recent" heading, the ground plane and the drawer all stayed sharp in V1's per-item mode). Each item also blurs inside its own box, so edges clip, and there are hundreds of layers. Don't do it.
4. Light (opacity + scale + a moved gradient) cost about 35 to 40 % less than blur and stayed flat as the DOM grew.

Mitigations used or recommended:
- **Filter on one wrapper per plane.** Never per item, and never as a backdrop veil.
- **`will-change` only while racking.** `rack()` adds `.racking` (which sets `will-change: filter, transform`) and removes it after `--motion-rack` + `--motion-quick`. Leaving it on permanently holds GPU memory for every plane (V1 lets you compare during / always / never).
- **`translateZ(0)` on planes** so each plane is its own compositor layer.
- **Freeze the far plane.** While a plane is out of focus, pause everything that animates inside it (carets, pings, live counters, the water drift). The browser then rasterises the blurred plane once and composites it. This is the practical form of "snapshotting the far plane". A true bitmap snapshot (canvas `drawImage` of DOM) is not available in browsers without a library like html2canvas, and that would be a new dependency (ADR).
- **Fall back to light on low-end devices.** Use the V5 technique when `navigator.hardwareConcurrency` is low, a frame-time probe fails, or the person turns it on in settings (see tokens below).
- **Clone to sharpen** (V4, V6). A child of a blurred wrapper can't be un-blurred, so a target that must be sharp gets a copy laid over its original on the near plane. That is one small layer instead of many filtered ones.

---

## V1: Focal planes as a system (`v1-focal-planes.html`)
*Idea.* There are four named planes: **Ground** (water, ambient notices), **Work** (the app), **Active** (inspector drawer, command palette) and **Decision** (dialog). Each plane's depth is its distance from the focal plane: 0 is sharp, 1 is far, 2 is deep, and the ground at rest sits at "near" (softly out of focus). Pressing I, K or D moves the focal plane. A LENS instrument panel shows a depth tape with the live blur, saturation and scale of every plane. It has sliders mapped to the proposed tokens, rack-speed detents, a method switch (filter / backdrop / per item), a will-change policy, a bench and a live `:root{}` token readout.
*Sources.* Cinema depth of field and rack focus; avionics altitude tape; Rams detents; Eurorack attenuators.
*What works.* It makes Harry's principle a *system*: one rule (depth = distance from focus), so the drawer → dialog stack resolves without special cases (ADR 0015's "rule, never a special case"). Clicking the blurred plane racks back to it instead of activating controls you can't read. The lens panel makes tuning a shared, inspectable act, and its output is a token block.
*What fails or risks.* Two blurred planes plus a glass drawer is the most expensive scene on the page (worst frames were 100 ms+ on CPU raster). At deep blur with brightness .74 the rail is close to unreadable. That is fine for a modal decision, but it would be wrong for anything you need to cross-check (e.g. "which document am I publishing?"). The dialog therefore names the document instead of relying on the backdrop.
*Principles.* Focus stacking: core. Explain-never-hide: the disabled Delete says why and who can change it. Letterbox: not used here (V6).
*Needs.* The focus tokens below. A kit `FocusStack` that owns the plane order, `rack()`, inert and Esc. A shell rule that only one surface per plane can be open.
*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 5

## V2: The lit path (`v2-lit-path.html`)
*Idea.* Library → collection → document opens **in place** in one tree. A glowing trail (a fibre-optic line) runs from the library's icon through each step to the open document card. Nodes off the path dim by how far back up the path they are: options under the current node stay bright, siblings dim one step, and siblings of ancestors dim further and soften. Ancestors on the path are `position: sticky` at stacked offsets, so when you scroll, the path pins itself at the top. **The breadcrumb is the lit path itself.** ← / Backspace walks back and the light retracts. The rail item you came from is lit too.
*Sources.* Harry's navigation-path principle; Tufte layering and separation; FUI light traces; Territory's thin rules.
*What works.* This was the strongest single moment in the set. You always see where you are without a separate breadcrumb, and the dimming is information (distance), not decoration. It is cheap: opacity on rows, small blur only at distances 2 and 3, and an SVG path with a dash-offset draw-on.
*What fails or risks.* Dimmed rows are still interactive, and at `--path-dim-3` (.3) their text fails contrast, so hover and focus always restore full opacity. Even so, a screen-reader user gets no "dimmed" meaning, so `aria-current="location"` and the tree's `aria-expanded` have to carry it. Sticky ancestors eat vertical space on deep trees (cap at 3 pinned levels, then collapse the middle into "…"). The trail must be recomputed whenever layout changes.
*Principles.* Focus stacking (navigation path): core. Explain-never-hide: the restricted "People" collection stays visible with a lock and "ask the People team admins".
*Needs.* `--path-dim-1..3` and `--path-soft` tokens; a kit `PathTree` (tree + trail + sticky ancestors); tree data with counts from the registry.
*Scores.* Clarity 5 · Distinctiveness 5 · Feasibility 4 · Fit 5

## V3: Reader focus (`v3-reader-focus.html`)
*Idea.* When reading, F turns on reader focus. The paragraph you're on sits on a focal line (`--focal`, 50 %) and is sharp. The others soften by distance (1.2 px of blur and 22 % opacity per paragraph, capped at three). A gauge tape in the gutter marks the paragraph number. Margin notes sit on their own plane, racked behind. N racks focus between text and notes, like a film rack between two characters, and the note anchored in the current paragraph is outlined. L adds a 2.39:1 letterbox for deep reading.
*Sources.* Teleprompters, Spritz/RSVP, cinema rack between two subjects, avionics tape.
*What works.* The rack between text and notes feels exactly like the cinema idea, and it is the clearest demonstration of "rack, don't scrim". The focal line keeps your eye still while the text moves, which is calmer than scrolling.
*What fails or risks.* **Blur-induced eye strain** is real here: the eye keeps trying to resolve the soft paragraphs in peripheral vision, and over a long read that is tiring. Opacity-only (no blur) is probably the right default for reading, with blur as an opt-in. Scroll-jacking with the wheel is contentious, and trackpads produce many small deltas. Reduced motion: the kit forces durations to 1 ms, so the text jumps per paragraph, which is acceptable. Search-in-page and selection across paragraphs fight the effect. It must be off by default.
*Principles.* Focus pulling (ambient notes out of focus), letterbox (deep read).
*Needs.* `--read-soft`, `--read-fade`; a reading-mode preference stored per person; note anchors in the document model.
*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V4: The palette is a lens (`v4-palette-lens.html`)
*Idea.* The command palette is a foreground lens. Its top is a lens-barrel distance scale (Rail · Tools · List · About · ∞) whose index and ticks turn as you move through results. Each result racks its **target** into focus where it lives in the blurred app: a sharp copy sits over the original, with a dotted leader line from the result to it. The palette steps to the other half of the screen so it never covers what it is focusing on. Unavailable commands focus their target in amber and say why ("Needs the Org publisher role. Ask A. Mensah.").
*Sources.* Camera focus ring and distance scale; Make It So's "transparency for context"; Bloomberg keyboard-first.
*What works.* It teaches the app's geography: the palette doubles as a map of where things are, so people learn the slower path too. The amber case is a good way to explain without hiding. Cloning keeps one filtered wrapper.
*What fails or risks.* The palette jumping between top and bottom is disorienting if it happens every keystroke. It should only move when the selection rests for `--motion-base`. Targets that are off-screen (inside a collapsed panel or another app, "∞") have nothing to show, so they need a placeholder. Cloning only works for self-contained elements, and anything stateful (inputs, canvases) copies badly.
*Principles.* Rack focus attenuation, explain-never-hide.
*Needs.* Commands in the manifest must declare a target (`where` + element role). A kit `Palette` with a `previewTarget` slot. Possibly an `--focus-index` colour role.
*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V5: Depth by light and parallax, not blur (`v5-light-parallax.html`)
*Idea.* The same drawer and palette, but the far plane is never filtered. It loses opacity (.72), shrinks (.995) and drifts slightly against the pointer, while the near surface drifts the other way. A light pool (a big radial gradient that moves by transform, never repainted) centres on the focal surface and lets the rest fall into shade. B swaps to blur for an A/B comparison, and "Bench both" measures the two.
*Sources.* Stage lighting, Rams, the avionics "dark cockpit".
*What works.* It is about 35 to 40 % cheaper per frame, stable as the DOM grows, and the far plane stays **legible**: you can still read the list behind the drawer, which matters for cross-checking. It fits AUGUR's water language (light through water) better than optical blur does.
*What fails or risks.* Depth is weaker in a still screenshot, since parallax only reads in motion. Pointer parallax can trouble people with vestibular sensitivity, so it is off under `prefers-reduced-motion` (done) and should be a setting. A dark falloff close to slate can read as a vignette effect if overdone.
*Principles.* Focus stacking without the cost; it is the low-power and accessibility tier of the same system.
*Needs.* `--light-falloff`, `--light-pool`, `--focus-far-fade`, `--parallax-far`; a shell capability flag (`focus.quality: blur | light`).
*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 5

## V6: Escalation focus pull (`v6-escalation-pull.html`)
*Idea.* A dark cockpit: "Needs you" sits soft in the rail while things are normal. While you type in a draft, an approval escalates. The rail item gets an amber outline and one ping, and the status line says **"waiting for a pause"**. Only after `--focus-idle-wait` (1.2 s) of no input does the camera pull: the work plane softens over `--motion-pull`, the rail item lifts out sharp, and a tethered card explains who is asking, why and the countdown. Enter opens the decision in a **2.39:1 letterbox** (scrim-gradient bars, the app still visible and deep-blurred). Acting releases focus with a toast and the count drops. "Not now" puts it back in the rail, still amber and marked "snoozed · 10 min" (it is never hidden).
*Sources.* Master caution annunciators; Make It So's countdowns; PDR-009 letterbox; Harry's focus-pulling principle.
*What works.* It has the full grammar of escalation: ambient, then armed, then pulled, then deciding, then released. It respects the person's flow by never pulling mid-keystroke. The letterbox makes a 14-minute decision feel like a scene, not a modal.
*What fails or risks.* An involuntary focus change is an accessibility hazard (WCAG 3.2.x). The pull must not move keyboard focus into the card unless the person was idle and is not using a screen reader; announce via `aria-live` first. **Pull budget:** if two escalations compete, only the most urgent pulls and the rest queue as amber lamps, otherwise it becomes an alarm clock. The countdown amplifies stress, so show it only when there really is a deadline.
*Principles.* All three: focus pulling, letterbox for urgent and important, explain-never-hide (the snoozed state stays visible).
*Needs.* `--focus-idle-wait`, `--motion-pull`; an escalation level on notifications (ambient / armed / pull) from the events service; a shell rule that only the shell, never an app, may pull.
*Scores.* Clarity 5 · Distinctiveness 5 · Feasibility 4 · Fit 5

---

## Challenges to the principles (honest)
- **Blur is a cost and a strain, not a free hierarchy.** Use it for short, modal moments (drawer, palette, dialog, decision). Don't use it for long states (reading, background notifications). For long states, use light/opacity (V5) or distance dimming (V2).
- **The 0.995 scale is right.** It is barely perceptible but sells the refocus. Going below .99 starts to look like a zoom transition. Keep `deep` at .99 maximum.
- **Dimmed is still interactive.** Every dimmed thing must restore on hover/focus, keep its role and name, and clicking a blurred plane should rack back to it, never activate a control you can't read (V1, V5, V6 all do this).
- **Reduced motion.** The kit forces 1 ms transitions, so racks become instant cuts. That is acceptable, but drop the scale and parallax under reduce (done) and consider defaulting to the light tier.
- **No black scrim, but keep a brightness drop.** A brightness of .8 on the far plane (not a black layer) was needed for contrast against glass surfaces. It is still "stripping detail", not hiding.

## Ranking
1. **V2 Lit path:** the most distinctive and cheapest, and it answers navigation and the breadcrumb in one move.
2. **V6 Escalation pull:** the clearest call to action, using all of Harry's principles together, with the "wait for a pause" rule.
3. **V1 Focal planes:** the system and the tuning tool; the foundation the others sit on.
4. **V5 Light and parallax:** the necessary low-power and accessibility tier; legible far plane.
5. **V4 Palette lens:** delightful and teaches geography, but needs manifest data and careful motion.
6. **V3 Reader focus:** lovely rack between text and notes, but eye strain makes it opt-in only.

## What I'd build first
I'd build V1's focal-plane rule as a small kit primitive first: a `FocusStack` provider that owns the plane order (ground / work / active / decision), applies one filter per plane wrapper with `will-change` only while racking, sets `inert` and Esc behaviour, and reads a `focus.quality` setting so the same API renders blur or V5's light tier. Every surface (drawer, palette, dialog, approvals) then gets correct depth for free, and the tokens below become the only knobs. The second step is V2's lit path in the Artifacts tree, because it needs only opacity and an SVG trail and gives the biggest visible change for the least risk. V6's escalation pull comes after that, once the events service can mark an item "pull".

## Proposed focus tokens (proposals, not in the kit; "needs token")
```css
:root {
  /* planes */
  --focus-near-blur: 2px;        /* ambient/ground plane at rest */
  --focus-near-saturate: .8;
  --focus-far-blur: 8px;         /* one plane behind focus */
  --focus-far-saturate: .55;
  --focus-far-dim: .82;          /* brightness(); no black scrim */
  --focus-far-scale: .995;
  --focus-deep-blur: 14px;       /* two planes behind */
  --focus-deep-saturate: .3;
  --focus-deep-dim: .74;
  --focus-deep-scale: .99;
  /* light tier (no filter) */
  --focus-far-fade: .72;         /* opacity of the far plane */
  --light-falloff: .88;          /* alpha of slate-deep at the pool's edge */
  --light-pool: var(--measure-wide);
  --parallax-far: var(--space-2);
  /* paths and reading */
  --path-dim-1: .64;
  --path-dim-2: .44;
  --path-dim-3: .3;
  --path-soft: .6px;
  --read-soft: 1.2px;
  --read-fade: .22;
  /* motion */
  --motion-rack: var(--motion-slow);    /* 320ms: drawer, palette, dialog */
  --motion-pull: var(--motion-calm);    /* 600ms: escalation pull */
  --focus-idle-wait: var(--motion-run); /* 1200ms quiet before a pull */
}
```
Also flagged: `--font-mono` (IBM Plex Mono) is used for eyebrows and numerals and still needs a token and an ADR. Hairline borders use a literal `1px`, because there is no border-width token.
