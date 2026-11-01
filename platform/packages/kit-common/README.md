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
