# @augur/upgrades

## 0.3.0

### Minor Changes

- c22a013: Admin is on the app contract (contract 3) and runs in the shell's worker like Deployment. Its places are People, Departments, Organisation, Apps and Activity. Each person, department, app and Activity entry has a page of its own, and every simple setting is changed where it's shown: a name or email saves as you leave the field, a role or department as you pick it. A change that may ask for your password again (deleting someone, two-step for everyone, how long leavers' and Activity's records are kept) opens a question at a path of its own, so signing in again comes back to it. An app's page in Admin opens the same app's page in Deployment for what the server runs for it.
- 1176abf: What the server runs for an installed app moves from Admin to its page in Deployment: rolling it back (installing an earlier release, which puts it on hold), its internet, its own settings saved as they change, its developers and previews, a new sign-in for its service, and removing it. Where apps load from moves to Deployment's Apps. Deployment may look people up (`people:read`) to name and find developers. Admin's Status and Dev to production pages go: Deployment's Health, Backups and Release channel show the same. Messages that sent people to Admin for these now name Deployment.
- 4e68ea8: An app its own service registers gets a page in Deployment, as installed ones have: which kept version the shell is given, holding it there or following new versions, and a new sign-in for its service. Admin's Apps no longer has versions or a new sign-in; it sends you to the app's page in Deployment. The gateway lets AUGUR's own Admin read the organisation's settings and the floors a person is on, so Admin can run on the app contract.

### Patch Changes

- 5243f84: Messages that sent people to the old install guide (docs/deploy.md) now name the page in AUGUR's docs that says what to do, such as "AUGUR's docs, Set up email". The install guide is now the docs site's Run AUGUR section.

  Not breaking: only the wording of `NO_RELAY`, the message shown when no mail relay is set, changed.

## 0.2.0

### Minor Changes

- b1ec856: Deployment gains Health (each part's health, email and event deliveries) and Backups (the last backup, the copy off the server, point in time and restore tests). Each page's history is now the kit's paged list, and an upgrade's watch checks a check list.
- 3875cc9: Deployment gains its Release channel page: the channel this deployment and each component tracks, each component's path from main to stable from the pipeline feed, and every change of channel.
- fd78adb: Deployment, the Upgrade Centre's new name, is built as a contract 3 app beside the current page: Overview, AUGUR and Apps, each with its own history. The shell starts using it once the registry lists its manifest.
- 793cd6a: Deployment's contract 3 app gains its Settings page: each component's release channel, update policy, version pin and maintenance windows, reporting to Backstage, and the settings history.
- 71c250a: Deployment (once the Upgrade Centre) now runs on the app contract: the registry lists its contract 3 manifest, the web image serves its `sandbox.js`, and the React page is gone.

### Patch Changes

- 523cbc6: Account is a dialog over the shell's menu, on kit 0.5.13. Its sections are tabs down the side, with a new Overview first (who you are, and an account check with Something's wrong? to secure the account). Each section's parts sit side by side while they fit and wait behind a switch when they don't, and long lists page, so nothing in it scrolls at 1280×720, 1024×768 or 800×600. It opens only from the menu, or on coming back from one of Keycloak's screens; an address alone no longer opens it.
- 3a37126: Deployment's release channel and update policy are inline choices on each component, saved as soon as they change, on Settings and on Release channel; maintenance windows and the version pin stay in the editor.
- dfad5d2: Install new apps from Deployment's Apps page: what the app feed offers, installing from a release file's address, the settings an install must be given, what's in progress, default apps waiting and apps removed with their data kept. Admin's Apps no longer installs; it links to Deployment.

  An installed app's own settings in Admin are inline fields, each saved as soon as it changes, instead of a dialog.

- 79da23c: Deployment holds up with many apps: tables of components page ten at a time with a filter, Settings lists every component in one table and opens one to change it, and Health lists only the apps whose events are in trouble.
- 7f0d097: On kit 0.5.12, an app on the app contract can describe dialogs whose work it does itself, ask-twice buttons, choices, checkbox groups, dates, tag pickers, steps, progress and status, which the shell draws with the kit.
- 318926c: On kit 0.5.14, an app on the app contract can describe a list of checks, steps through one job and a list a page at a time (`quill-check-list`, `quill-step-list`, `quill-paged-list`), which the shell draws with the kit.
- d6f1a93: On kit 0.5.15, an app on the app contract can describe what a documents app needs: `quill-reader`, `quill-file-button`, `quill-people-picker`, `quill-floor-path` and `quill-filter-bar`. The shell fetches a reader's pictures itself, only under the app's own `/api/<id>/` and with the person's token, and frees them when the app stops (ADR 0092). A file button's files reach the app's `ctx.files.onDrop` handler as a drop does; while the app has no handler, the button says it can't take files.
- Updated dependencies [d6f1a93]
- Updated dependencies [e60b45e]
- Updated dependencies [7adc7fc]
- Updated dependencies [7f0d097]
  - @augur/mfe-sdk@3.1.0

## 0.1.7

### Patch Changes

- 57ebab2: The app bar replaces Title and Orbit (PDR-020), on kit 0.5.8 (Common 0.11, Quill 0.13, Aerie 0.8.1). On the desktop the bar runs across the still horizon with a tile per group of apps, from each app's manifest category: Platform, Pillars, then Apps. With an app open it docks as the rail beside it, with Home, Apps, the app and its pages, one per item of its manifest menu; an app with one page or none shows no page list. Esc no longer leaves an app: it closes a start menu, and Home in the rail goes back to the desktop. The groups' names are the shell's words, not the kit's. Where the bar rests is kept in the person's preferences: Identity takes `barStop` (0 to 3) in `PUT /v1/me/preferences` (contract 1.31.0). The manifest's `areas` and `orbit` are still read but no longer drawn. The contract tests check the desktop bar, a start menu, the rail, Esc, Home and an address with no app.

  The kit is the Horizon look Harry picked on 6 Nov 2026, for the shell's own pages and every app that takes the kit from `KIT_URL`: square corners, buttons as keys, fields, checks, toggles and selects as wells with one focus ring, solid sheets for dialogs, notices, toasts, menus and tips, and the needs-you colour and the typefaces (Instrument Sans, IBM Plex Mono) as tokens. Nothing an app uses is removed.

- 365f25c: On kit 0.5.11, the shell draws the frame round an app on the app contract: the command palette over the commands it declares (Ctrl+Shift+P or ⌘⇧P, or Alt+Shift+P), each one it hasn't loaded yet locked with why; the radial menu on the things it marks in its lists, tables and tiles, sending the command with the thing; the About panel with the sections it declares, each saying so until the app fills it; and in the rail, what the app puts under the places it fills, cut at 50 with "and n more".
- c8f3a69: On kit 0.5.9: Quill's remote vocabulary for contract 3 (the elements an app's sandbox describes its screen with, the host's receiver and the allowlist), and long lists and tables that draw only the rows in view.
- 024e635: Preferences are never saved over before they have loaded, and telemetry starting no longer remounts the open app. Notifications aren't lost on reconnect, Home's cards unmount on a floor change, the leaver form keeps the agreed handover, Organisation says plainly that leavers are deleted, and failed reads no longer stop job tracking or hide installed apps.
- Updated dependencies [3e2ff05]
- Updated dependencies [40a331c]
- Updated dependencies [a4f9905]
- Updated dependencies [f01d0c4]
  - @augur/mfe-sdk@3.0.0

## 0.1.6

### Patch Changes

- 6236e98: A deployment can choose how depth is drawn behind dialogs, menus and the palette (ADR 0068, PDR-010 amendment 2): `FOCUS_DEPTH` (`veil`, `lens` or `scrim`) reaches the shell's page as an `augur-depth` meta, which Quill reads for the shell and every app. `scrim` blurs nothing, for desktops without a GPU. Unset, each app chooses as before.

  Serves Quill 0.11.0 (Common 0.9.0, kit bundle 0.5.6), which reads it, and PDR-010's tile amendments: a dimmer document tile and a "more" mark on tiles.

- c80a122: The Upgrade Centre no longer lists the Common kit as its own dependency: it uses it only through Quill.
- Updated dependencies [8eba62b]
  - @augur/mfe-sdk@2.1.0

## 0.1.5

### Patch Changes

- 21ee89a: Serve Quill 0.8.0 (kit bundle 0.5.3): its dates follow each person's `ctx.formats` (PER-323), and `AppError` reads a service's problem as AUGUR sends it.
- 1e58d38: A printable card for the admin who wakes to an upgrade that went back by itself, didn't install, or kept running after its watch saw a problem: docs/upgrade-went-back.md. The updater's, the after-watch's and the Upgrade Centre's messages now point at it. deploy.md's restore now stops everything but Postgres, as its words always said.
- Updated dependencies [f12bbaf]
- Updated dependencies [4f8d944]
- Updated dependencies [cbd1abc]
  - @augur/mfe-sdk@2.0.0

## 0.1.4

### Patch Changes

- eb6aed9: AUGUR serves kit 0.5.1 (Quill 0.7.0, Aerie 0.6.0): apps get the Tiptap editor with mentions as chips (ADR 0058), a date field with a real calendar, and the people picker that SDK 1.12's `searchPrincipals` answers. In Admin, the activity filters' dates open that calendar.
- 8606741: The registry sends its signed record to Backstage at least every 15 minutes, not once a day, so Backstage can raise the alarm when a deployment goes quiet (ADR 0059). The record's reason for a send with nothing new is `heartbeat` (contract 1.32.0), and the Upgrade Centre calls it the regular record.
- Updated dependencies [7518ce8]
- Updated dependencies [cceb953]
  - @augur/mfe-sdk@1.12.0

## 0.1.3

### Patch Changes

- 2eae812: AUGUR serves kit 0.4.0 (Common 0.6.0, Quill 0.6.0) and the shell draws on Aerie 0.5.0. Apps' frames keep one layout at every width and fold their drawer and rail over the page when narrow; the floor gauge keeps a lane of its own, so it never covers an app; danger actions can ask twice; Reduce motion stops every loop; and floors move with Alt+Page Up and Alt+Page Down, leaving Page Up and Page Down to the app.
- 8a161b9: AUGUR serves kit 0.5.0 (Common 0.7.0, Quill 0.6.1) and the shell draws on Aerie 0.5.1. The kit now brings its own typefaces (Jost and Nunito, served with the kit at `KIT_URL`) and its reduced-motion values, so a deployment that serves the kit from another site shows the same type and calms the same moves.
- cbbefd9: The Upgrade Centre can install a halted AUGUR release for a test on Workbench and Preview servers (ADR 0051). Beside a halted release, "Install … for a test" says why the publisher halted it, asks for a reason for the audit log, and follows the upgrade step by step; the watch judges it and AUGUR goes back by itself if it fails. On a Production server, or with a registry too old for it, the action stays visible and says why it can't be used.
- Updated dependencies [2c37293]
- Updated dependencies [2ad8555]
- Updated dependencies [5ad27cc]
- Updated dependencies [8a89c6f]
- Updated dependencies [49a631f]
  - @augur/mfe-sdk@1.11.0

## 0.1.2

### Patch Changes

- 35547f6: The React kits (Common, Quill and Aerie) now come from the augur-kit repository as packages (ADR 0046), and are AUGUR release parts at the versions installed. Their Storybook and Chromatic run there.

## 0.1.1

### Patch Changes

- Updated dependencies [9e021dd]
  - @augur/app-kit@0.3.0

## 0.1.0

### Minor Changes

- 1743f40: Automatic waits until an admin has upgraded AUGUR on a server once, and a 0.x minor counts as a major for AUGUR and apps (ADR 0020, amended). ADR 0045 is accepted.
- 7dffd91: A watch too quiet to judge errors by keeps going lightly until AUGUR's services have had 20 calls, for up to a day. A problem it finds then shows in Needs you and doesn't go back by itself (ADR 0020, amended).
- 567b4ca: Upgrade AUGUR, go back, and install an app's release from the Upgrade Centre, then follow the upgrade step by step until it ends. When the registry asks for the password again, the page signs in again and comes back to the same question with what was typed kept for the tab.
- aa1546f: The Upgrade Centre's history lists AUGUR's upgrades, every app's installs and removals, and every change of settings with the sentence before and after, newest first. It filters by unit, by who started it (a person, By itself or Watch) and by outcome, and exports as CSV.
- 854b1c7: Start the Upgrade Centre frontend with its API client and state model: unit states, Needs you, maintenance windows, pins and the policy sentence.
- 57e4775: The Upgrade Centre reads the registry's overview: each unit's policy in a sentence, what Automatic will do next, the next window, and Needs you from the server. Marking a failed or went-back result looked at clears it for every admin.
- 860f90b: The Upgrade Centre draws on Quill: the app frame with a rail of units and History, a front page (Needs you, On offer, Worth knowing), an About drawer on each unit, and Common's buttons, choices, fields and select. Its name and icon come from the manifest.
- aa1546f: The Upgrade Centre shows how the deployment reports to Backstage: why it's on, off or file-only, its name in Backstage, the public key to copy into `augur.dev/report-key`, how the last send went, and an export of the signed record.
- 8b6525f: The Upgrade Centre opens as its own app at /upgrades (ADR 0030): an overview (Needs you, this deployment, units, next window, last checked), a page for AUGUR and each installed app (how it moves, what is on offer, going back) and the history. Changes still go through Admin, Upgrade Centre until the change flow ships.
- 3a56e07: Change a unit's settings from the Upgrade Centre: channel, Automatic / Ask first / Hold, how far Automatic goes, a pin, and weekly windows in a time zone. The sentence before and after, and the next three windows, show before saving.

  "I've looked at this" works for any admin again, as the registry allows; only changes need `deployment-admin`.

### Patch Changes

- d500567: Home is on React and Quill (ADR 0015): the same greeting, list of what needs you and glance cards. The Upgrade Centre's status marks are Quill's own, so it no longer loads the Lit kit.
- 3d000f8: After an upgrade to a newer release, the updater watches it for 10 minutes before calling it done: sign-in must keep answering and no more than 5% of the gateway's calls may fail (ADR 0020). If either fails it goes back by itself, unless a breaking release lies between, when it leaves the release running and says so. The registry asks for the watch with each forward upgrade, and the new watch step is listed.
- 6a7d54b: A server built from source (compose.build.yml) says so: the registry reports `running.build: 'source'`, and the Upgrade Centre and Admin show AUGUR as built from source, based on the last release, instead of looking like an out-of-date release.
- Updated dependencies [f8e9b46]
- Updated dependencies [2a827a0]
- Updated dependencies [d994d7b]
- Updated dependencies [2a827a0]
- Updated dependencies [2a827a0]
- Updated dependencies [2a827a0]
- Updated dependencies [2a827a0]
- Updated dependencies [527a413]
- Updated dependencies [f8e9b46]
- Updated dependencies [da54ae3]
- Updated dependencies [7c8027d]
- Updated dependencies [d500567]
- Updated dependencies [a8854e2]
- Updated dependencies [fccb126]
- Updated dependencies [d64d724]
  - @augur/kit-common@0.2.0
  - @augur/app-kit@0.2.0
  - @augur/mfe-sdk@1.10.0
