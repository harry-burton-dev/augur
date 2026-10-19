# Platform frontends

| Folder | What it is |
| --- | --- |
| `shell/` | The host (`@platform/shell`, React + Vite). Wraps the UI kit's `ui-shell`, loads the role-filtered manifest from the registry through the gateway, mounts the app the URL points at into the Shell's stage, routes intents to the app that handles them, and turns `ctx.notify()` into notifications on the Shell's stream. |
| `home/` | Home (`@platform/home`, at `/home`): what needs you. Built as one ES module at `dist/entry.js`. |
| `admin/` | Admin (`@platform/admin`, at `/admin`, admins only): people, departments and apps. Its screens call identity's `/v1/admin/*` and the registry's `/v1/apps` through the gateway, never Keycloak. |

Product apps keep their own frontends under `apps/<app>/frontend`.

## How an app is mounted

1. The registry's manifest lists each app with a `route`, an `entry` URL and the `sdk` range it works with. An app whose range doesn't include the shell's `SDK_VERSION` isn't opened; the shell says why instead.
2. The shell matches the URL to the longest route prefix and imports the app's `entry` with the browser's own dynamic `import()`.
3. The module default-exports a `MicroFrontend` (`defineMicroFrontend` from `@platform/mfe-sdk`). The shell calls `mount(el, ctx)` on a fresh element, and calls `unmount(el)` before the next app opens.
4. An app asks for anything outside itself through `ctx`: `raise(intent)` to open whichever app handles it, `request(intent)` to ask that app for an answer, `notify()` for the Shell's stream, `bus` for events, `getToken()` for gateway calls.

## Title and Orbit

The shell's own navigation is the design system's centre menu, over the water.

- `/` is **Title**: every app the person can open is a chapter. A chapter's items are the app's menu categories, or the app itself when it has no menu. Enter opens it.
- An app's root is its **Orbit** when its manifest has a `menu`: categories on a ring, each item opening the app at its `path` (for example `/board/labels`). An app without a menu opens straight away.
- **Esc goes back a step:** from inside an app to its Orbit, from Orbit (or an app with no menu) to Title. It only does so when nothing else used the Esc, so a component that handles Esc itself (an armed button, a filter, a dialog) calls `preventDefault()`.

```json
"menu": [
  { "label": "Labels", "icon": "star", "items": [
    { "label": "All labels", "icon": "star", "path": "/labels", "detail": "Colours from Palette" }
  ] }
]
```

Item paths can't be `/`, since that's the Orbit itself. The water follows the screen: Minimal under Title, Deep Ocean under Orbit, Calm Tide under apps.

## What the Shell offers

- **Settings and Away** save to the person's account (`GET`/`PUT /api/identity/v1/me/preferences`) a moment after each change, and come back in any browser. Reduce motion sets `data-motion="reduce"` on `<html>`, which holds the water and menus still and zeroes the motion tokens; Compact sets `data-density="compact"`, which brings the larger spacing steps down a notch.
- **Recent apps** are saved the same way, so Apps lists the current app, then the last few opened, then the rest.
- **Find** searches apps, notifications and every page an app's `menu` offers (`findPages` in `src/host/menus.ts`); choosing a page opens it. Apps' own content joins once apps can answer searches.
- **Agents** and **Switch workspace** are off for the alpha (`alphaFunctions` and `canSwitchWorkspace` in `App.tsx`) until they are designed. A platform app that hasn't shipped is left out of the manifest by listing it in `unbuiltApps` in the registry; apps an admin turns off in Admin are left out too.

## Apps asking each other

Apps never import or call each other. They speak in intents, a `type` such as `colour.pick` plus a payload, and an app lists the intent types it answers in its manifest's `handles`. The shell picks the app from the person's role-filtered manifest, so nobody is sent to an app they can't open.

- `ctx.raise(intent)` opens the handling app as a page, with the intent in its `ctx.intent`.
- `ctx.request(intent)` opens the handling app over the current one, in a dialog, with `ctx.reply` set. The handler calls `ctx.reply.respond(result)` and the asker's promise resolves with that result. If the person closes the dialog, the promise rejects with an error that `isIntentCancelled(err)` recognises; if no app handles the intent, it rejects with an `IntentError` saying so. One request is open at a time.

`apps/sample-board` and `apps/sample-palette` show both sides.

Each app bundles what it uses for now, the UI kit included (its elements register only once, so two apps sharing it is safe). Sharing dependencies through Module Federation or an import map is a later optimisation and doesn't change the contract.

## Running it locally

```sh
pnpm --filter @platform/home --filter @platform/admin build   # the apps the shell will mount
pnpm --filter @platform/registry dev                    # :8082
pnpm --filter @platform/gateway dev                     # :8080
pnpm --filter @platform/shell dev                       # :5173, proxies /api to the gateway
```

In development the shell serves `/apps/<id>/` from each app's `dist/`; `APP_DIST=sample-board=../../../apps/sample-board/frontend/dist,sample-palette=../../../apps/sample-palette/frontend/dist` adds more. Apps without a service of their own are registered with `SERVICE_TOKEN=... pnpm register-app apps/sample-board/manifest.json apps/sample-palette/manifest.json`. The shell signs people in with OIDC (`src/host/session.ts`) against the local Keycloak realm unless `VITE_OIDC_AUTHORITY` and `VITE_OIDC_CLIENT_ID` say otherwise; the test users are listed in `infra/keycloak/README.md`.
