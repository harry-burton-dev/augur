# Cinematic UI explorations: shared brief

AUGUR is an app platform (a shell in the browser hosting apps). It is dark,
calm and deliberate: slate ground, glowing "water" of navy and green bands
on the shell's own screens, Jost type with wide tracking for titles, glass
panes. Harry (owner and designer) wants to stray from generic AI/SaaS design
and use cinematic and instrument-panel ideas to build visual hierarchy,
focus attention and call people to action. These are **explorations**:
standalone HTML prototypes, no repo changes, no PRs.

## Harry's principles (treat as the spec)
1. **Letterbox for urgent and important (PDR-009, Accepted):** "Urgent and
   important information use a cinematic, hyper-focused letterbox (2.39:1
   widescreen viewport) to eliminate peripheral clutter." Ratio from
   `--letterbox-ratio`, bars from `--scrim` gradients (never a solid black
   block). Nothing outside the frame is hidden for good: it steps back.
2. **Depth and focus stacking:** don't fight for 2D space; use shallow depth
   of field and layers.
   - *Focus pulling:* ambient items (read-only docs, minor notifications) sit
     softly out of focus. When something escalates to "needs action", the
     camera pulls focus to it and pushes the rest into blur.
   - *Rack focus attenuation:* when focus moves to an active surface (drawer,
     dialog, command palette), no abrupt black scrim. The layout stays in
     place; the out-of-focus plane loses fine detail and saturation:
     `filter`/`backdrop-filter: blur() saturate()`, `will-change`,
     `translateZ(0)`, and a slight shrink (`scale(.995)`) on the far plane
     as if the lens refocused closer.
   - *Navigation path:* open an item in place and dim its neighbours, so only
     the path you took is lit.
3. **Explain, never hide:** anything unavailable stays visible, looks
   unavailable and says why and who can change it.
4. **Many deployments:** names, labels, counts come from data. In prototypes
   put sample data in one JS object at the top of the script, never scattered
   literals.
5. Desktop only (no phone layout yet). Design for 1600×900 and 1280×800.

## AUGUR vocabulary (as people see it)
- Floors: **You**, a **Department** (lavender, `--floor-department-*`), a
  **Team** (amber, `--floor-team-*`), the **Org** (blue,
  `--floor-org-*`). You = green/navy. Each floor has `-high` and `-low`
  colours. Moving between floors is "floor travel" (up = towards Org).
- Platform apps: Home, Admin, Upgrade Centre, Explorer. Pillar apps:
  Artifacts (documents, libraries, collections), Mandate (intents: what the
  org has asked for), Data Atlas (entities and facts, triage of proposals).
- Shell: Title (all apps), Orbit (an app's groups), top band (floor mark top
  left, Home and All apps buttons, app name under a look-up handle), Glance,
  toasts, approvals (level-3 overlay).
- Typical things that "need you": an approval (publish a document to a
  department), a disputed fact in Data Atlas, an upgrade waiting in a
  maintenance window, a failed sync, an intent past its deadline, a share
  request, a security notice.
- Never write "IM platform", "platform" or code names (Folio, Auspex) in
  anything a person reads.

## Harry's references and what to take from each
- **Territory Studio** (Blade Runner 2049, The Martian, Dune): restrained
  monochrome with one alert colour, thin rule lines, numbered segments,
  telemetry strips at the edges, data that *states* things in short caps.
- **Pushing Pixels / FUI archive**: interviews with motion designers; type as
  instrument, layering and parallax, "the screen tells the story in 2s".
- **NASA Open MCT**: telemetry plots with limit lines (yellow/red bands),
  timeline tracks with swim lanes, "now" marker, stale-data marking.
- **Bloomberg Terminal**: dense, keyboard-first, no cards, amber on black,
  tick tapes, function-key mnemonics, every pixel carries data.
- **Tufte**: small multiples, sparklines, data-ink ratio, micro/macro reading,
  layering and separation, "1 + 1 = 3" (avoid accidental shapes).
- **Make It So** (Shedroff & Noessel): sci-fi tropes that work: glow for
  attention, transparency for context, countdowns for urgency, confirmation
  through motion. And what fails: unreadable overlays, decorative noise.
- **Avionics consoles** (glass cockpit PFD/ND, MFD soft-keys, master
  caution/warning annunciators, altitude tapes, "dark cockpit" philosophy:
  when all is normal the panel is dark; only abnormal things light up).
- **Braun / Dieter Rams**: less but better, rotary selectors with detents,
  discrete push-button states, one orange/green accent, honest materials.
- **Eurorack modular synths**: patch cables as routing, LED level meters,
  attenuators, jack rows, modules in a rack of equal heights (HP widths).
- Nightly research covers one source at a time; **you go broader**:
  combine sources, and push each variant to a distinct idea.

## Hard rules for every prototype
- Link the kit exactly like this (paths are relative to your surface folder):
  `<link rel="stylesheet" href="../_kit/tokens.css">` and
  `<script src="../_kit/icons.js"></script>`.
  A build step inlines both later, so keep those two tags exactly.
- **Colours, durations, distances, radii, type sizes only from the CSS
  variables** in `_kit/tokens.css` (read it). You may combine them
  (`calc()`, `color-mix()`, opacity) but never introduce a new hex colour or
  a magic ms value. If a design truly needs a new token, define it at the top
  of your `<style>` as `--x-proposed-name: <value>;` with a comment, and list
  it in the critique as "needs token".
- Fonts: `var(--font-sans)` (Jost) and `var(--font-mono)` (IBM Plex Mono, not
  yet a token; flag it if you rely on it).
- **Icons only from Lucide** via `<i data-lucide="name"></i>` or
  `Icons.svg('name',{size,stroke})` (use literal string names so the build
  can subset them; after rendering markup from JS call `Icons.hydrate(el)`).
  Never hand-write icon SVG. SVG for *data* (charts, ticks, rings, tapes,
  cables) is fine.
- No external network: no CDNs, no images from the web. Plain HTML/CSS/JS,
  no frameworks.
- Motion: from the motion tokens; honour `prefers-reduced-motion` with a
  crossfade fallback. Loops stop on reduce.
- Every page has a caption: `<div class="x-cap"><b>Surface · Vn</b> idea in
  a few words · sources</div>`.
- Interactive where it matters: each prototype should show its *moment*
  (escalation, focus pull, opening the menu) either on load after a short
  beat or via a visible keyboard hint (e.g. "Press Space to escalate") and
  clicks. Put an auto-demo on load (after ~1.2s) so a screenshot after ~3s
  shows the interesting state, and make it replayable with `R`.
- Accessibility: focus rings (`--focus`, `--focus-ring`, `--focus-gap`),
  real buttons, text contrast from the token notes (ink, ink-muted 13px+).

## Checking your work
Render each page and look at it:
`node ../_kit/shot.js file://$PWD/<file>.html /tmp/<name>.png 1600 900 3500`
(args: url, output png, width, height, wait ms; prints page errors). Then
read the PNG. Fix what looks wrong. Also check 1280×800.
Fix all console errors.

## Critique format (write `notes.md` in your surface folder)
For each variant: **Vn: name**; *Idea* (2-3 sentences); *Sources* it draws
on; *What works*; *What fails or risks* (be honest: legibility,
cognitive load, motion sickness, gimmick, cost on large DOMs, a11y);
*Principles*: how it serves letterbox / focus stacking / explain-never-hide;
*Needs*: new tokens, kit parts, data the shell doesn't have yet;
*Score* 1-5 for each of: Clarity, Distinctiveness, Feasibility (in the
React kits Aerie/Quill), Fit with AUGUR's calm water language. Finish with a
ranked list for your surface and one paragraph "what I'd build first".
