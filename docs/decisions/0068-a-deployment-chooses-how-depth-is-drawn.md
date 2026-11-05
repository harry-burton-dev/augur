# 0068. A deployment chooses how depth is drawn, and scrim blurs nothing

- **Status:** Proposed
- **Date:** 2026-11-05
- **Decided by:** Harry
- **Replaces:** none

## Context

PDR-010 (depth and focus) has the app behind a dialog, the palette or the radial menu go out of focus instead of under a black scrim. Quill draws that three ways: `veil` (a layer that blurs what's behind it with `backdrop-filter`, the default), `lens` (the page itself is blurred) and `scrim` (dimmed, no blur). PDR-010's amendment 2 asks that an organisation be able to choose, because many of its desktops are virtual desktops with no GPU, where blurring a whole page is slow.

The choice is about the organisation's machines, so it belongs to the deployment, not to each app. App settings in the registry are whole numbers for an app's service (ADR 0053's starter reads them), and an app's frontend can't read them, so they don't fit.

## Options

1. **A deployment setting, written into the page.** `FOCUS_DEPTH` in `.env` (and settings.schema.json). The web container writes it into the shell's page as an `augur-depth` meta, as it does the product's name. Quill reads it, because the shell and every app share one page. No SDK, gateway or registry change.
2. **A setting the SDK hands each app.** Through the app's context at mount. A breaking-shaped change to the SDK contract for a value every app would pass straight to AppFrame.
3. **An app setting per app, in Admin.** Each admin sets it once per app, and the registry's settings learn a choice type. Seven places to set one fact about the machines.
4. **Detect the GPU in the browser.** No reliable signal: virtual desktops often report a software renderer only through WebGL, and probing it costs more than it saves.

## Decision

Option 1. `FOCUS_DEPTH` is `veil`, `lens`, `scrim` or unset. Unset leaves it to each app, which is `veil` unless the app says otherwise. When it's set, Quill's `FocusStage` (in every `AppFrame`) draws that depth over the app's own choice, because an app can't know what the machines are. With `scrim`, Common also turns off every backdrop blur (the dialog veil, panes and overlays) and makes the see-through surfaces solid, so nothing on the page asks the machine to blur.

## Consequences

- An admin sets one line in `.env` and restarts `web` (docs/deploy.md, "Desktops without a GPU"). Nothing to do per app.
- `pnpm check:settings` holds the setting to the schema, compose.yml and .env.example. The install preflight refuses a value that isn't one of the three. The web container ignores one it doesn't know, says so in its log, and leaves depth to each app.
- The shell's own surfaces follow it too, through Common's rule. Aerie has no depth of its own to set.
- The meta is read once, when an app's stage mounts, so a change needs a page reload, which the restart of `web` brings anyway.
- Tests: `app-kit/src/depth.test.tsx` in augur-kit (the deployment's depth wins; an unknown value is ignored).

## Links

- PDR-010 Depth and focus stacking, amendment 2 (handbook). PER-331, PER-231.
- augur-kit #38 (Quill reads the meta; Common's scrim rule).
