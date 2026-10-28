# @augur/mfe-sdk

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
