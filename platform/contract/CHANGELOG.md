# @augur/contract-tests

## 0.1.9

### Patch Changes

- Updated dependencies [bb91780]
- Updated dependencies [bef7098]
- Updated dependencies [e0e9c83]
  - @augur/mfe-sdk@1.8.0
  - @augur/ui-kit@1.7.0

## 0.1.8

### Patch Changes

- Updated dependencies [5b2c80c]
  - @augur/mfe-sdk@1.7.0

## 0.1.7

### Patch Changes

- 1f4a10f: The contract tests run as many builds of the reference app at once as the machine's cores allow as well as its memory (two cores each), so a small CI runner no longer starves them into timeouts. `CONTRACT_AT_ONCE` sets the number outright.
- Updated dependencies [effebfe]
- Updated dependencies [84fab17]
- Updated dependencies [2c9caf0]
- Updated dependencies [b716037]
- Updated dependencies [2487ae0]
  - @augur/ui-kit@1.6.0

## 0.1.6

### Patch Changes

- Updated dependencies [d68128b]
- Updated dependencies [7ee3531]
- Updated dependencies [d52bfce]
- Updated dependencies [a9cfcf7]
  - @augur/ui-kit@1.5.0
  - @augur/mfe-sdk@1.6.0

## 0.1.5

### Patch Changes

- a96a446: The contract tests run as many builds of the reference app at once as the machine's memory allows (about 2.5 GB each), so a smaller CI runner no longer has one killed part way through.
- 1580b6b: Keeps the reference app built against SDK 1.4 (`frozen/sdk-1.4`), so every later shell is tested against it, and checks that Title shows an app without areas as itself.
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

## 0.1.4

### Patch Changes

- a69a8fb: Keeps the reference app built against SDK 1.3 (`frozen/sdk-1.3`), so every later shell is tested against it, and runs the Folio intent checks on builds from SDK 1.3 on, the release that added them.
- Updated dependencies [70df61e]
- Updated dependencies [aa0f0f4]
  - @augur/mfe-sdk@1.4.0
  - @augur/ui-kit@1.3.0

## 0.1.3

### Patch Changes

- 94d0c0c: Folio ships with AUGUR. The release builds its images and pins its version, the deploy stack runs it (`folio`, `folio-worker`, its frontend in `web`) and it registers itself on first start with no admin step. The registry's `PILLAR_APPS` are given the scopes their release asks for, can't be pinned to a version, and can be turned off but not removed (409); Admin shows them as shipping with AUGUR, without versions to go back to or a sign-in to issue. The updater restarts Folio and its worker in an upgrade. The service kit works out a bucket key's id from its secret (`bucketKeyIdFor`), so apps need only `S3_SECRET_ACCESS_KEY`. The shell's dev-app mode takes other apps beside the one being developed (`DEV_ALSO`), and the contract tests run with Folio on and off.
- Updated dependencies [043d5d3]
- Updated dependencies [c95e799]
- Updated dependencies [936bb00]
- Updated dependencies [f1b5773]
- Updated dependencies [d5d54cc]
- Updated dependencies [22be7f4]
- Updated dependencies [a25ab8a]
  - @augur/mfe-sdk@1.3.0
  - @augur/ui-kit@1.2.0

## 0.1.2

### Patch Changes

- Updated dependencies [972d0ed]
  - @augur/mfe-sdk@1.2.0

## 0.1.1

### Patch Changes

- ab0c210: The contract tests run every build of the reference app side by side, each on its own port, instead of one after another.
- ddaf9f9: Keep the reference app built against SDK 1.1.0 (`frozen/sdk-1.1`), so every later shell is tested against apps built for 1.1 as well as 1.0.
- Updated dependencies [1622cd9]
  - @augur/ui-kit@1.1.0
  - @augur/mfe-sdk@1.1.1

## 0.1.0

### Minor Changes

- 8b41beb: Contract tests: a reference app that uses every part of the mount context, opened in the real shell in a browser and checked, both as built today and as built against each earlier SDK minor (kept in `platform/contract/frozen/`, starting with 1.0). A CI job runs them, so a shell or SDK change that breaks an app fails CI. The shell's dev-app mode takes `DEV_APP_ENTRY` to mount a built entry instead of the source.
- 9fe54e8: Find searches apps' own content (SDK 1.3). An app that declares `"search": true` in its manifest (the registry now accepts it) answers `GET /v1/search?q=` on its service with `{ results: [{ id, title, detail?, path?, workspace? }] }` (`SearchAnswer` and `SearchResult` in the SDK). As the person types, after a short pause and from two letters, the shell asks every such app on the current floor at once, through the gateway with the floor attached. Each app's results (at most ten, the current floor's first, others tagged with their floor) show under its name after Apps and Pages as they arrive. One still answering says "Still looking…" and one that takes longer than 1.5 seconds is let go, so none holds up the rest. Choosing a result opens its app at its `path`, on its floor. `ui-shell` takes `findGroups` beside `findResults` for results grouped and still coming. The contract tests check that Find asks the reference app on the floor and opens what it answers, and that a slow app doesn't hold Find up.
- 6da9dba: Home shows what needs you (SDK 1.2). Under the greeting, a count ("3 things need you"), then every unread notification that needs you, with its actions inline (muted apps left out), then up to six glance cards in recent-app order; with nothing at all, "Nothing needs you right now". A card is an app's `card` surface for the kind of floor: the manifest's `module` names a key of the new `surfaces` on the entry's default export (`MicroFrontend.surfaces`, `Surface`, and `AppManifestEntry.surfaces` and `floors` in the SDK), and the shell mounts it with the app's own context; a card that's missing or fails says so in its tile. Home is still an app: it hears from the shell on its own `shell.home.*` bus events. The kit gains `ui-list` (rows with a lead mark, detail, time and up to two actions; groups, the first that needs you pings, loading, empty and error) and `ui-state` (empty, loading after 300ms, error, offline), and `ui-shell` fires `ui-notifications` whenever its notifications or mutes change. `pnpm dev:app` puts Home in the stand-in catalogue so an app's card can be seen, and the contract tests check Home's actions and a glance card.
- 94ea6cc: Notifications can carry actions, and the stream is grouped by app (SDK 1.2). `ctx.notify({ …, actions })` and the service kit's `notify` take up to two `{ label, intent }` buttons; pressing one in the stream raises its intent through the shell exactly as `ctx.raise` does (on the notification's own floor when it's from another) and marks it read, so no app code runs in the stream. The events service checks and keeps them (`actions` on `POST /v1/notifications`, a payload of at most 1 KB, migration `003_actions`), and sends a notification too big for Postgres's 8000-byte notify by id. The stream groups by app, apps with something that needs you first; each group's ⋯ mutes the app, which keeps its notifications in the stream silently (no pulse, not counted in the band) and saves `muted` in preferences, which identity now accepts. The contract tests check that an action raises its intent, skipping it for builds from before SDK 1.2. The kit gains `ui-menu` (a short list of actions from a button, with keys, danger last) and the `more` and `mute` icons.

### Patch Changes

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
