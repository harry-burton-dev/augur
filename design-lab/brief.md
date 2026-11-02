# Design lab brief

Every run reads this first, then its prompt. It keeps what made the
cinematic run (`runs/2026-11-02-cinematic/`) work: Harry's own
principles treated as the spec, named real-world references with "what to
take from each", strict token-only prototypes, six genuinely different ideas
per surface, an honest scored critique, a second round that combines the
winners, and a ranked shortlist that also says where it pushes back on Harry.

## What AUGUR is
An app platform: a shell in the browser hosting apps. Dark, calm and
deliberate: slate ground, glowing "water" of navy and green bands on the
shell's own screens, Jost type with wide tracking for titles, glass panes.
Harry (owner and designer) wants to stray from generic AI/SaaS design and
ground every idea in a real technique from outside software. These are
**explorations**: standalone HTML prototypes, no repo changes, no PRs.

## Build on what already won
The cinematic shortlist (`runs/2026-11-02-cinematic/SHORTLIST.md`) is the
current direction. New ideas must sit alongside it, not replace it:
- the **light language** (streak, bloom, shadow, beacon) and four **focal
  planes** (`runs/2026-11-02-cinematic/grammar/`, `focus/`);
- the **right-click radial menu** with fixed directions and a consequence
  preview (`combined/v2-artifacts-in-focus.html`);
- the **urgent path and Letterbox** (`combined/v3-urgent-path.html`);
- "dark when normal": at rest nothing moves or calls for attention.
Read those three combined screens before you start. Where your idea
conflicts with one, say so in the critique.

## Harry's principles (the spec)
1. **Letterbox for urgent and important (PDR-009, Accepted):** a 2.39:1
   frame from `--letterbox-ratio`, bars from `--scrim` gradients, nothing
   outside the frame hidden for good.
2. **Depth and focus stacking:** focus pulling, rack focus (blur and
   desaturate the far plane, no black scrim), the lit navigation path.
3. **Explain, never hide:** anything unavailable stays visible, looks
   unavailable and says why and who can change it.
4. **Many deployments:** names, labels and counts come from data. Put sample
   data in one JS object at the top of the script.
5. Desktop only. Design for 1600×900 and 1280×800.
6. Calm: nothing loops or calls for attention when all is normal.

## AUGUR vocabulary (as people see it)
- Floors: **You**, a **Department** (lavender, `--floor-department-*`), a
  **Team** (amber, `--floor-team-*`), the **Org** (blue, `--floor-org-*`).
  You = green/navy. Moving between floors is "floor travel" (up = towards Org).
- Platform apps: Home, Admin, Upgrade Centre, Explorer. Pillar apps:
  Artifacts (documents, libraries, collections), Mandate (intents: what the
  org has asked for), Data Atlas (entities and facts, triage of proposals).
- Shell: Title, Orbit, top band, Glance, toasts, approvals.
- Things that "need you": an approval, a disputed fact, an upgrade waiting
  for its window, a failed sync, an intent past its deadline, a share
  request, a security notice.
- Never write "IM platform", "platform" or code names (Folio, Auspex) in
  anything a person reads.

## Hard rules for every prototype
- Work in `runs/<date>-<slug>/<surface>/` and link the shared kit exactly:
  `<link rel="stylesheet" href="../../../_kit/tokens.css">` and
  `<script src="../../../_kit/icons.js"></script>`.
  `_kit/build.py` inlines both into a standalone copy for publishing.
- Also read the earlier runs' `concepts.md` and `concepts/README.md`, so
  you know what has already been explored.
- Colours, durations, distances, radii, type sizes only from the CSS
  variables in `tokens.css`. Combine them (`calc()`, `color-mix()`,
  opacity) but never a new hex colour or magic ms value. A genuinely new
  token goes at the top of your `<style>` as `--x-proposed-name: <value>;`
  with a comment, and is listed in the critique as "needs token".
- Fonts: `var(--font-sans)` (Jost) and `var(--font-mono)` (IBM Plex Mono;
  still needs an ADR, so flag reliance on it).
- Icons only from Lucide via `<i data-lucide="name"></i>` or
  `Icons.svg('name',{size,stroke})` with literal names; call
  `Icons.hydrate(el)` after rendering from JS. Never hand-write icon SVG.
  SVG for data (charts, contours, strata, waveforms) is fine.
- No external network: no CDNs, no fetched images, fonts or audio. Plain
  HTML/CSS/JS, no frameworks.
- Motion from the motion tokens; honour `prefers-reduced-motion` with a
  crossfade fallback; loops stop on reduce.
- Caption on every page: `<div class="x-cap"><b>Surface · Vn</b> idea in a
  few words · sources</div>`.
- Each prototype shows its moment after ~1.2 s on load (so a screenshot at
  ~3 s shows it) and replays with `R`. Visible keyboard hints for the rest.
- Accessibility: focus rings (`--focus`, `--focus-ring`, `--focus-gap`),
  real buttons, text contrast from the token notes.

## Checking your work
Render each page and look at it:
`node ../../../_kit/shot.js file://$PWD/<file>.html /tmp/<name>.png 1600 900 3500`
then read the PNG and fix what looks wrong. Check 1280×800 too. Fix all
console errors.

## Critique format (`notes.md` in each surface folder)
For each variant: **Vn: name**; *Idea* (2-3 sentences); *Sources*; *What
works*; *What fails or risks* (legibility, load, gimmick, cost on large
DOMs, a11y, annoyance over a full working day); *Principles* (letterbox,
focus stacking, explain-never-hide, calm); *Needs* (tokens, kit parts, data
the shell doesn't have); *Score* 1-5 for Clarity, Distinctiveness,
Feasibility in the React kits (Aerie for the shell, Quill for apps), Fit
with AUGUR's calm water language. End with a ranked list and one paragraph
"what I'd build first".

## Shape of the run
1. Grammar first: one or two reference sheets that name the vocabulary
   (the cinematic run had a shot list and a light language).
2. Round 1: the surfaces in your prompt × 6 variants, each pushed to a
   distinct idea, each critiqued.
3. Gallery: `index.html` with screenshots and links to every critique.
4. Round 2: combine the strongest into 3-4 screens that could ship.
5. `SHORTLIST.md`: ranked build order, options worth keeping, ideas not
   worth pursuing, where it pushes back on Harry's principles, gaps
   (tokens, decisions), and data the shell doesn't have yet.
6. `concepts.md`: the new high-level concepts this run found, each with a
   name (kebab-case slug), one paragraph, the evidence (which variants and
   sources), and the future run it could steer. Then update `concepts/`.
7. Refill `prompts/` if it holds fewer than four (see README: three
   steered prompts and one wildcard per batch).
8. Publish the built gallery for Harry to view.
