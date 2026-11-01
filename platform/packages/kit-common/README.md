# @augur/kit-common (Common)

What both of AUGUR's React kits stand on (ADR 0015): the tokens, the Tailwind theme built from them, and, as the Lit kit moves to React, the controls both kits share. Aerie (`@augur/shell-kit`) is the shell's kit and Quill (`@augur/app-kit`) the apps' kit; each adds its own token set.

```sh
pnpm --filter @augur/kit-common build   # tokens.css, the Tailwind theme and the typed token map
pnpm --filter @augur/kit-common test
```

## Tokens

The three files in `tokens/`, in the W3C design tokens format, are the only place a token is edited:

| File | Set | Used by |
| --- | --- | --- |
| `common.tokens.json` | Palette, spacing, radius, type, motion, floor marks | Both kits |
| `shell.tokens.json` | The water, the band, the focal point, the shell's layers | Aerie |
| `app.tokens.json` | The rail and drawer of an app frame | Quill |

`scripts/build-tokens.mjs` (Style Dictionary) writes from them:

- `dist/tokens.css`: every token as a CSS custom property on `:root`, named for the token alone (`color.slate` is `--slate`).
- `dist/theme.css`, `theme-shell.css`, `theme-app.css`: the Tailwind v4 theme. `theme.css` clears Tailwind's own palette and scales, so only AUGUR's tokens exist as classes, and each utility reads the token's variable (`bg-slate` is `var(--slate)`, `p-4` is `var(--space-4)`, `text-body` brings its leading). Durations, layers and effects have no Tailwind utility and stay variables.
- `@augur/kit-common/tokens`: the typed map (`tokens`, `token('ink')`).

Load a kit's theme, not these files: `@augur/app-kit/theme.css` in an app, `@augur/shell-kit/theme.css` in the shell. New `floor-*` tokens also have to be copied into the design tool by hand.

## Controls

The shared controls are React components on React Aria Components, with icons from Lucide. They are `Button`, `IconButton`, `Icon`, `TextField`, `Select`, `Toggle`, `Checkbox` and `CheckboxGroup` so far. Load `@augur/kit-common/kit.css` once, after `tokens.css`, for their styles. It holds only the classes the controls use.

- A disabled control can carry a `reason`. It then stays focusable and shows the reason on hover and focus, so that nothing unavailable is left unexplained (docs/shell-principles.md). In development, a disabled control with no reason logs a warning.
- `Button` kinds are `primary`, `secondary`, `quiet` and `danger`. A `danger` button arms on the first press and acts on the second, and Esc or moving away disarms it. `busy` shows progress with a `busyLabel`, and `once` stops a second press.
- Fields share one shape: a label row (Required or Optional), a hint, a hairline that turns the focus blue, and a line under it for the field's state. A required field left empty asks in green (`attention`); only wrong content is `error`. Pass `state` and `message` to set it from outside, or `validate` to check on leaving the field.
- A `Toggle` acts at once. Give `onChange` a Promise and it shows saving, and turns back and says why if it fails. A choice that waits for a form's primary is a `Checkbox`.
- `iconNames` matches the Lit kit's icon list. A test in ui-kit fails if the two lists drift apart.
- `src/tokens-only.test.ts` fails on any raw colour or duration in kit source.

The stories live next to each control, and the shared Storybook in `platform/storybook` shows them. It is published to Chromatic from CI (docs/release-channels.md).
