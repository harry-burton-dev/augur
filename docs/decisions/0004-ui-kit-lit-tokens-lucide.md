# 0004. The UI kit is Lit web components, with one tokens file and Lucide icons

- **Status:** Accepted
- **Date:** 2026-10-17
- **Decided by:** Harry

## Context

Harry's design system was made in Claude Design and changes over time. Apps may be written with different frameworks, and the shell itself uses React. The kit has to work in all of them and stay in step with the design.

## Decision

- The UI kit (`platform/packages/ui-kit`) is built from Lit web components, documented in Storybook.
- `platform/packages/ui-kit/tokens/tokens.json` is the only file where design tokens are edited. Everything else (CSS variables, Claude Design copies) is generated or copied from it.
- Icons come from Lucide through `src/components/icon.ts`. No hand-written SVG icons.
- Apps build their screens from kit components first, and only add their own components when the kit has nothing that fits. Kit groups are only built when a real screen needs one.

## Consequences

- Web components work inside React, Lit or plain DOM apps.
- New `floor-*` tokens have to be copied into Claude Design by hand until there's a sync.
- Whether Claude Design or the repo is the design master is still open.

## Links

- App kit plan: https://claude.ai/artifact/SFq3uBLjsaGHRnxUsxfxDm
