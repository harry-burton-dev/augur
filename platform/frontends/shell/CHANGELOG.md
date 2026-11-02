# @augur/shell

## 0.12.0

### Minor Changes

- fccb126: The React kits begin (ADR 0015). Three new packages: Common (`@augur/kit-common`), which now holds the token files and builds a Tailwind v4 theme from them with nothing of Tailwind's own palette or scales; Quill (`@augur/app-kit`), the kit apps build with; and Aerie (`@augur/shell-kit`), the shell's own kit. The shell now serves React 19, Common and Quill through the import map (`sharedModules` in the SDK), and uses that copy of React itself. Aerie is never shared, and `pnpm check:boundaries` fails if anything but the shell imports it. The Lit kit is frozen through SDK 1.x and reads its tokens from Common; nothing looks different.
- bab2360: Settings has a new switch, Toasts for new notifications, which is off by default. When it's on, each new notification is also shown once as an Aerie toast at the bottom of the screen, with Open. When it's off, the shell behaves as it does today: it only pulses. Identity keeps the choice as the `toasts` preference (identity contract 1.13.0).

### Patch Changes

- d994d7b: Common gets its first React controls: Button, IconButton and Icon, with React Aria behaviour, Lucide icons, a reason for every disabled control and `kit.css` for their styles. The shell loads `kit.css`. One Storybook in `platform/storybook` now shows the React kits, with the frozen Lit kit inside it.
- cccd9ea: Tokens now live in three W3C design token files (`tokens/common.tokens.json`, `shell.tokens.json`, `app.tokens.json`) and are built with Style Dictionary. Every CSS variable and token value is unchanged. The typefaces are now served by AUGUR through Fontsource instead of loading from Google Fonts at runtime, so a deployment without internet access still shows them. While an app's title card plays, the screen waiting unseen behind it can no longer be pressed; before, a press could land on a control that was about to rise into place.
- f8e9b46: Quill gets its first parts: AppFrame (three columns with a rail that folds to icons, the app's name opening its front page, and a drawer), RailLink, FrontPage, About, More and SelectionBar. Quill re-exports Common, and the shell loads Quill's `kit.css`. The tokens-only test now covers every kit's source.
- Updated dependencies [f8e9b46]
- Updated dependencies [2a827a0]
- Updated dependencies [d994d7b]
- Updated dependencies [2a827a0]
- Updated dependencies [2a827a0]
- Updated dependencies [2a827a0]
- Updated dependencies [2a827a0]
- Updated dependencies [cccd9ea]
- Updated dependencies [527a413]
- Updated dependencies [f8e9b46]
- Updated dependencies [da54ae3]
- Updated dependencies [7c8027d]
- Updated dependencies [d500567]
- Updated dependencies [a8854e2]
- Updated dependencies [fccb126]
- Updated dependencies [d64d724]
- Updated dependencies [bab2360]
  - @augur/kit-common@0.2.0
  - @augur/shell-kit@0.2.0
  - @augur/ui-kit@1.9.0
  - @augur/app-kit@0.2.0
  - @augur/mfe-sdk@1.10.0

## 0.11.0

### Minor Changes

- 1a55170: Live on the workbench: `pnpm dev:app <id> --live` loads your app's frontend, from source on your machine over the tailnet, into the workbench's real shell, with real sign-in, floors and data, for you alone. Paste the address it prints into Previews, **Live from my machine**. Only an app's developers can, and only on the workbench (`SERVER_RING=dev`), where the front door's Content Security Policy allows `https://*.ts.net`; elsewhere Previews says why (docs/release-channels.md, "Live on the workbench").
- 5ab5009: Departments and teams are now two different levels. Teams right below the org are Departments, and those inside them are Teams. An admin can rename the levels, up to five, in Admin → Departments → Level names. The new `GET`/`PUT /v1/admin/levels` endpoints are audited as `levels.renamed` (identity contract 1.12.0), and a level deeper than the last name takes that name.

  Each floor's `level` reaches the shell and apps: identity's floors, and `WorkspaceRef.level` in SDK 1.9. Apps can say it where they'd say "team", and `kind` stays `team` at every level, so no app breaks.

  The shell names the level on the title card, the gauge, Account and the top left. A department also has its own icon and water colours, from the new tokens `floor-department-low` (violet) and `floor-department-high` (lavender, also its gauge mark). The kit adds `floorTone()`, `floorKindOf()`, `floorIconOf()` and `teamDepth()`, and `ShellFloorRef.level`.

### Patch Changes

- 2a05a51: Artifacts gets the three-column app layout from the live session with Harry: a rail that folds to icons (the app's name on top opens its front page, then Your collections, Shared libraries, From below, and the open collection), the content in the middle with Back above its title and a search above the grid, and a drawer on the right that says what's on screen. Collections, folders and documents are tiles that answer hover by rank; right-click one, or the empty grid, for a ring of what can be done with it. The front page shows only what needs you, what's new, and your collections. What was "Published to you" sits under Shared libraries. The reader keeps its facts and actions in the drawer too.

  New in the kit: `ui-tile`/`ui-tiles`, `ui-toolbar`, `ui-radial-menu`, and `ui-app-frame` gains a folding rail and a drawer. `pnpm dev:app` now runs on Windows.

- b72d1df: The front door now sends text compressed (gzip): the shell, the kit and apps' bundles go out at about a third of their size (the kit 429 kB → 127 kB). The notification stream isn't compressed, so it's never held back.
- Updated dependencies [2a05a51]
- Updated dependencies [4c1bb55]
- Updated dependencies [5ab5009]
  - @augur/ui-kit@1.8.0
  - @augur/mfe-sdk@1.9.0

## 0.10.1

### Patch Changes

- Updated dependencies [bb91780]
- Updated dependencies [bef7098]
- Updated dependencies [e0e9c83]
  - @augur/mfe-sdk@1.8.0
  - @augur/ui-kit@1.7.0

## 0.10.0

### Minor Changes

- 5b2c80c: Feature previews (SDK 1.7): an app lists features it's trying in its manifest's `previews` and asks `ctx.previewOn(id)`. Admins choose who gets each in Admin → Apps (off, for those who turn it on, or everyone; opt-in by default on a preview server, off on a production one), people turn opt-in ones on in the shell's Previews, and the shell marks an app with one on. A preview past its `until` day is off for everyone. Registry contract 1.27.0 (docs/release-channels.md, "Feature previews").

### Patch Changes

- 5119d47: The live dev loop: `pnpm dev:app <id> --kit` rebuilds the UI kit, its tokens and the shared modules as you change them and reloads the page; `DEV_PREVIEWS` turns an app's feature previews on in the stand-in; `DEV_HOST` opens the dev server to the tailnet. Each pull request's CI keeps its Storybook as an artifact (docs/release-channels.md, "The live dev loop").
- Updated dependencies [5b2c80c]
  - @augur/mfe-sdk@1.7.0

## 0.9.1

### Patch Changes

- 2c9caf0: App kit, part 1: nothing is obtuse. `ui-button` and `ui-icon-button` take a `reason`: disabled with one, they stay focusable and say why on hover and focus, and it's read aloud. List rows, list actions and menu entries take a `reason` too. The kit warns on localhost about a disabled control without one, and `pnpm check:reasons` fails a platform screen that has one. New parts: `ui-notice` (one sentence that needs attention, with one action), `ui-note` (a quiet line with its `why` one press away) and `ui-can` (what you can do here, and who can do the rest). Every disabled control in Admin, the shell, Artifacts, Mandate and Data Atlas now says why, and ones that were only waiting for a request show as busy instead.
- 858b234: An app answering a request (a picker, or any app opened over another) is mounted once per request. Before, the catalogue loading again while its dialog was open mounted it a second time, so whatever the person had started in it was lost.
- Updated dependencies [effebfe]
- Updated dependencies [84fab17]
- Updated dependencies [2c9caf0]
- Updated dependencies [b716037]
- Updated dependencies [2487ae0]
  - @augur/ui-kit@1.6.0

## 0.9.0

### Minor Changes

- d68128b: Every app now stands on the same ground, the flat slate Artifacts is drawn on, instead of on the Calm Tide water. Title and Orbit keep their water. `ui-shell`'s still ground (`background="none"`) is that flat slate now. Moving to another floor while inside an app no longer shows the water during the move, because the ground stays as it was while the next floor's catalogue loads.
- 7ee3531: Back in the top bar is gone. Beside the floor, two round buttons go to **Home** and to **All apps** (Title) from any screen, inside an app or not, and the one you're on is marked. On a floor without Home, Home stays and says why. New `ui-shell` property `navs` (`ShellNav[]`) and event `ui-nav`; `backTo` and `ui-back` still work for a host that sets them, but the shell no longer does. This also fixes the way out of an app opened from Title or Orbit doing nothing, because the shell still thought the move in was under way. Esc goes up one level as before.
- a9cfcf7: The floor gauge opens out smoothly. Pointing at it or tabbing into it, each floor's label grows from nothing to its size while it fades in, the gaps widen, and the pinned app icon shrinks away, so nothing jumps. It closes the same way. In an app that shows the same on every floor, the gauge rests: it stays in view, dimmed, and pointing at it says why, and Page Up and Page Down don't move floors. Apps say this with the new manifest field `sameOnEveryFloor` (SDK 1.6, registry contract 1.22.0), and Admin sets it. `ShellApp` gains `sameOnEveryFloor`, and `ui-shell` gains `floorsRest`.

### Patch Changes

- Updated dependencies [d68128b]
- Updated dependencies [7ee3531]
- Updated dependencies [d52bfce]
- Updated dependencies [a9cfcf7]
  - @augur/ui-kit@1.5.0
  - @augur/mfe-sdk@1.6.0

## 0.8.0

### Minor Changes

- 1580b6b: Title shows what an app covers, not how to get around in it. An app may name up to six `areas` in its manifest (SDK 1.5), and each menu group its `area`. Title lists an app's areas, each opening its Orbit at the area's first group; an app with one area or none is a choice by itself, captioned with its description, so nothing is offered twice. Orbit keeps an area's groups together and names the area before the group ("Organisation / People"), and the area sits under the app's name below the handle. A group with one page is that page. Nothing repeats the label or icon of what it sits under: the registry warns when a manifest does (`menuWarnings`, also printed by `pnpm check:manifest`) and still accepts it. Admin has two areas, Organisation and System, with new kit icons `list`, `structure`, `server` and `gauge`. `ui-centre-menu` takes a category with no items as a choice by itself, and a category `section` that Orbit names before it.
- 8f69cb5: Moving between floors travels: what you're looking at leaves the way you're going (going up, it sinks away; going down, it rises away; across, it slides aside), the host waits for that before taking the app down, and the next floor comes in from the other side. Each arrival plays an area title card in place of the floor-name pill: the kind of floor, its name set large, and who sees what's there. Opening an app plays its card too, the app's name under the floor it opened on, once per app rather than on every page. Cards are built from the floor or app, never written by hand, leave off a kicker that would only repeat the name, ignore the pointer, end on any key, press or scroll, and fade out where they are. A new Area titles switch in Settings turns them off, saved with a person's preferences (`areaTitles` in Identity). `ui-shell` gains `leaveFloor()`; new tokens `travel-floor` (96px) and `motion-title` (2400ms); kit exports `floorKindName` and `FloorDirection`. Under reduced motion nothing travels and cards appear and fade in place.
- ae92eed: Moving between Title, Orbit and an app is one motion: what you chose is carried from where it was to where it lands. The menu steps aside (deeper into Title or Orbit, or down on Back), the chosen icon or app name flies to its place on the next screen, and an opened app rises a short way into place while its surfaces settle in one after another. Leaving an app sinks it before Orbit comes back. A key or press during a move jumps it to its end, and "Opening…" shows only when an app takes longer than 400ms. New kit `motion.ts` exports `motionMode()`, `liftGhost()`, `finishMotion()` and `moving()`; `ui-shell` gains `arrive()`, `sink()`, `settleStage()` and `placeTitle`, and `ui-centre-menu` gains `leave()`, `focusedIcon()` and `focusedRect()`. Reduced motion is one switch: the system setting or `data-motion="reduce"` sets every motion token near zero in the kit's base styles, stops loops, and leaves only crossfades. New token `travel-near` (24px).
- 28d8775: The shell's top bar is chrome, never a surface. On every screen it rests on a fade of the new `scrim` token over the water or the app, and Title's letterbox is a fade too, so the water shows through. Top left shows only the floor you're on, its icon and name, with no breadcrumb path. While an app is open, its name sits under the look-up handle (`area` adds the part of it you're in), and the handle takes the floor's colour. **Back** (`backTo`, `ui-back`) replaces All apps (`ui-home`): it goes up one level, the same as Esc, worked out from where you are rather than per app. The app's top edge fades in under the band, and the tab's title names the page, app and floor.

### Patch Changes

- Updated dependencies [1580b6b]
- Updated dependencies [d324552]
- Updated dependencies [18bf27c]
- Updated dependencies [f01fcea]
- Updated dependencies [8f69cb5]
- Updated dependencies [b556614]
- Updated dependencies [513e2e9]
- Updated dependencies [feeffdd]
- Updated dependencies [ae92eed]
- Updated dependencies [778b6f9]
- Updated dependencies [513e2e9]
- Updated dependencies [28d8775]
  - @augur/mfe-sdk@1.5.0
  - @augur/ui-kit@1.4.0

## 0.7.0

### Minor Changes

- 9dfd714: The front door holds callers to limits. Keycloak's own admin console and its `master` realm answer 404 unless `KEYCLOAK_CONSOLE=open`. Each address gets a request rate for the API (`API_RATE_PER_SECOND`, `API_RATE_BURST`) and for sign-in (`SSO_RATE_PER_SECOND`, `SSO_RATE_BURST`), and is answered 429 past it. The address comes from `X-Forwarded-For`, which is believed only from private addresses. The largest upload is `MAX_UPLOAD_MB`. See docs/deploy.md, "Limits at the front door".

## 0.6.0

### Minor Changes

- 70df61e: An app can keep its menu inside it: `"orbit": false` in its manifest (SDK 1.4) means the shell never shows its Orbit. Its root opens the app, Title still lists its menu and opens the chosen category's first page, and Esc stays with the app. The band now names the open app after the floor, with **All apps** (`ui-home`) as the deliberate way back to Title. The floor gauge pins the open app beside the floor you're on and, pointed at or tabbed into, opens out to say what each floor is, who sees it, and which one the app is showing; Account's floor list says the same. Changing floor no longer mounts the app twice, once against the last floor's catalogue: nothing of the old floor's stays mounted until the new floor's catalogue arrives.
- aa0f0f4: An app's developers get Previews in the shell's band: each of their apps' pull requests' previews running on the server, to switch to for themselves and back. While one is in use, the shell says so at the bottom of the screen, with a link to the pull request and the way back. The kit gains a `preview` icon.

### Patch Changes

- Updated dependencies [70df61e]
- Updated dependencies [aa0f0f4]
  - @augur/mfe-sdk@1.4.0
  - @augur/ui-kit@1.3.0

## 0.5.1

### Patch Changes

- 94d0c0c: Folio ships with AUGUR. The release builds its images and pins its version, the deploy stack runs it (`folio`, `folio-worker`, its frontend in `web`) and it registers itself on first start with no admin step. The registry's `PILLAR_APPS` are given the scopes their release asks for, can't be pinned to a version, and can be turned off but not removed (409); Admin shows them as shipping with AUGUR, without versions to go back to or a sign-in to issue. The updater restarts Folio and its worker in an upgrade. The service kit works out a bucket key's id from its secret (`bucketKeyIdFor`), so apps need only `S3_SECRET_ACCESS_KEY`. The shell's dev-app mode takes other apps beside the one being developed (`DEV_ALSO`), and the contract tests run with Folio on and off.
- a3da8c7: An intent raised for an app with a menu (from a Home card, a notification's action or another app) now opens the app to answer it, instead of stopping at the app's Orbit with the intent still waiting.
- Updated dependencies [043d5d3]
- Updated dependencies [c95e799]
- Updated dependencies [936bb00]
- Updated dependencies [f1b5773]
- Updated dependencies [d5d54cc]
- Updated dependencies [22be7f4]
- Updated dependencies [a25ab8a]
  - @augur/mfe-sdk@1.3.0
  - @augur/ui-kit@1.2.0

## 0.5.0

### Minor Changes

- a3ba7ef: Admin → Updates can ask for an upgrade. **Upgrade to …** records the wanted release in the registry (`PUT /v1/platform/upgrade`, audited), after the admin enters their password again: the gateway now passes on when the caller last signed in (`x-user-signed-in-at`, `Caller.signedInAt`, `signedInRecently()` in the service kit), and the shell's `/auth/again?return=<path>` asks for the password and comes back. The deployment's updater (signed in as `platform-updater`) reads the upgrade from `/v1/platform/upgrade/target` and reports each step to `/v1/platform/upgrade/progress`; Updates follows along and says how it ended. An upgrade nothing has started can be cancelled.

### Patch Changes

- Updated dependencies [972d0ed]
  - @augur/mfe-sdk@1.2.0

## 0.4.0

### Minor Changes

- 1622cd9: The platform is now called AUGUR. Packages move from `@platform/*` to `@augur/*`, and the shell's title, `<ui-shell>`'s default product name, Admin and new sign-in realms say AUGUR. Running servers keep their realm, database, Compose project and `.env` names; see docs/upgrade.md. The shell's import map still answers to `@platform/ui-kit`, so apps built before the rename keep loading.

### Patch Changes

- 8c0a9c8: Servers run released images instead of building them. Each AUGUR release now builds, pushes and signs (cosign, keyless) the web, gateway, identity, registry, events and models images to `ghcr.io/<repo>/<part>:<version>`, and its `augur-release.json` asset names each by digest. `infra/deploy/compose.yml` runs `${PLATFORM_IMAGES}/<part>:${PLATFORM_VERSION}` (new setting `PLATFORM_VERSION`, optional `PLATFORM_IMAGES` for a mirror); `compose.build.yml` builds from the checkout instead. The images run as unprivileged users, and the web container listens on 8080. See "Images from releases" in `docs/upgrade.md`.
- Updated dependencies [1622cd9]
  - @augur/ui-kit@1.1.0
  - @augur/mfe-sdk@1.1.1

## 0.3.0

### Minor Changes

- d14956f: An app can be on for one floor and off for another. The registry keeps three separate things: whether an app is turned on at all (as before), installs per floor in a new `registry.installs` table (on or off, carrying on to the teams below unless told not to), and guardrails in `registry.guardrails`, where a block on a floor wins over anything below it. Everyone's own floor follows the org. Manifests gain `floors` (the kinds of floor an app works on) and a checked `surfaces` block (page, card, panel, settings or admin per kind of floor, with an optional role and roll-up). `GET /v1/manifest?workspace=` lists the apps on for the floor the gateway checked, and grants now hold only where an app is on. Admins set floors with `PUT /v1/apps/{id}/floors/{workspace}` and see them with `GET /v1/apps/{id}/floors`; a new version asking for more scopes is served but gets them only after `PUT /v1/apps/{id}/scopes`. Identity tells platform services where a floor sits (`GET /v1/workspaces/{id}`, read with the service kit's `floorPlaces`) and offers the roll-up `GET /v1/me/workspaces/{id}/rollup`. The shell asks for the catalogue of the floor you're on and asks again when you move. Admin, Apps shows where each app is on, floor by floor, with a choice for each, and lets an admin allow scopes a new version asks for. Services need `IDENTITY_URL` (set in both compose files).
- 7c92125: A developer kit for app builders. `pnpm create-app <id>` writes a new app (frontend, service, manifest and changeset) into `apps/<id>`. `pnpm dev:app <id>` runs it in the real shell, signed in as a stand-in person, with the app's frontend from source and its service beside it, and nothing else of the platform needed; the shell gains this as a dev-only mode (`DEV_APP`). `pnpm check:manifest` puts every app's manifest to an in-memory registry in CI, so it fails on what the registry would refuse. `docs/build-an-app.md` goes from nothing to an app in the shell. Also fixes the shell's dev server after the import map: the shared kit is built into `shared-build/` and served from there, since Vite refused to load the shell's own imports from `public/`.
- d1f8c5e: Notifications and the audit log know their floor. A service call that names a floor records it on each notification and audit entry, with the floor's path from the root as it stood then (asked of identity), so "everything under Finance" stays right after a team moves. `GET /v1/audit?workspace=` filters to a floor and the floors below it; admins read the whole log and a lead their own floor's. Team notices are opt-in per team (`PUT /v1/team-notices/{workspace}`, by its leads or an admin): `notify` with `toTeam` reaches everyone on the team as it is when sent, asked of identity's new `GET /v1/workspaces/{id}/people`. Identity records department changes on the department's floor, and the registry records floor rules on theirs. The shell tags a notification from another floor with its name, puts a dot on the gauge (and a count in Account) where something waits, and opening one goes to its floor. Admin, Activity filters by floor and says which floor an app was turned on, off or blocked for.
- 9fe54e8: Find searches apps' own content (SDK 1.3). An app that declares `"search": true` in its manifest (the registry now accepts it) answers `GET /v1/search?q=` on its service with `{ results: [{ id, title, detail?, path?, workspace? }] }` (`SearchAnswer` and `SearchResult` in the SDK). As the person types, after a short pause and from two letters, the shell asks every such app on the current floor at once, through the gateway with the floor attached. Each app's results (at most ten, the current floor's first, others tagged with their floor) show under its name after Apps and Pages as they arrive. One still answering says "Still looking…" and one that takes longer than 1.5 seconds is let go, so none holds up the rest. Choosing a result opens its app at its `path`, on its floor. `ui-shell` takes `findGroups` beside `findResults` for results grouped and still coming. The contract tests check that Find asks the reference app on the floor and opens what it answers, and that a slow app doesn't hold Find up.
- bacd56f: Floors you can see. `ui-shell` takes `floors` and `floor`: the top left shows the current floor's icon and its breadcrumb from the org (each step goes up to it), a gauge at the right edge has a notch per floor from yours to the org, Account lists every floor in place of Switch workspace, and Page Up and Page Down go up or down a floor once the page is at its top or bottom (Alt for at once). It fires `ui-floor` with `{ id, direction }`, and a new `floor` plays the move: the floor's name shows for a moment, the app fades in, and the water slides in from above or below. `ui-wave-background` gains `level` and `move(direction)`, gliding colours and height between floors (a plain cross-fade under reduced motion). New `floor-you-*`, `floor-team-*` and `floor-org-*` colour tokens (one shared team colour), an `org` icon, and `floorStack`, `floorBeside` and `floorDirection` helpers. The shell passes the person's floors to `ui-shell` and keeps you in the same app when you change floor.
- 6da9dba: Home shows what needs you (SDK 1.2). Under the greeting, a count ("3 things need you"), then every unread notification that needs you, with its actions inline (muted apps left out), then up to six glance cards in recent-app order; with nothing at all, "Nothing needs you right now". A card is an app's `card` surface for the kind of floor: the manifest's `module` names a key of the new `surfaces` on the entry's default export (`MicroFrontend.surfaces`, `Surface`, and `AppManifestEntry.surfaces` and `floors` in the SDK), and the shell mounts it with the app's own context; a card that's missing or fails says so in its tile. Home is still an app: it hears from the shell on its own `shell.home.*` bus events. The kit gains `ui-list` (rows with a lead mark, detail, time and up to two actions; groups, the first that needs you pings, loading, empty and error) and `ui-state` (empty, loading after 300ms, error, offline), and `ui-shell` fires `ui-notifications` whenever its notifications or mutes change. `pnpm dev:app` puts Home in the stand-in catalogue so an app's card can be seen, and the contract tests check Home's actions and a glance card.
- 94ea6cc: Notifications can carry actions, and the stream is grouped by app (SDK 1.2). `ctx.notify({ …, actions })` and the service kit's `notify` take up to two `{ label, intent }` buttons; pressing one in the stream raises its intent through the shell exactly as `ctx.raise` does (on the notification's own floor when it's from another) and marks it read, so no app code runs in the stream. The events service checks and keeps them (`actions` on `POST /v1/notifications`, a payload of at most 1 KB, migration `003_actions`), and sends a notification too big for Postgres's 8000-byte notify by id. The stream groups by app, apps with something that needs you first; each group's ⋯ mutes the app, which keeps its notifications in the stream silently (no pulse, not counted in the band) and saves `muted` in preferences, which identity now accepts. The contract tests check that an action raises its intent, skipping it for builds from before SDK 1.2. The kit gains `ui-menu` (a short list of actions from a button, with keys, danger last) and the `more` and `mute` icons.
- 211bd32: Settings shows what's running (the shell's version and the SDK's), through a new `version` property on `ui-shell`. The Board and Palette sample apps are gone, and the server setup no longer builds or registers them; docs/deploy.md says how to remove them from a server that has them.
- bffdd14: Apps know which floor they're on (SDK 1.1). `MountContext` gains `workspace` (the floor's id, kind, name, slug, path from the org and the person's role), `getWorkspace()` and `fetch(path, init)`, which calls the gateway with the person's token and `X-Workspace-Id`; the SDK exports `floorFetch` and the `Workspace` types. The shell loads the person's floors at sign-in, puts the floor at the start of every address (`/@me/…`, `/@finance/…`, `/@org/…`; an address without one opens on your own floor), shows "You're not on that floor" for one you can't go to, and mounts the open app again when the floor changes. The Account line shows the current floor instead of the first department. Home names the floor over its greeting, except on your own. `pnpm dev:app` puts you on your own floor, with the org's at `/@org/…`; the contract tests check `ctx.workspace` and `ctx.fetch`, skipping them for builds from before SDK 1.1.
- 9681bff: The shell serves the UI kit and Lit once, through an import map, and the shell and every app share that copy. Apps' builds leave `lit`, `lit/*` and `@augur/ui-kit` external using `isSharedModule` from the new `@augur/mfe-sdk/build`, which lists exactly what the shell provides. Home's bundle drops from 208 KB to 1 KB and Admin's from 266 KB to 59 KB. The kit goes to 1.0.0 and keeps the SDK's versioning promise: within SDK 1.x the shell serves kit 1.x and Lit 3.x, and a breaking kit change ships with an SDK major.
- 778157a: Shell alpha: settings, Away and recent apps save to each person's account through a new Identity preferences API (`/v1/me/preferences`); Find also searches every app's menu pages and opens them; Agents, Switch workspace and the unbuilt Admin app are hidden until they exist. The UI kit adds `reducedMotion()`, which honours `data-motion="reduce"` on `<html>`, and `canSwitchWorkspace` on `ui-shell`.

### Patch Changes

- b92585d: Admin app for people, departments and apps, so nobody needs Keycloak's console. Identity gains an admin API (`/v1/admin/people`, `/departments`, `/roles`) that manages people, roles and departments in Keycloak and audits every change; an admin can't turn off their own sign-in or remove their own admin role. The registry lists the whole catalogue for admins (`GET /v1/apps`) and lets them turn an app off and on (`PATCH /v1/apps/:id`); an app that is off stays off when it registers again. Admin now appears for admins. The UI kit adds `ui-select`, `ui-toggle` and `ui-checkbox-group`, four icons (`user-plus`, `department`, `key`, `plus`), and dialogs scroll inside instead of running off the screen.
- 8b41beb: Contract tests: a reference app that uses every part of the mount context, opened in the real shell in a browser and checked, both as built today and as built against each earlier SDK minor (kept in `platform/contract/frozen/`, starting with 1.0). A CI job runs them, so a shell or SDK change that breaks an app fails CI. The shell's dev-app mode takes `DEV_APP_ENTRY` to mount a built entry instead of the source.
- 6543ced: The shell accepts a path for `VITE_OIDC_AUTHORITY` (like `/sso/realms/platform`), resolved against the address it is served from, so one build works behind any hostname. Adds `infra/deploy`: the whole platform in Docker Compose on one server, reached over Tailscale (see docs/deploy.md).
- 1981198: Apps can only load from allowed places. The registry refuses an app whose entry is a full address on a site an admin hasn't allowed (`/v1/origins`, audited as `origin.allowed` and `origin.removed`), and stops offering apps from a site once it's removed, marking them `blocked` in the catalogue. Admin's Apps screen gains "Where apps load from" to add and remove sites, and shows blocked apps. The shell's page is served with a Content Security Policy: scripts only from the platform, its import map and the sites in `APP_ORIGINS`.
- Updated dependencies [b92585d]
- Updated dependencies [0ba927c]
- Updated dependencies [d1f8c5e]
- Updated dependencies [9fe54e8]
- Updated dependencies [bacd56f]
- Updated dependencies [6da9dba]
- Updated dependencies [94ea6cc]
- Updated dependencies [211bd32]
- Updated dependencies [bffdd14]
- Updated dependencies [9681bff]
- Updated dependencies [778157a]
  - @augur/ui-kit@1.0.0
  - @augur/mfe-sdk@1.1.0

## 0.2.0

### Minor Changes

- b705f16: Version the HTTP APIs and report releases on health. Each service's API now lives under `/v1` (through the gateway, `/api/<service>/v1/...`), matching its OpenAPI contract's major version, and `GET /healthz` answers with the service's release and API version. The registry requires every app to say which SDK releases it works with (`sdk`, a semver range) and a semver `version`; the shell won't open an app whose range its SDK doesn't satisfy, and says why.
