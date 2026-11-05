---
'@augur/shell': minor
'@augur/registry': patch
---

SDK 2 drops Lit and the Lit kit (`@augur/ui-kit`, PER-264). The shell no longer builds or serves them: its import map holds React, Common and Quill from the kit bundle, and in production the shell's own stand-in for `react/jsx-dev-runtime` at `/shared/`. The shell's build stops if the pinned kit doesn't serve every module the SDK promises apps. An app that still imports `lit` or `@augur/ui-kit` doesn't load. The typefaces (Jost and Nunito) now come with the kit's styles (kit 0.5.0). `pnpm dev:app` drops its `--kit` switch, and the registry takes a `.tsx` entry for Live on the workbench. `pnpm check:boundaries` fails on any import of Lit or the Lit kit under `platform/`.
