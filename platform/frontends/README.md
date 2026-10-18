# Platform frontends

| Folder | What it is |
| --- | --- |
| `shell/` | The host (`@platform/shell`, React + Vite). Wraps the UI kit's `ui-shell`, loads the role-filtered manifest from the registry through the gateway, mounts the app the URL points at into the Shell's stage, routes intents to the app that handles them, and turns `ctx.notify()` into notifications on the Shell's stream. |
| `home/` | Home (`@platform/home`): where people land. Built as one ES module at `dist/entry.js`. |
| `admin/` | People, departments and apps (to come). |

Product apps keep their own frontends under `apps/<app>/frontend`.

## How an app is mounted

1. The registry's manifest lists each app with a `route` and an `entry` URL.
2. The shell matches the URL to the longest route prefix and imports the app's `entry` with the browser's own dynamic `import()`.
3. The module default-exports a `MicroFrontend` (`defineMicroFrontend` from `@platform/mfe-sdk`). The shell calls `mount(el, ctx)` on a fresh element, and calls `unmount(el)` before the next app opens.
4. An app asks for anything outside itself through `ctx`: `raise(intent)` to open whichever app handles it, `notify()` for the Shell's stream, `bus` for events, `getToken()` for gateway calls.

Each app bundles what it uses for now, the UI kit included (its elements register only once, so two apps sharing it is safe). Sharing dependencies through Module Federation or an import map is a later optimisation and doesn't change the contract.

## Running it locally

```sh
pnpm --filter @platform/home build                      # the app the shell will mount
pnpm --filter @platform/registry dev                    # :8082
pnpm --filter @platform/gateway dev                     # :8080
pnpm --filter @platform/shell dev                       # :5173, proxies /api to the gateway
```

In development the shell serves `/apps/<id>/` from each app's `dist/`; `APP_DIST=library=../../../apps/library/frontend/dist` adds more. Until Identity lands, the shell signs in a fixed local user (`src/host/session.ts`).
