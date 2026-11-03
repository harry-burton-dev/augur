# Combined · V4: One now line (`v4-one-now-line.html`)

An Org Home view, "Ahead", that puts two apps on one time axis with one now
line. **Mandate**: the intents you own or asked, as the intent ledger.
**Upgrade Centre**: the deployment's parts, as the worn inventory. Everything
older than now sits under one translucent water plane. The selected object
opens in a gauge panel on the right: a **staff gauge** for an intent, a
**pier** with the Preview forecast for an upgrade. The demo fills the water,
draws distances out from now and selects "Records retention in Artifacts"
1.2 s after load. `R` replays it. `#augur`, `#sso` and the other ids in the
URL pick the selected row.

Keys: `↑ ↓` rows, `Enter` reads it closer, `Tab` reaches every mark (each
answers "why, since when, who can change it"), `M` opens Move deadline,
`Esc` closes, `R` replays.

## What it combines
- **Intents V6 intent ledger** (rank 1): rows with effort water, a high-water
  notch, stale hatch, distance to travel, overrun, a shadow row and a done row.
  One now line is drawn by the board, not by each row.
- **Intents V2 staff gauge** (rank 2): in the panel. Time rises, the past is
  under water, and the dry staff above is the distance to travel. Each
  extension is a seam where a section was bolted on, and its old top stays as
  a line. An overdue intent's staff is fully under water, with the waterline
  above the cap, which reads "overrun" without a word.
- **Intents recommendation "a reason is required when a deadline moves"**:
  built. Every seam carries its reason in the why-pane. The Move deadline form
  keeps its Move button unavailable (dashed, and it says why) until there is
  a reason. On Move, the new seam appears on the row and the staff grows a
  section. A move made before the rule (`reasonRequiredSince`) shows a
  *dashed* seam: "No reason recorded. Moves after 1 Oct must carry one."
- **Upgrades V5 worn inventory** (rank 1): AUGUR, Artifacts, Explorer,
  Mandate and Servers. Change ticks (taller means bigger), the rollback
  **scar**, the repair **seam**, the missed-window **tide line**, an
  inferred change inside the gap (dashed tick), Server 5 stale, and the green
  dashed tick where Thursday changes the part.
- **Upgrades V3 tide almanac's forecast**: the pier. Past bakes are carved at
  their peak, the 3.1% high-water mark sits at 0.11.2, there are watch and
  halt lines, and 0.14.0's Preview peak is drawn dashed green as a *known
  tide ahead*. Maintenance windows run as faint bands across the whole board,
  and the next one is named under it.
- **Concepts from round 1:** *past-under-water* (intents), *one-now-line*
  (intents, grammar), *record-continuity* (upgrades), *forecast-from-upstream*
  (upgrades).

## What works
- **Distance compares at a glance.** Under a year the past is linear, so a
  week is the same width on both sides of now. Every dashed distance starts
  at the one now line, and a small ruler (+1w +2w +4w) hangs from it. All
  four upgrade parts travel the same 3 days to one window. The intents travel
  26, 32 and 40 days. "What lands first" is read as length, not by reading
  dates. The readout column says it in words for screen readers.
- **One water plane is cheaper and calmer than per-mark dimming.** The past
  is quieter through one absolutely positioned element (a navy gradient,
  deeper further back, and one `saturate(.7)` backdrop filter). No mark has
  its own "past" opacity. The rule is now physical: if it is under water, it
  is over. On 5,000 rows this costs the same as on 11.
- **Apps share a record and its edges.** The events-store move (a done intent
  in Mandate) *caused* the gap that crosses every row, including the
  upgrades. The gap band is drawn once for the whole board, the 0.12.0 bake
  has "no bake record", and Artifacts and Explorer show dashed inferred ticks.
  A cross-app view is where record continuity stops being a footnote.
- **Cross-app coincidences become visible.** The board shows that the
  Thursday window falls 3 days into the retention intent's last stretch. No
  single app would show that.
- **Missed and moved-early are different marks.** A deadline moved *after* it
  passed is a tide line (missed, stays for good). One moved *ahead* of time
  keeps a quieter hairline labelled "moved". Both stay; only one is a stain.

## What fails or risks
- **Light under water.** The overdue intent's overrun (green) and the needs-you
  bloom sit partly under the plane, which mutes exactly the thing that should
  call. The bloom survives because it lives on the name column, outside the
  plane. **Rule needed:** needs-you light is drawn above the water (on the name
  and readout columns, or above the plane's z-index), never inside it.
- **Seam vs. tide vs. scar at word size.** Three thin verticals with different
  dashes and colours. The key is essential, hover and Tab make each one answer,
  and in a bright room they will merge. The row is still readable because the
  big shapes (water, distance) carry the story.
- **The future is short on this axis.** Eight weeks ahead in about a third of
  the width. An intent due in March would clip. It needs either a range that
  grows to the latest deadline or a labelled scale break. That should not be a
  different curve for the future, or distances stop comparing.
- **Two apps, one sort order.** Intents sort by needs-you, then distance. Parts
  keep the Upgrade Centre's order. The list does not reshuffle after an edit
  (deliberate). A real "Ahead" view across six apps needs grouping rules,
  probably by app, as here.
- **The pier mixes scales.** Its vertical is error %, not time. It sits in the
  same panel as the staff gauge (time). They share the vocabulary (notch,
  high-water mark, forecast as a known tide) but not the axis. Say so in the
  label, as the panel does.
- **Permissions across apps.** The viewer sees intents (Mandate) and approves
  upgrades (Org admin). For a viewer with only one of those, the other section
  should stay visible as a shadow section that says who has access, not
  disappear. That is not drawn yet.

## Principles
- **Calm:** still at rest. Two blooms (overdue intent, approval before the
  window), within the cap of three.
- **Explain, never hide:** every mark is focusable and answers what, since
  when and who can change it. The shadow row says who to ask. The disabled
  Move button says what is missing. The record gap says it cannot be restored.
- **Focus stacking:** the selected row lifts and the panel reads it closer.
  There is no blur on this view.
- **Letterbox:** an approval missed before a window that blocks a security fix
  would escalate to the urgent path from the pier panel. That is not drawn
  here.

## Needs
- **Tokens (proposed):**
  - `--type-micro`, `--mark-now`, `--mark-tide`, `--mark-seam`,
    `--mark-scar`, `--mark-travel`, `--mark-stale-hatch`.
  - `--mark-tide-known` (a window ahead).
  - `--time-past-water-deep` / `-shallow` / `-surface` (the plane), which
    replaces `--time-past-dim` on any time-axis view.
  - Layout widths `--x-col-name`, `--x-col-read`, `--x-panel`.
  - Relies on `--font-mono`.
- **Kit parts:** `TimeScale` (shared with V3: one function, power from range),
  `NowLine` + `PastWater` drawn once by the board, `IntentLine`, `PartLine`,
  `StaffGauge`, `Pier`.
- **Data / events:**
  - `intent.deadline_moved` {old, new, by, **reason (required)**, agreed_by},
    with the rule's start date kept so older moves read as "no reason
    recorded".
  - Weekly effort per intent (an aggregate of existing events).
  - Updater: applied, halted, rolled back {servers reached}, missed window,
    bake peak per release.
  - **Preview bake peaks per release** (new upstream feed).
  - Window rule with an id.
  - Per-server heartbeat.
  - `record.gap` from the events service (same field as V3).
  - The viewer's actions per object (Extend, Approve).

## Questions for Harry
- **Should moving a deadline need the asker's agreement**, or only a reason?
  The prototype records "waiting for Lena Hart" and moves the date at once.
  That is a product rule.
- **Is "Ahead" a Home section or its own view?** It is a strong candidate for
  the shell's own screen (water language, one now line), with apps
  contributing rows through their manifests.

## Where I went beyond the ask
- I made the deadline reason a hard requirement with a migration rule for
  older moves (dashed seam).
- I split "missed" from "moved early".
- I tied the record gap to the intent that caused it.

## Score
Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5
