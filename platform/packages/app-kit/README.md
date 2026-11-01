# @augur/app-kit (Quill)

The React kit apps build with (ADR 0015), on [Common](../kit-common/README.md). The shell serves it, with React 19 and Common, through the import map, so it keeps the SDK's promise ([Versioning](../../../docs/versioning.md#the-react-kits-adr-0015)) and an app's bundle carries none of it.

Its parts arrive as the Lit kit's groups move to React; until then apps keep `@augur/ui-kit`. For an app's own layout, Tailwind with only AUGUR's tokens:

```css
@import 'tailwindcss/utilities' layer(utilities);
@import '@augur/app-kit/theme.css';
```

No preflight: apps draw inside the shell, which already sets the page's base.
