# @augur/shell-kit (Aerie)

The shell's own React kit (ADR 0015), on [Common](../kit-common/README.md): the water, the band, Orbit, the title cards. Only `platform/frontends/shell` may import it (`pnpm check:boundaries`), so it is bundled into the shell, never served through the import map, never published, and not part of the SDK promise. Its parts arrive as the shell's Lit parts move to React.

Its Tailwind theme, Common's tokens and the shell set: `@import '@augur/shell-kit/theme.css';`

## Parts

Aerie re-exports Common. Its own parts are the shell's notices: `Toasts` (what just happened, with one way to change your mind), `AppUnavailable` (an app that is loading, failed, needs a newer AUGUR or is kept to some floors, shown and explained instead of hidden) and `Connection` (offline, reconnecting, or an ended session). Urgent things use Common's `Letterbox`. The shell loads `@augur/shell-kit/kit.css`; nothing else may.
