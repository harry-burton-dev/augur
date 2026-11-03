---
'@augur/shell': minor
'@augur/registry': patch
---

SDK 2 drops Lit and the Lit kit (`@augur/ui-kit`, PER-264). The shell no longer builds or serves them: its import map holds only React, Common and Quill from the kit bundle, `/shared/` is gone from the front door, and the shell's build stops if the pinned kit doesn't serve every module the SDK promises apps. An app that still imports `lit` or `@augur/ui-kit` doesn't load. The shell serves the kit's typefaces (Jost and Nunito, through Fontsource) itself until Common ships them. `pnpm create-app` now makes a React app on Quill (`src/entry.tsx`), `pnpm dev:app` takes an `entry.tsx` (its `--kit` switch is gone), and the registry takes a `.tsx` entry for Live on the workbench. `pnpm check:boundaries` fails on any import of Lit or the Lit kit under `platform/` or in the app template.
