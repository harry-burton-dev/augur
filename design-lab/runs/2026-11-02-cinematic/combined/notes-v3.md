# Combined V3: the urgent path (PDR-009 letterbox, end to end)

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
