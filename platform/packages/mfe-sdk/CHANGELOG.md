# @augur/mfe-sdk

## 2.1.0

### Minor Changes

- 8eba62b: Apps say they bind their things to entities with `links: { entities: true }` and name the types they bind in `bindings` (lowercase, up to 10, never `entity` or `role`; SDK 2.1, ADR 0066). The registry lists those apps and types for any service at `GET /v1/entity-links`, and the service kit's `registryBindingApps` reads it, cached, so a follower such as Data Atlas subscribes to exactly `<app>.<type>.entity-bound` and `-unbound`.

## 2.0.0

### Major Changes

- cbd1abc: SDK 2.0 (PER-264). The shell no longer serves `lit` or `@augur/ui-kit`: `sharedModules` lists React, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-dom`, `react-dom/client`, `@augur/kit-common` and `@augur/app-kit`, and nothing else. Everything else in the SDK is as it was in 1.11. An app built against 1.x that never imported Lit keeps working: widen its manifest's `sdk` range to `^1.x || ^2.0.0` and it opens on a 2.0 shell. An app that imports Lit must move to React and Quill first (docs/build-an-app.md).

### Minor Changes

- f12bbaf: Apps get the person's date formats (PER-323): `ctx.formats` (SDK 2.0) carries their `language`, the `locale` to write dates in, their `timeZone` and `hourCycle`, read live from Account's Language and region. Additive: an older shell leaves it out.
- 4f8d944: Apps declare the kinds of notification they send in `notifications.kinds` (id, label, detail; up to 10), and `NotifyMessage` gains `kind` (SDK 1.13). The registry names them in an app's grants, and the service kit's `registryNotificationKinds` looks them up, so the events service can check them and people can choose each kind in Account.

## 1.12.0

### Minor Changes

- 7518ce8: Apps declare the kinds of work they put in people's inboxes in their manifest's `inbox.kinds` (SDK 1.12: `id`, `label`, `icon`, up to 10), and the events service refuses an item of a kind the app doesn't declare. The registry names them in an app's grants (`inboxKinds`), read with `registryInboxKinds` from the service kit. The SDK gains the Inbox's types (`InboxItem`, `InboxKind`, `InboxCounts`, `InboxChange`) and `INBOX_TOPICS`.
- cceb953: People and teams for the people picker. Identity answers a signed-in person at `GET /v1/me/directory` (API 1.15): people by name or email and teams by name, or named by id. The SDK's new `searchPrincipals` and `namePrincipals` ask it through `ctx.fetch` and answer in the shape Quill's `PeoplePicker` takes, so an app hands one straight to the other. They reject with `DirectoryUnavailable`, whose message can be shown as it is.

## 1.11.0

### Minor Changes

- 2c37293: Apps that ship with AUGUR now say what kind they are (ADR 0032). SDK 1.11 adds an optional `category` to the manifest (`platform` or `pillar`), with `AppCategory` and `APP_CATEGORIES`. The registry counts Home, Admin and the Upgrade Centre as platform apps, honours the kind only for apps that ship with AUGUR or come from the signed app feed, and reports the kind in force in `/v1/manifest`, `/v1/me/apps` and `/v1/apps`, which also gain `ships` (the old `pillar` stays, deprecated). Admin → Apps shows a Kind column, says the kind in each app's dialog and explains a claim it doesn't honour, and says AUGUR instead of "platform" in what it shows.
- 2ad8555: `ctx.fetch` adds the person's token and the floor only to requests for AUGUR's own origin (the gateway); a request to another site goes without them, so an app fetching a public resource never hands it the person's sign-in. The production import map's `react/jsx-dev-runtime` now has a working `jsxDEV` (made from `jsx`), so an app built in development mode renders against a production shell.
- 5ad27cc: Back and Forward inside an app no longer throw away what it holds (PER-308). SDK 1.11 adds `followsAddress` to the manifest, for an app that follows the address itself, and `navigated(el, path)` on the app. While an app with both stays open on the same floor and nothing is waiting for it, the shell keeps it mounted on a move inside its route and calls `navigated` with the new path; an intent, a request, another floor or a changed preview still mounts it again. An app without `navigated` is mounted again as before, since the shell's own moves push the address without a popstate. The registry accepts the flag (contract 1.33.0).
- 8a89c6f: Adds `@augur/mfe-sdk/testing`, so an app can be tested without a running AUGUR: `fakeContext` gives a whole mount context that records what the app raised, requested and notified, and `contractHandlers` turns an OpenAPI contract into MSW handlers that answer with its examples.
- 49a631f: `SDK_VERSION` is typed as a string, so the SDK's API report no longer holds its value. Version packages PRs no longer fail the API check whenever the SDK's version moves.

  Not breaking: the value is unchanged, and code that compared it to a string or passed it on as one compiles as before.

## 1.10.0

### Minor Changes

- fccb126: The React kits begin (ADR 0015). Three new packages: Common (`@augur/kit-common`), which now holds the token files and builds a Tailwind v4 theme from them with nothing of Tailwind's own palette or scales; Quill (`@augur/app-kit`), the kit apps build with; and Aerie (`@augur/shell-kit`), the shell's own kit. The shell now serves React 19, Common and Quill through the import map (`sharedModules` in the SDK), and uses that copy of React itself. Aerie is never shared, and `pnpm check:boundaries` fails if anything but the shell imports it. The Lit kit is frozen through SDK 1.x and reads its tokens from Common; nothing looks different.
- d64d724: SDK 1.10: a generic `Ref` and `EntityBinding` for apps that bind their things to entities (ADR 0025), an optional reserved `marking` on every reference, and a reserved `ctx.focus` with a `focus` manifest field (ADR 0029). Nothing sets or enforces either yet. The registry accepts `focus` in a manifest.

## 1.9.0

### Minor Changes

- 5ab5009: Departments and teams are now two different levels. Teams right below the org are Departments, and those inside them are Teams. An admin can rename the levels, up to five, in Admin → Departments → Level names. The new `GET`/`PUT /v1/admin/levels` endpoints are audited as `levels.renamed` (identity contract 1.12.0), and a level deeper than the last name takes that name.

  Each floor's `level` reaches the shell and apps: identity's floors, and `WorkspaceRef.level` in SDK 1.9. Apps can say it where they'd say "team", and `kind` stays `team` at every level, so no app breaks.

  The shell names the level on the title card, the gauge, Account and the top left. A department also has its own icon and water colours, from the new tokens `floor-department-low` (violet) and `floor-department-high` (lavender, also its gauge mark). The kit adds `floorTone()`, `floorKindOf()`, `floorIconOf()` and `teamDepth()`, and `ShellFloorRef.level`.

## 1.8.0

### Minor Changes

- bb91780: The standard unit intent (SDK 1.8): `UnitRef` and `isUnitRef`, `UNIT_OPEN` and `openUnit`, and `UNIT_LEVELS`. A unit is one place in a floor's library at any level (collection, subcollection, series, subseries or file). Artifacts handles `unit.open`, opening the library, the folder or the file.

## 1.7.0

### Minor Changes

- 5b2c80c: Feature previews (SDK 1.7): an app lists features it's trying in its manifest's `previews` and asks `ctx.previewOn(id)`. Admins choose who gets each in Admin → Apps (off, for those who turn it on, or everyone; opt-in by default on a preview server, off on a production one), people turn opt-in ones on in the shell's Previews, and the shell marks an app with one on. A preview past its `until` day is off for everyone. Registry contract 1.27.0 (docs/release-channels.md, "Feature previews").

## 1.6.0

### Minor Changes

- a9cfcf7: The floor gauge opens out smoothly. Pointing at it or tabbing into it, each floor's label grows from nothing to its size while it fades in, the gaps widen, and the pinned app icon shrinks away, so nothing jumps. It closes the same way. In an app that shows the same on every floor, the gauge rests: it stays in view, dimmed, and pointing at it says why, and Page Up and Page Down don't move floors. Apps say this with the new manifest field `sameOnEveryFloor` (SDK 1.6, registry contract 1.22.0), and Admin sets it. `ShellApp` gains `sameOnEveryFloor`, and `ui-shell` gains `floorsRest`.

## 1.5.0

### Minor Changes

- 1580b6b: Title shows what an app covers, not how to get around in it. An app may name up to six `areas` in its manifest (SDK 1.5), and each menu group its `area`. Title lists an app's areas, each opening its Orbit at the area's first group; an app with one area or none is a choice by itself, captioned with its description, so nothing is offered twice. Orbit keeps an area's groups together and names the area before the group ("Organisation / People"), and the area sits under the app's name below the handle. A group with one page is that page. Nothing repeats the label or icon of what it sits under: the registry warns when a manifest does (`menuWarnings`, also printed by `pnpm check:manifest`) and still accepts it. Admin has two areas, Organisation and System, with new kit icons `list`, `structure`, `server` and `gauge`. `ui-centre-menu` takes a category with no items as a choice by itself, and a category `section` that Orbit names before it.
- 778b6f9: The standard entity intents: `EntityRef` and `isEntityRef`, `ENTITY_OPEN`, `ENTITY_PICK` and `ENTITY_EXPLAIN`, and `openEntity`, `pickEntities` and `explainEntity`, beside the document ones. Data Atlas handles them.
- 513e2e9: The `entity.propose` intent and `proposeEntity`: an app offers words someone marked in a document (with the block they're in, and the sentence around them) to whichever app keeps entities, which asks what the thing is and files a proposal for that floor's leads to decide. Answers a `ProposalReceipt`.

## 1.4.0

### Minor Changes

- 70df61e: An app can keep its menu inside it: `"orbit": false` in its manifest (SDK 1.4) means the shell never shows its Orbit. Its root opens the app, Title still lists its menu and opens the chosen category's first page, and Esc stays with the app. The band now names the open app after the floor, with **All apps** (`ui-home`) as the deliberate way back to Title. The floor gauge pins the open app beside the floor you're on and, pointed at or tabbed into, opens out to say what each floor is, who sees it, and which one the app is showing; Account's floor list says the same. Changing floor no longer mounts the app twice, once against the last floor's catalogue: nothing of the old floor's stays mounted until the new floor's catalogue arrives.

## 1.3.0

### Minor Changes

- 043d5d3: `library.open` joins the standard document intents: `LIBRARY_OPEN`, the `LibraryRef` type, `isLibraryRef` and `openLibrary(ctx, ref)`.

## 1.2.0

### Minor Changes

- 972d0ed: Uploads and document intents (SDK 1.4). A manifest's `maxUpload` (MB, 1 to 2048; 10 without it) is the largest request the gateway lets through to the app's service. Bodies stream through nginx and the gateway without being held; one past the limit gets 413, by its length or as it streams. Admins can lower an app's limit in Admin, Apps (`PUT /v1/apps/{id}/upload-limit`, audited as `app.upload-limit-set`), and the manifest the registry serves carries the limit in force. The SDK adds the standard document intents: `DOCUMENT_OPEN`, `DOCUMENT_PICK`, `DocumentRef` `{ app, id, version?, title }`, `DocumentPick`, `openDocument`, `pickDocument` (which checks the answer) and `isDocumentRef`.

## 1.1.1

### Patch Changes

- 1622cd9: The platform is now called AUGUR. Packages move from `@platform/*` to `@augur/*`, and the shell's title, `<ui-shell>`'s default product name, Admin and new sign-in realms say AUGUR. Running servers keep their realm, database, Compose project and `.env` names; see docs/upgrade.md. The shell's import map still answers to `@platform/ui-kit`, so apps built before the rename keep loading.

## 1.1.0

### Minor Changes

- 9fe54e8: Find searches apps' own content (SDK 1.3). An app that declares `"search": true` in its manifest (the registry now accepts it) answers `GET /v1/search?q=` on its service with `{ results: [{ id, title, detail?, path?, workspace? }] }` (`SearchAnswer` and `SearchResult` in the SDK). As the person types, after a short pause and from two letters, the shell asks every such app on the current floor at once, through the gateway with the floor attached. Each app's results (at most ten, the current floor's first, others tagged with their floor) show under its name after Apps and Pages as they arrive. One still answering says "Still looking…" and one that takes longer than 1.5 seconds is let go, so none holds up the rest. Choosing a result opens its app at its `path`, on its floor. `ui-shell` takes `findGroups` beside `findResults` for results grouped and still coming. The contract tests check that Find asks the reference app on the floor and opens what it answers, and that a slow app doesn't hold Find up.
- 6da9dba: Home shows what needs you (SDK 1.2). Under the greeting, a count ("3 things need you"), then every unread notification that needs you, with its actions inline (muted apps left out), then up to six glance cards in recent-app order; with nothing at all, "Nothing needs you right now". A card is an app's `card` surface for the kind of floor: the manifest's `module` names a key of the new `surfaces` on the entry's default export (`MicroFrontend.surfaces`, `Surface`, and `AppManifestEntry.surfaces` and `floors` in the SDK), and the shell mounts it with the app's own context; a card that's missing or fails says so in its tile. Home is still an app: it hears from the shell on its own `shell.home.*` bus events. The kit gains `ui-list` (rows with a lead mark, detail, time and up to two actions; groups, the first that needs you pings, loading, empty and error) and `ui-state` (empty, loading after 300ms, error, offline), and `ui-shell` fires `ui-notifications` whenever its notifications or mutes change. `pnpm dev:app` puts Home in the stand-in catalogue so an app's card can be seen, and the contract tests check Home's actions and a glance card.
- 94ea6cc: Notifications can carry actions, and the stream is grouped by app (SDK 1.2). `ctx.notify({ …, actions })` and the service kit's `notify` take up to two `{ label, intent }` buttons; pressing one in the stream raises its intent through the shell exactly as `ctx.raise` does (on the notification's own floor when it's from another) and marks it read, so no app code runs in the stream. The events service checks and keeps them (`actions` on `POST /v1/notifications`, a payload of at most 1 KB, migration `003_actions`), and sends a notification too big for Postgres's 8000-byte notify by id. The stream groups by app, apps with something that needs you first; each group's ⋯ mutes the app, which keeps its notifications in the stream silently (no pulse, not counted in the band) and saves `muted` in preferences, which identity now accepts. The contract tests check that an action raises its intent, skipping it for builds from before SDK 1.2. The kit gains `ui-menu` (a short list of actions from a button, with keys, danger last) and the `more` and `mute` icons.
- bffdd14: Apps know which floor they're on (SDK 1.1). `MountContext` gains `workspace` (the floor's id, kind, name, slug, path from the org and the person's role), `getWorkspace()` and `fetch(path, init)`, which calls the gateway with the person's token and `X-Workspace-Id`; the SDK exports `floorFetch` and the `Workspace` types. The shell loads the person's floors at sign-in, puts the floor at the start of every address (`/@me/…`, `/@finance/…`, `/@org/…`; an address without one opens on your own floor), shows "You're not on that floor" for one you can't go to, and mounts the open app again when the floor changes. The Account line shows the current floor instead of the first department. Home names the floor over its greeting, except on your own. `pnpm dev:app` puts you on your own floor, with the org's at `/@org/…`; the contract tests check `ctx.workspace` and `ctx.fetch`, skipping them for builds from before SDK 1.1.
- 9681bff: The shell serves the UI kit and Lit once, through an import map, and the shell and every app share that copy. Apps' builds leave `lit`, `lit/*` and `@augur/ui-kit` external using `isSharedModule` from the new `@augur/mfe-sdk/build`, which lists exactly what the shell provides. Home's bundle drops from 208 KB to 1 KB and Admin's from 266 KB to 59 KB. The kit goes to 1.0.0 and keeps the SDK's versioning promise: within SDK 1.x the shell serves kit 1.x and Lit 3.x, and a breaking kit change ships with an SDK major.

## 1.0.0

### Major Changes

- First versioned release of the contract between the shell and apps. Exports `SDK_VERSION`, and every manifest entry says which SDK releases its app works with in `sdk`, a semver range such as `^1.0.0`. The shell refuses to open an app whose range its SDK doesn't satisfy.
