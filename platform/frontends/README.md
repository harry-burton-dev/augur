# Platform frontends

| Folder | What it is |
| --- | --- |
| `shell/` | The host (`@augur/shell`, React + Vite). Wraps the UI kit's `ui-shell`, loads the role-filtered manifest from the registry through the gateway, mounts the app the URL points at into the Shell's stage, routes intents to the app that handles them, and turns `ctx.notify()` into notifications on the Shell's stream. |
| `home/` | Home (`@augur/home`, at `/home`): what needs you, and apps' glance cards. Built as one ES module at `dist/entry.js`. |
| `admin/` | Admin (`@augur/admin`, at `/admin`, admins only): people, departments and apps. Its screens call identity's `/v1/admin/*` and the registry's `/v1/apps` and `/v1/origins` through the gateway, never Keycloak. |
| `upgrades/` | Upgrade Centre (`@augur/upgrades`, React, at `/upgrades`, admins only, ADR 0030): what this deployment runs, a page for AUGUR and each app, and the history. Changes still go through Admin's Upgrade Centre page until its change flow ships. See its [README](upgrades/README.md). |

Product apps keep their own frontends under `apps/<app>/frontend`.

## How an app is mounted

1. The registry's manifest lists each app with a `route`, an `entry` URL and the `sdk` range it works with. An app whose range doesn't include the shell's `SDK_VERSION` isn't opened; the shell says why instead.
2. The shell matches the URL to the longest route prefix and imports the app's `entry` with the browser's own dynamic `import()`.
3. The module default-exports a `MicroFrontend` (`defineMicroFrontend` from `@augur/mfe-sdk`). The shell calls `mount(el, ctx)` on a fresh element, and calls `unmount(el)` before the next app opens.
4. An app asks for anything outside itself through `ctx`: `raise(intent)` to open whichever app handles it, `request(intent)` to ask that app for an answer, `notify()` for the Shell's stream, `bus` for events, `fetch(path)` for gateway calls on the current floor (`getToken()` when it needs the token itself).

## Floors

Every location starts with the floor it's on: `/@me/library/doc/1` on the person's own floor, `/@finance/library` on the Finance team's, `/@org/home` on the org's. A location without one, such as an old bookmark, opens on the person's own floor and the address is corrected to say so. The shell loads the person's floors from identity (`/api/identity/v1/me/workspaces`) at sign-in; a floor they aren't on shows "You're not on that floor" with a way back to their own.

Apps read the floor from `ctx.workspace` (its kind, name, slug, path from the org, and the person's role there) and call their service with `ctx.fetch`, which adds the person's token and `X-Workspace-Id`. The gateway checks that header against the person's floors and refuses the call when they aren't on it. Changing floor unmounts the open app and mounts it again with the new floor, so no app keeps one floor's data on screen on another. Moving inside an app that sets `followsAddress` and gives `navigated` (SDK 1.11), by Back, Forward or its own links, keeps it mounted: the shell calls its `navigated` with the new path rather than throwing away what it holds (`AppMounter` in `src/host/mount.ts`). Apps built for SDK 1.0 mount on whatever floor the person is on and ignore it.

What people see: the top left shows the floor's icon (a person, a group, a building) and its breadcrumb from the org, each step a way up; a gauge at the right edge has one notch per floor from their own to the org; Account lists every floor; Page Up and Page Down go up or down a floor once the page is at its top or bottom (with Alt, at once). Each kind of floor gives the water its colours (`floor-*` tokens: your own keeps the shell's green and navy, departments, the first level of team below the org, are violet and lavender, every team below them shares amber and coral, the org is deep navy) and its height, and a move slides the water up or down while the floor's name shows for a moment. Going to another floor keeps you in the same app, at its start. Pointing at the gauge opens it out in one smooth move, each floor's name and who sees it growing in beside its notch. In an app that's the same on every floor (`sameOnEveryFloor`, as Admin is) the gauge rests: it stays in view, dimmed, and says why, and Page Up and Page Down leave the floor alone.

## Title and Orbit

The shell's own navigation is the design system's centre menu, over the water.

- `/` is **Title**: every app the person can open is a chapter. A chapter's items are the app's `areas` (SDK 1.5), such as Admin's Organisation and System, each opening the app's Orbit at the area's first group. An app with one area or none is a choice by itself, captioned with its description: nothing is offered twice. Title never lists an app's groups or pages.
- An app's root is its **Orbit** when its manifest has a `menu`: groups on a ring, kept together by area and named with it ("Organisation / People"), each item opening the app at its `path` (for example `/library/drafts`). A group with one page is that page. While Orbit or the app is open, the area sits under the app's name below the handle. An app without a menu opens straight away.
- **Esc goes back a step:** from inside an app to its Orbit, from Orbit (or an app with no menu) to Title. It only does so when nothing else used the Esc, so a component that handles Esc itself (an armed button, a filter, a dialog) calls `preventDefault()`.
- **An app can keep its menu inside it** with `"orbit": false` (SDK 1.4), as Artifacts does with its side rail. The shell then never shows its Orbit: its root opens the app, choosing one of its areas in Title opens the app at the area's first page, and Esc stays with the app. The way out is **Home** or **All apps** in the band.
- **The band stays on every screen, and never draws a surface.** It rests on a fade of the `scrim` token over the water or the app. Top left is the floor you're on, its icon and name only. While an app is open, its name sits under the look-up handle (with `area`, the part of it you're in), and beside the floor two round buttons (`navs`, `ui-nav`) go to **Home** and to **All apps** (Title) from any screen, inside an app or not. The one you're on is marked; Home stays, saying why, on a floor without it (`navsFor`). Esc goes up one level, worked out from where you are (`backFrom`), never per app; an app that keeps its own menu keeps Esc, so the two buttons are its way out. The tab's title names the page, app and floor.
- **The floor gauge** at the right edge lights the floor you're on and pins the open app beside it, since what an app shows is that floor's. Pointing at it, or tabbing into it, opens it out: each floor's name, who sees what's on it, which one you're on, and which one the app is showing. Changing floor keeps you in the same app, at its start. Until the new floor's catalogue arrives nothing of the old floor's stays mounted, so an app is never shown one floor's data under another's address.

```json
"areas": [
  { "id": "writing", "label": "Writing", "icon": "document", "detail": "Drafts and templates" },
  { "id": "sharing", "label": "Sharing", "icon": "publish" }
],
"menu": [
  { "label": "Drafts", "icon": "folder", "area": "writing", "items": [
    { "label": "All drafts", "icon": "list", "path": "/drafts", "detail": "Not published yet" },
    { "label": "New draft", "icon": "plus", "path": "/drafts/new" }
  ] },
  { "label": "Published", "icon": "inbox", "area": "sharing", "items": [
    { "label": "Sent out", "icon": "list", "path": "/published" }
  ] }
]
```

Nothing repeats its parent: an area's label and icon differ from the app's, a group's from its area's, and an item's from its group's. The registry warns when a manifest breaks this, and `pnpm check:manifest` prints the warnings, but accepts it. See [the shell principles](../../docs/shell-principles.md). Item paths can't be `/`, since that's the Orbit itself. The ground follows the screen: Minimal water under Title, Deep Ocean under Orbit, and under every app the same still slate Artifacts sits on (`background="none"`), so no app floats on water. Between screens, as on the way to another floor while its catalogue loads, the ground stays as it was, so the water never shows partway through a move inside an app.

## What the Shell offers

- **Settings and Away** save to the person's account (`GET`/`PUT /api/identity/v1/me/preferences`) a moment after each change, and come back in any browser. Reduce motion sets `data-motion="reduce"` on `<html>`, which holds the water and menus still and zeroes the motion tokens; Compact sets `data-density="compact"`, which brings the larger spacing steps down a notch.
- **The stream** groups notifications by app, the apps with something that needs you first, newest first inside each. A notification's buttons (its `actions`, up to two) raise their intents through the shell, exactly as `ctx.raise` does, and mark it read; one from another floor goes to that floor first and raises its intent once that floor's apps have loaded. Each app's ⋯ mutes it: its notifications still land in the stream, silently (no pulse, not counted in the band), and never on Home. Muted apps are saved in preferences as `muted`.
- **Home** is the first place to look: a count ("3 things need you"), every unread notification that needs you (muted apps left out) with its actions inline, then up to six glance cards: each app's `card` surface for this kind of floor, in recent-app order. Home is an app, so it hears from the shell only on the bus, on the shell's own `shell.home.*` events (`src/host/home.ts`); the shell keeps the notifications and mounts each card with the card's app's own context. Nothing at all shows "Nothing needs you right now".
- **Recent apps** are saved the same way, so Apps lists the current app, then the last few opened, then the rest.
- **Find** searches apps, notifications and every page an app's `menu` offers (`findPages` in `src/host/menus.ts`) at once, then apps' own content: a moment after the person stops typing (two letters or more), it asks every app on this floor whose manifest says `search`, all at the same time, with `GET /api/<id>/v1/search?q=` on the current floor (`AppSearch` in `src/host/find.ts`). Each app's results show under its name as they arrive, at most ten, the current floor's first; an app still answering says "Still looking…", and one that takes longer than 1.5 seconds is let go ("Didn't answer in time"), so no app holds up the rest. Choosing a result opens its app at the result's `path`, on the result's floor.
- **Agents** and **Switch workspace** are off for the alpha (`alphaFunctions` and `canSwitchWorkspace` in `App.tsx`) until they are designed. A platform app that hasn't shipped is left out of the manifest by listing it in `unbuiltApps` in the registry; apps an admin turns off in Admin are left out too, and so are apps whose `entry` is on a site an admin no longer allows (Admin, Apps, "Where apps load from").

## Apps asking each other

Apps never import or call each other. They speak in intents, a `type` such as `colour.pick` plus a payload, and an app lists the intent types it answers in its manifest's `handles`. The shell picks the app from the person's role-filtered manifest, so nobody is sent to an app they can't open.

- `ctx.raise(intent)` opens the handling app as a page, with the intent in its `ctx.intent`.
- `ctx.request(intent)` opens the handling app over the current one, in a dialog, with `ctx.reply` set. The handler calls `ctx.reply.respond(result)` and the asker's promise resolves with that result. If the person closes the dialog, the promise rejects with an error that `isIntentCancelled(err)` recognises; if no app handles the intent, it rejects with an `IntentError` saying so. One request is open at a time.

`src/host/requests.test.ts` shows both sides.

## One kit for everyone

The shell serves the kits, Lit and React once, and the shell and every app use that copy, through one import map at the top of `index.html`, so a bare `import 'react'` or `import 'lit'` anywhere on the page resolves to the same file:

- **React, Common and Quill** come from the kit bundle (`@augur/kit-bundle`, a release of the `augur-kit` repository), pinned in `release/kit.json` ([ADR 0048](../../docs/decisions/0048-kit-served-from-a-kit-url.md)). The build copies it into `dist/kit/<version>/` and names each file in the import map under the kit URL, with its hash as its integrity. `dist/index.template.html` keeps the kit URL as a placeholder, `@KIT_URL@`, which the web container fills in from `KIT_URL` when it starts (`infra/deploy/kit-url.envsh`); `dist/index.html` has the default, `/kit/`. A small script in the page says so, naming `KIT_URL`, if the kit can't be loaded.
- **Lit and the Lit kit** are built by `vite.shared.config.ts` into `shared-build/`, served at `/shared/`, until SDK 2.

After bumping the kit bundle, run `pnpm kit:pin` and commit `release/kit.json`; `pnpm check:kit` fails until you do. An app's build leaves those imports alone:

```ts
import { isSharedModule } from '@augur/mfe-sdk/build';
// in vite.config.ts
build: { rollupOptions: { external: isSharedModule } }
```

`sharedModules` in `@augur/mfe-sdk` lists exactly what the shell provides: `lit`, its decorators and every directive under `lit/directives/`, and `@augur/ui-kit`; and React 19 (`react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`), Common (`@augur/kit-common`) and Quill (`@augur/app-kit`). Aerie (`@augur/shell-kit`) is the shell's own kit and is bundled into the shell, never shared. Anything else an app imports, it bundles itself. Because every app gets the shell's kit, the kit keeps the SDK's promise: see [Versioning](../../docs/versioning.md#the-shared-kit).

## Running it locally

```sh
pnpm --filter @augur/home --filter @augur/admin build   # the apps the shell will mount
pnpm --filter @augur/registry dev                    # :8082
pnpm --filter @augur/gateway dev                     # :8080
pnpm --filter @augur/shell dev                       # :5173, proxies /api to the gateway
```

`pnpm --filter @augur/shell dev` builds `shared-build/` first, and serves the kit bundle's development build (React's development copy) at `/kit/<version>/dev/`; run `pnpm --filter @augur/shell build:shared` again after changing the Lit kit. In development the shell serves `/apps/<id>/` from each app's `dist/`; `APP_DIST=<id>=<dir>,…` adds more. Apps without a service of their own are registered with `SERVICE_CLIENT_SECRET=... pnpm register-app apps/<app>/manifest.json`, using the secret Admin, Apps issues for the app. The shell signs people in with OIDC (`src/host/session.ts`) against the local Keycloak realm unless `VITE_OIDC_AUTHORITY` and `VITE_OIDC_CLIENT_ID` say otherwise; the test users are listed in `infra/keycloak/README.md`.
