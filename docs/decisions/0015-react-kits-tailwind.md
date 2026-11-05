# 0015. Frontends are React, with a shell kit and an app kit on one common base, styled with Tailwind

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** [0004](0004-ui-kit-lit-tokens-lucide.md); changes the shared modules in [0003](0003-import-maps-not-module-federation.md)

## Context

The shell is React 19. The UI kit (`@augur/ui-kit`, about 50 Lit web components) and every other frontend (Admin, Home and the four pillar apps, about 20,000 lines) are Lit. Harry wants the kit split in two: the shell's own kit and the kit apps build with. Their tokens and foundations differ, though they share some primitives. He also wants Tailwind, and he wants to move every frontend to React early, before the apps move to their own repositories (ADR 0012) and before more screens are built in Lit.

The shell serves shared modules to every app through the import map (ADR 0003), so whatever the kits are written in becomes part of the contract every app is built against.

## Options

1. **Keep Lit, and add Tailwind only beside the kits.** Works in any framework and needs no rewrite. But Tailwind can't style inside shadow DOM, and the ecosystem and tooling are smaller than React's.
2. **React for every frontend, with React Aria Components as the accessible base and Tailwind v4 for styling.** The largest ecosystem, and Tailwind fits naturally. Costs a staged rewrite. Every app must use the React major the shell serves.
3. **React with Radix and shadcn/ui.** The same as 2, but on Radix, which is now updated more slowly; React Aria has broader accessibility and internationalisation coverage.

## Decision

Option 2.

- **React everywhere.** Every AUGUR frontend (the shell, platform frontends and apps) is React with TypeScript. The shell serves `react`, `react-dom`, `react/jsx-runtime` and the kits through the import map, and apps never bundle their own copy. React's major version moves only with an SDK major.
- **Three packages.**
  - `@augur/kit-common` (people see it as **Common**) holds the raw tokens, the token contract, Lucide icons and the controls both kits use.
  - `@augur/shell-kit` (**Aerie**) holds the shell's own parts. Only the shell uses it, so it is not in the import map and not part of the SDK promise.
  - `@augur/app-kit` (**Quill**) holds the parts apps build with. It and Common carry the SDK promise.
- **Accessible behaviour comes from React Aria Components.** Kit parts never hand-write focus, keyboard or ARIA behaviour that the library already provides.
- **Styling is Tailwind v4.** Its theme is generated from AUGUR's tokens, with Tailwind's default palette and scales removed, so only AUGUR tokens exist as classes. Common's controls read the token contract, and each kit sets its values for its own ground: water for Aerie, slate for Quill.
- **Tokens are three files in the W3C design tokens format** (common, shell, app), built with Style Dictionary into CSS variables, the Tailwind theme and a typed map. These files are the only place tokens are edited. Icons still come only from Lucide, now as `lucide-react`.
- **Staged migration.** The Lit kit stays served, frozen, through SDK 1.x, so nothing breaks while frontends move one at a time. SDK 2 drops Lit.

## Consequences

- Tailwind, React Aria Components, Style Dictionary, `lucide-react`, Fontsource (the typefaces, served by AUGUR instead of Google Fonts) and Storybook's React renderer become dependencies. This record covers them.
- Every app pins to the shell's React major. A React major is an SDK major and a coordinated upgrade across app repositories.
- Apps can no longer be written in other frameworks.
- `pnpm check:boundaries` gains a rule that apps never import `@augur/shell-kit`. A stylelint or Tailwind rule keeps raw palette tokens out of components.
- `docs/shell-principles.md` (Tokens only), `docs/versioning.md` (The shared kit) and `platform/frontends/README.md` change with the first build PR.
- New `floor-*` tokens still have to be copied into Claude Design by hand.

## Links

- Linear PER-176
- Kit split plan (project files, `ui-kits/kit-split-plan.html`)
