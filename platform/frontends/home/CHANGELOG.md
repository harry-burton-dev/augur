# @augur/home

## 0.4.2

### Patch Changes

- 57ebab2: The app bar replaces Title and Orbit (PDR-020), on kit 0.5.8 (Common 0.11, Quill 0.13, Aerie 0.8.1). On the desktop the bar runs across the still horizon with a tile per group of apps, from each app's manifest category: Platform, Pillars, then Apps. With an app open it docks as the rail beside it, with Home, Apps, the app and its pages, one per item of its manifest menu; an app with one page or none shows no page list. Esc no longer leaves an app: it closes a start menu, and Home in the rail goes back to the desktop. The groups' names are the shell's words, not the kit's. Where the bar rests is kept in the person's preferences: Identity takes `barStop` (0 to 3) in `PUT /v1/me/preferences` (contract 1.31.0). The manifest's `areas` and `orbit` are still read but no longer drawn. The contract tests check the desktop bar, a start menu, the rail, Esc, Home and an address with no app.

  The kit is the Horizon look Harry picked on 6 Nov 2026, for the shell's own pages and every app that takes the kit from `KIT_URL`: square corners, buttons as keys, fields, checks, toggles and selects as wells with one focus ring, solid sheets for dialogs, notices, toasts, menus and tips, and the needs-you colour and the typefaces (Instrument Sans, IBM Plex Mono) as tokens. Nothing an app uses is removed.

## 0.4.1

### Patch Changes

- 6236e98: A deployment can choose how depth is drawn behind dialogs, menus and the palette (ADR 0068, PDR-010 amendment 2): `FOCUS_DEPTH` (`veil`, `lens` or `scrim`) reaches the shell's page as an `augur-depth` meta, which Quill reads for the shell and every app. `scrim` blurs nothing, for desktops without a GPU. Unset, each app chooses as before.

  Serves Quill 0.11.0 (Common 0.9.0, kit bundle 0.5.6), which reads it, and PDR-010's tile amendments: a dimmer document tile and a "more" mark on tiles.

- Updated dependencies [8eba62b]
  - @augur/mfe-sdk@2.1.0

## 0.4.0

### Minor Changes

- 5be0fd6: The design direction behind feature previews (PER-283). AUGUR's own apps can offer feature previews: they stay at the server's default (opt-in on a dev or preview server, off on a production one), people turn them on in Previews, and Admin says why it can't change them. Home offers two, both off until someone turns them on: `focal-planes` (what needs you comes forward, with its count in light and words, and the glance cards go quiet) and `radial-menu` (each thing that needs you opens its actions in a ring: right-click, a long press, or its "more" mark).

  The shell serves kit 0.5.4 (Common 0.8.0, Quill 0.9.0), which brings the design picks' parts, each off until an app turns it on.

## 0.3.5

### Patch Changes

- 21ee89a: Serve Quill 0.8.0 (kit bundle 0.5.3): its dates follow each person's `ctx.formats` (PER-323), and `AppError` reads a service's problem as AUGUR sends it.
- Updated dependencies [f12bbaf]
- Updated dependencies [4f8d944]
- Updated dependencies [cbd1abc]
  - @augur/mfe-sdk@2.0.0

## 0.3.4

### Patch Changes

- eb6aed9: AUGUR serves kit 0.5.1 (Quill 0.7.0, Aerie 0.6.0): apps get the Tiptap editor with mentions as chips (ADR 0058), a date field with a real calendar, and the people picker that SDK 1.12's `searchPrincipals` answers. In Admin, the activity filters' dates open that calendar.
- Updated dependencies [7518ce8]
- Updated dependencies [cceb953]
  - @augur/mfe-sdk@1.12.0

## 0.3.3

### Patch Changes

- 2eae812: AUGUR serves kit 0.4.0 (Common 0.6.0, Quill 0.6.0) and the shell draws on Aerie 0.5.0. Apps' frames keep one layout at every width and fold their drawer and rail over the page when narrow; the floor gauge keeps a lane of its own, so it never covers an app; danger actions can ask twice; Reduce motion stops every loop; and floors move with Alt+Page Up and Alt+Page Down, leaving Page Up and Page Down to the app.
- 8a161b9: AUGUR serves kit 0.5.0 (Common 0.7.0, Quill 0.6.1) and the shell draws on Aerie 0.5.1. The kit now brings its own typefaces (Jost and Nunito, served with the kit at `KIT_URL`) and its reduced-motion values, so a deployment that serves the kit from another site shows the same type and calms the same moves.
- 8d48714: Fixes from the 2 Nov audit. In Admin → People, a person's sign-in (on or off, a new one-time password) sits in its own section that says it takes effect at once: each asks first, acts straight away and says what happened, while their name, email, department and roles change only on Save. Agents stay among the Shell's functions and say they aren't here yet, and Home keeps the card of an app this shell can't open, saying why and who can change it, instead of hiding either. Messages people read say AUGUR, not "the platform", and `pnpm check:reasons` now catches it. The centre menu's transitions stop for AUGUR's own reduced-motion setting as well as the system's and are timed from motion tokens; the lifecycle's divider uses the hairline token; overlay shadows use the shadow token. A new test holds the Lit kit and AUGUR's frontends to tokens only.
- Updated dependencies [2c37293]
- Updated dependencies [2ad8555]
- Updated dependencies [5ad27cc]
- Updated dependencies [8a89c6f]
- Updated dependencies [49a631f]
  - @augur/mfe-sdk@1.11.0

## 0.3.2

### Patch Changes

- 35547f6: The React kits (Common, Quill and Aerie) now come from the augur-kit repository as packages (ADR 0046), and are AUGUR release parts at the versions installed. Their Storybook and Chromatic run there.

## 0.3.1

### Patch Changes

- Updated dependencies [9e021dd]
  - @augur/app-kit@0.3.0

## 0.3.0

### Minor Changes

- d500567: Home is on React and Quill (ADR 0015): the same greeting, list of what needs you and glance cards. The Upgrade Centre's status marks are Quill's own, so it no longer loads the Lit kit.

### Patch Changes

- Updated dependencies [527a413]
- Updated dependencies [f8e9b46]
- Updated dependencies [da54ae3]
- Updated dependencies [7c8027d]
- Updated dependencies [d500567]
- Updated dependencies [a8854e2]
- Updated dependencies [fccb126]
- Updated dependencies [d64d724]
  - @augur/app-kit@0.2.0
  - @augur/mfe-sdk@1.10.0

## 0.2.10

### Patch Changes

- Updated dependencies [2a05a51]
- Updated dependencies [4c1bb55]
- Updated dependencies [5ab5009]
  - @augur/ui-kit@1.8.0
  - @augur/mfe-sdk@1.9.0

## 0.2.9

### Patch Changes

- Updated dependencies [bb91780]
- Updated dependencies [bef7098]
- Updated dependencies [e0e9c83]
  - @augur/mfe-sdk@1.8.0
  - @augur/ui-kit@1.7.0

## 0.2.8

### Patch Changes

- Updated dependencies [5b2c80c]
  - @augur/mfe-sdk@1.7.0

## 0.2.7

### Patch Changes

- Updated dependencies [effebfe]
- Updated dependencies [84fab17]
- Updated dependencies [2c9caf0]
- Updated dependencies [b716037]
- Updated dependencies [2487ae0]
  - @augur/ui-kit@1.6.0

## 0.2.6

### Patch Changes

- Updated dependencies [d68128b]
- Updated dependencies [7ee3531]
- Updated dependencies [d52bfce]
- Updated dependencies [a9cfcf7]
  - @augur/ui-kit@1.5.0
  - @augur/mfe-sdk@1.6.0

## 0.2.5

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

## 0.2.4

### Patch Changes

- Updated dependencies [70df61e]
- Updated dependencies [aa0f0f4]
  - @augur/mfe-sdk@1.4.0
  - @augur/ui-kit@1.3.0

## 0.2.3

### Patch Changes

- Updated dependencies [043d5d3]
- Updated dependencies [c95e799]
- Updated dependencies [936bb00]
- Updated dependencies [f1b5773]
- Updated dependencies [d5d54cc]
- Updated dependencies [22be7f4]
- Updated dependencies [a25ab8a]
  - @augur/mfe-sdk@1.3.0
  - @augur/ui-kit@1.2.0

## 0.2.2

### Patch Changes

- Updated dependencies [972d0ed]
  - @augur/mfe-sdk@1.2.0

## 0.2.1

### Patch Changes

- 1622cd9: The platform is now called AUGUR. Packages move from `@platform/*` to `@augur/*`, and the shell's title, `<ui-shell>`'s default product name, Admin and new sign-in realms say AUGUR. Running servers keep their realm, database, Compose project and `.env` names; see docs/upgrade.md. The shell's import map still answers to `@platform/ui-kit`, so apps built before the rename keep loading.
- Updated dependencies [1622cd9]
  - @augur/ui-kit@1.1.0
  - @augur/mfe-sdk@1.1.1

## 0.2.0

### Minor Changes

- 6da9dba: Home shows what needs you (SDK 1.2). Under the greeting, a count ("3 things need you"), then every unread notification that needs you, with its actions inline (muted apps left out), then up to six glance cards in recent-app order; with nothing at all, "Nothing needs you right now". A card is an app's `card` surface for the kind of floor: the manifest's `module` names a key of the new `surfaces` on the entry's default export (`MicroFrontend.surfaces`, `Surface`, and `AppManifestEntry.surfaces` and `floors` in the SDK), and the shell mounts it with the app's own context; a card that's missing or fails says so in its tile. Home is still an app: it hears from the shell on its own `shell.home.*` bus events. The kit gains `ui-list` (rows with a lead mark, detail, time and up to two actions; groups, the first that needs you pings, loading, empty and error) and `ui-state` (empty, loading after 300ms, error, offline), and `ui-shell` fires `ui-notifications` whenever its notifications or mutes change. `pnpm dev:app` puts Home in the stand-in catalogue so an app's card can be seen, and the contract tests check Home's actions and a glance card.

### Patch Changes

- bffdd14: Apps know which floor they're on (SDK 1.1). `MountContext` gains `workspace` (the floor's id, kind, name, slug, path from the org and the person's role), `getWorkspace()` and `fetch(path, init)`, which calls the gateway with the person's token and `X-Workspace-Id`; the SDK exports `floorFetch` and the `Workspace` types. The shell loads the person's floors at sign-in, puts the floor at the start of every address (`/@me/…`, `/@finance/…`, `/@org/…`; an address without one opens on your own floor), shows "You're not on that floor" for one you can't go to, and mounts the open app again when the floor changes. The Account line shows the current floor instead of the first department. Home names the floor over its greeting, except on your own. `pnpm dev:app` puts you on your own floor, with the org's at `/@org/…`; the contract tests check `ctx.workspace` and `ctx.fetch`, skipping them for builds from before SDK 1.1.
- 9681bff: The shell serves the UI kit and Lit once, through an import map, and the shell and every app share that copy. Apps' builds leave `lit`, `lit/*` and `@augur/ui-kit` external using `isSharedModule` from the new `@augur/mfe-sdk/build`, which lists exactly what the shell provides. Home's bundle drops from 208 KB to 1 KB and Admin's from 266 KB to 59 KB. The kit goes to 1.0.0 and keeps the SDK's versioning promise: within SDK 1.x the shell serves kit 1.x and Lit 3.x, and a breaking kit change ships with an SDK major.
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
