# @augur/admin

## 0.13.0

### Minor Changes

- 2c37293: Apps that ship with AUGUR now say what kind they are (ADR 0032). SDK 1.11 adds an optional `category` to the manifest (`platform` or `pillar`), with `AppCategory` and `APP_CATEGORIES`. The registry counts Home, Admin and the Upgrade Centre as platform apps, honours the kind only for apps that ship with AUGUR or come from the signed app feed, and reports the kind in force in `/v1/manifest`, `/v1/me/apps` and `/v1/apps`, which also gain `ships` (the old `pillar` stays, deprecated). Admin → Apps shows a Kind column, says the kind in each app's dialog and explains a claim it doesn't honour, and says AUGUR instead of "platform" in what it shows.

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

## 0.12.2

### Patch Changes

- 35547f6: The React kits (Common, Quill and Aerie) now come from the augur-kit repository as packages (ADR 0046), and are AUGUR release parts at the versions installed. Their Storybook and Chromatic run there.

## 0.12.1

### Patch Changes

- Updated dependencies [9e021dd]
  - @augur/app-kit@0.3.0

## 0.12.0

### Minor Changes

- 1abdc90: Admin is on React and Quill (PER-243), in the three-column frame with its sections in the rail and the Upgrade Centre one press away. Its Upgrade Centre page has gone, as ADR 0030 said it would after one release: what was the Updates screen is now **Dev to production**, showing the line from dev to production and sending you to the Upgrade Centre to upgrade, hold or go back. Status's "a release is out" note opens the Upgrade Centre too. **Go back** on an installed app now opens its confirmation; before, it did nothing for any version other than the newest.
- 5fec7d8: The registry checks the release feed's cosign signature and expiry before it believes it, and turns down an unsigned, tampered or expired feed (ADR 0017). Releases can be halted with the new Halt rollout workflow: a halted release is listed with its reason but never offered, chosen or installed, and a server running one is told where to go. The Upgrade Centre says how far the feed is trusted and shows halted releases. Mirrors pass halt marks on.

### Patch Changes

- 7bb3f92: An app upgrade is watched for 5 minutes after the switch, while the old version still runs. If the new version stops answering, the runner goes back to the old one by itself.
- b9e2818: Installing, upgrading or removing an app and changing how it takes new releases need the deployment-admin role, and changing how any unit takes updates asks for a fresh sign-in (ADR 0022, PER-200).
- 3d000f8: After an upgrade to a newer release, the updater watches it for 10 minutes before calling it done: sign-in must keep answering and no more than 5% of the gateway's calls may fail (ADR 0020). If either fails it goes back by itself, unless a breaking release lies between, when it leaves the release running and says so. The registry asks for the watch with each forward upgrade, and the new watch step is listed.
- 6a7d54b: A server built from source (compose.build.yml) says so: the registry reports `running.build: 'source'`, and the Upgrade Centre and Admin show AUGUR as built from source, based on the last release, instead of looking like an out-of-date release.
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

## 0.11.0

### Minor Changes

- 5ab5009: Departments and teams are now two different levels. Teams right below the org are Departments, and those inside them are Teams. An admin can rename the levels, up to five, in Admin → Departments → Level names. The new `GET`/`PUT /v1/admin/levels` endpoints are audited as `levels.renamed` (identity contract 1.12.0), and a level deeper than the last name takes that name.

  Each floor's `level` reaches the shell and apps: identity's floors, and `WorkspaceRef.level` in SDK 1.9. Apps can say it where they'd say "team", and `kind` stays `team` at every level, so no app breaks.

  The shell names the level on the title card, the gauge, Account and the top left. A department also has its own icon and water colours, from the new tokens `floor-department-low` (violet) and `floor-department-high` (lavender, also its gauge mark). The kit adds `floorTone()`, `floorKindOf()`, `floorIconOf()` and `teamDepth()`, and `ShellFloorRef.level`.

- efea56f: The Upgrade Centre replaces Admin → Updates. It shows this server, then the line from dev to production: each part's version on dev, preview and production from the new pipeline feed, where this server sits, what's waiting between the branches, and the open Version packages and Promote pull requests, linked to GitHub. Set `PORTAL_URL` to the company's Backstage for links to each part there. The registry reads the pipeline beside the release feed (`PIPELINE_FEED_URL` overrides it) and adds `line` and `portalUrl` to the updates page.

### Patch Changes

- 8d67974: AUGUR dev builds: every merge into `dev` that changes AUGUR is built, signed and released as the pre-release `augur@<next patch>-dev.<run>`, and the workbench (`SERVER_RING=dev`) takes each one by itself, after a backup, when nothing needs a person. The registry's new `dev` channel (`RELEASE_CHANNEL=dev`, the workbench's default) follows dev builds and every release; the updater checks a dev build's signature against the AUGUR dev builds workflow on `dev` and refuses one on any other server (docs/release-channels.md, "AUGUR dev builds").
- 92547d6: A third server ring, `SERVER_RING=dev`, for the workbench you build on: everything a preview server takes (preview releases, apps' dev builds, pull requests' builds, opt-in feature previews), and later AUGUR's own dev builds. Set it on the workbench in place of `preview` (docs/release-channels.md, "Server rings").
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

- d709061: Dev builds: every merge into `dev` that changes a runner app builds it as `<next patch>-dev.<run>`, signed on `dev`. A preview server's admin can set an app to **Dev builds too** in Admin → Apps, and the updater takes a backup before each one; production servers refuse them. A migration is frozen once it's on `dev`. Registry contract 1.26.0 (docs/release-channels.md, "Dev builds").
- 5b2c80c: Feature previews (SDK 1.7): an app lists features it's trying in its manifest's `previews` and asks `ctx.previewOn(id)`. Admins choose who gets each in Admin → Apps (off, for those who turn it on, or everyone; opt-in by default on a preview server, off on a production one), people turn opt-in ones on in the shell's Previews, and the shell marks an app with one on. A preview past its `until` day is off for everyone. Registry contract 1.27.0 (docs/release-channels.md, "Feature previews").

### Patch Changes

- Updated dependencies [5b2c80c]
  - @augur/mfe-sdk@1.7.0

## 0.9.0

### Minor Changes

- 65f4ede: Go back: Admin → Updates lists the releases before yours and goes back to one with the updater's usual steps (a backup first), while no release between is breaking; across a breaking one it says which and why, and going back is by hand. The updater stops parts the older release doesn't have, and starts them again if it has to roll back. Admin → Apps goes back to one of an app's three earlier versions and holds it there. Registry contract 1.25.0 (`PUT /v1/platform/go-back`, `goBack`, `older`).
- 91f62f3: Admin → Updates shows the history of every upgrade (who asked, from and to, how it ended, how long it took and the backup it took) and **What's new since** your version: every change between it and the newest release, once each, breaking ones first. Admin → Apps shows the same for each installed app: what's new in the waiting version and its history of installs. Releases carry each changed part's changelog (`changelogs` in the AUGUR release file) for this. Registry contract 1.24.0.
- ab76a1a: Server rings: `SERVER_RING=preview|production` in `.env` (required). A production server follows stable (production) releases only, for AUGUR and for every app, and runs pull requests' builds only with `ALLOW_PR_PREVIEWS=on`. Updates and Apps show the ring, and Admin calls the channels Production and Preview (docs/release-channels.md).

### Patch Changes

- 2c9caf0: App kit, part 1: nothing is obtuse. `ui-button` and `ui-icon-button` take a `reason`: disabled with one, they stay focusable and say why on hover and focus, and it's read aloud. List rows, list actions and menu entries take a `reason` too. The kit warns on localhost about a disabled control without one, and `pnpm check:reasons` fails a platform screen that has one. New parts: `ui-notice` (one sentence that needs attention, with one action), `ui-note` (a quiet line with its `why` one press away) and `ui-can` (what you can do here, and who can do the rest). Every disabled control in Admin, the shell, Artifacts, Mandate and Data Atlas now says why, and ones that were only waiting for a request show as busy instead.
- Updated dependencies [effebfe]
- Updated dependencies [84fab17]
- Updated dependencies [2c9caf0]
- Updated dependencies [b716037]
- Updated dependencies [2487ae0]
  - @augur/ui-kit@1.6.0

## 0.8.1

### Patch Changes

- Updated dependencies [d68128b]
- Updated dependencies [7ee3531]
- Updated dependencies [d52bfce]
- Updated dependencies [a9cfcf7]
  - @augur/ui-kit@1.5.0
  - @augur/mfe-sdk@1.6.0

## 0.8.0

### Minor Changes

- 6b5dbaf: Open AUGUR to the internet for a while: `infra/deploy/public.sh on 2h | off | status` serves AUGUR's own address through Tailscale Funnel (the front door only; Keycloak's console stays closed to the internet) and closes it by itself when the time is up, even over a restart. The gateway reads it from `PUBLIC_ACCESS_FILE` and adds `publicAccess` to `GET /api/gateway/v1/status` (API 1.4.0); Admin → Status says "Open to the internet until …" while it's open. Allowing Funnel in the tailnet's policy once is in docs/deploy.md.

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

- 71a6ec6: New settings a release needs are entered on Admin → Updates. **Upgrade to …** has a field for each new setting only a person can give; the registry passes what's entered to the updater (kept in memory until the upgrade ends, never stored, only names audited), and the updater writes it to `.env`, quoted when needed. A new secret (`_SECRET`, `_PASSWORD`, `_TOKEN`) gets no field: Updates says the updater makes it up.

## 0.6.0

### Minor Changes

- f371945: Admin → Apps installs apps from their releases and keeps them up to date: the registry reads app releases every 15 minutes, lists those not installed with what each asks for, and for each installed app follows stable or beta releases, Automatic (fixes and features that ask for nothing new install by themselves), Ask first or Hold. Versions that wait for an admin show under Needs you with why, and each install and removal is followed step by step.
- 82ce131: Pull requests that change an app get previews: the App previews workflow builds, signs and releases each push as `<x.y.z>-pr.<n>.<run>`, and a server with the app installed runs the newest build beside it (at most three per app, for a week after the last build, gone when the pull request closes) with scratch storage of its own. An admin names an app’s developers in Admin → Apps; each developer can switch to a preview for themselves (`/v1/previews`), which gives them its frontend and sends their calls to it, while everyone else stays on the installed version.

### Patch Changes

- Updated dependencies [70df61e]
- Updated dependencies [aa0f0f4]
  - @augur/mfe-sdk@1.4.0
  - @augur/ui-kit@1.3.0

## 0.5.0

### Minor Changes

- f7fc3e6: Apps can offer admins settings: a manifest's `settings` (whole numbers with a label, unit, range and default), set in Admin, Apps and audited as app.setting-changed, kept across versions. The registry serves them at `GET /v1/apps/{id}/settings` to admins and the app itself, and the service kit's `appSettings` reads them. Folio offers "Keep deleted documents for" (30 days by default): past it, a deleted document's files are removed from its bucket and its text forgotten, recorded as document.purged.
- 94d0c0c: Folio ships with AUGUR. The release builds its images and pins its version, the deploy stack runs it (`folio`, `folio-worker`, its frontend in `web`) and it registers itself on first start with no admin step. The registry's `PILLAR_APPS` are given the scopes their release asks for, can't be pinned to a version, and can be turned off but not removed (409); Admin shows them as shipping with AUGUR, without versions to go back to or a sign-in to issue. The updater restarts Folio and its worker in an upgrade. The service kit works out a bucket key's id from its secret (`bucketKeyIdFor`), so apps need only `S3_SECRET_ACCESS_KEY`. The shell's dev-app mode takes other apps beside the one being developed (`DEV_ALSO`), and the contract tests run with Folio on and off.

### Patch Changes

- 4608af1: Apps can look people up for sharing, with the new `people:read` scope. Identity says who a person stands for (`GET /v1/people/:id/principals`: `person:`, `team:` and `tree:` principals and `org`) and finds people and teams by name or names them by id (`GET /v1/directory`). The service kit's `identityPrincipals` (kept 30 seconds) and `identityDirectory` call them. Admin shows the scope as "Look up people and teams".
- Updated dependencies [043d5d3]
- Updated dependencies [c95e799]
- Updated dependencies [936bb00]
- Updated dependencies [f1b5773]
- Updated dependencies [d5d54cc]
- Updated dependencies [22be7f4]
- Updated dependencies [a25ab8a]
  - @augur/mfe-sdk@1.3.0
  - @augur/ui-kit@1.2.0

## 0.4.0

### Minor Changes

- a3ba7ef: Admin → Updates can ask for an upgrade. **Upgrade to …** records the wanted release in the registry (`PUT /v1/platform/upgrade`, audited), after the admin enters their password again: the gateway now passes on when the caller last signed in (`x-user-signed-in-at`, `Caller.signedInAt`, `signedInRecently()` in the service kit), and the shell's `/auth/again?return=<path>` asks for the password and comes back. The deployment's updater (signed in as `platform-updater`) reads the upgrade from `/v1/platform/upgrade/target` and reports each step to `/v1/platform/upgrade/progress`; Updates follows along and says how it ended. An upgrade nothing has started can be cancelled.
- 71dc094: Admin → Updates: whether a newer AUGUR release is out, what changes in each part, and what needs doing first (a release to go through, new settings, breaking changes, apps that won't open on the new SDK). The registry checks the release feed once a day and when an admin presses Check now (audited). Status marks a release that's out. New optional settings: `RELEASE_FEED_URL`, `RELEASE_CHANNEL`, and a read-only token in `infra/deploy/secrets/release-feed-token` for a private repository.
- 972d0ed: Uploads and document intents (SDK 1.4). A manifest's `maxUpload` (MB, 1 to 2048; 10 without it) is the largest request the gateway lets through to the app's service. Bodies stream through nginx and the gateway without being held; one past the limit gets 413, by its length or as it streams. Admins can lower an app's limit in Admin, Apps (`PUT /v1/apps/{id}/upload-limit`, audited as `app.upload-limit-set`), and the manifest the registry serves carries the limit in force. The SDK adds the standard document intents: `DOCUMENT_OPEN`, `DOCUMENT_PICK`, `DocumentRef` `{ app, id, version?, title }`, `DocumentPick`, `openDocument`, `pickDocument` (which checks the answer) and `isDocumentRef`.

### Patch Changes

- a09b413: Domain events: services tell each other what happened. The events service keeps events on topics (`folio.document.published`), which an app publishes on its own topics with the new `events:publish` scope, and hands them out in one order, never with a gap, to services with `events:subscribe`. It publishes the platform's own (`platform.person.disabled`, `platform.team.member-added`, `platform.app.turned-off` and more) as identity and the registry record those changes. The service kit adds an outbox (`OUTBOX_TABLE_SQL`, `addToOutbox`, `outboxRelay`) so an event is sent if and only if its change commits, `followEvents` for followers, `publishEvents` and `PLATFORM_TOPICS`. Admin names the two new scopes. Events are kept 30 days. See docs/domain-events.md.
- Updated dependencies [972d0ed]
  - @augur/mfe-sdk@1.2.0

## 0.3.0

### Minor Changes

- 1622cd9: The platform is now called AUGUR. Packages move from `@platform/*` to `@augur/*`, and the shell's title, `<ui-shell>`'s default product name, Admin and new sign-in realms say AUGUR. Running servers keep their realm, database, Compose project and `.env` names; see docs/upgrade.md. The shell's import map still answers to `@platform/ui-kit`, so apps built before the rename keep loading.

### Patch Changes

- f090793: The model gateway: a new platform service (`models`) that alone holds an AI provider's key. It speaks the OpenAI-style chat API to whichever provider the server sets (`MODEL_API_URL`: OpenRouter, a LiteLLM proxy, any compatible API, or `stand-in`, a built-in model that doesn't think, for trying things out), records every call in the audit log before making it, and gives each app a number of calls a day. It is off until an admin turns it on. App services ask it with `askModel` from the service kit and need the new `models:use` scope; the gateway forwards `/api/models` to it.
- Updated dependencies [1622cd9]
  - @augur/ui-kit@1.1.0
  - @augur/mfe-sdk@1.1.1

## 0.2.0

### Minor Changes

- c40b827: Activity in Admin: the audit log, readable. Events' `GET /v1/audit` gains `since` and `until` (a time range) and `before` (the id of the oldest entry shown, for the next page); API 1.1.0. Admin's new Activity screen, under Platform, lists every change newest first as a sentence ("Alex Rivera added Sam Okafor to Finance"), filters by who, where and when (today, 7 days, 30 days, any time, or between two dates), shows 50 at a time with Show older, and opens any change to see everything recorded about it.
- b92585d: Admin app for people, departments and apps, so nobody needs Keycloak's console. Identity gains an admin API (`/v1/admin/people`, `/departments`, `/roles`) that manages people, roles and departments in Keycloak and audits every change; an admin can't turn off their own sign-in or remove their own admin role. The registry lists the whole catalogue for admins (`GET /v1/apps`) and lets them turn an app off and on (`PATCH /v1/apps/:id`); an app that is off stays off when it registers again. Admin now appears for admins. The UI kit adds `ui-select`, `ui-toggle` and `ui-checkbox-group`, four icons (`user-plus`, `department`, `key`, `plus`), and dialogs scroll inside instead of running off the screen.
- 0ba927c: Status in Admin: whether every part of the platform is answering, without the command line. The gateway checks every service's `/healthz` and the sign-in service's signing keys every 30 seconds, keeps the last answer, and serves it to admins at `GET /api/gateway/v1/status` (new contract `contracts/gateway.openapi.yaml`, API 1.0.0); a part that fails its check, or goes quiet for 2 minutes, reads Down. Admin's new Status screen lists each part with its version, state and when it last answered, refreshes every 15 seconds, and says what to check for a part that's down. Admin's menu gains a Platform stop with Status. The UI kit adds a `pulse` icon.
- ade8ba0: Go back to an earlier app version from Admin. The registry keeps the last 5 versions each app registers (`GET /v1/apps/:id/versions`) and lets an admin serve one of them and hold the app there (`PUT /v1/apps/:id/pin`) or follow new versions again (`DELETE /v1/apps/:id/pin`); API 1.2.0. A held app's new registrations are kept but not used. Admin's app details list the kept versions, pick the one to give the shell, and warn when an older version loads from the same address, so only its manifest comes back. Activity describes holds and held registrations. See "Going back to an earlier app version" in `docs/versioning.md`.
- d14956f: An app can be on for one floor and off for another. The registry keeps three separate things: whether an app is turned on at all (as before), installs per floor in a new `registry.installs` table (on or off, carrying on to the teams below unless told not to), and guardrails in `registry.guardrails`, where a block on a floor wins over anything below it. Everyone's own floor follows the org. Manifests gain `floors` (the kinds of floor an app works on) and a checked `surfaces` block (page, card, panel, settings or admin per kind of floor, with an optional role and roll-up). `GET /v1/manifest?workspace=` lists the apps on for the floor the gateway checked, and grants now hold only where an app is on. Admins set floors with `PUT /v1/apps/{id}/floors/{workspace}` and see them with `GET /v1/apps/{id}/floors`; a new version asking for more scopes is served but gets them only after `PUT /v1/apps/{id}/scopes`. Identity tells platform services where a floor sits (`GET /v1/workspaces/{id}`, read with the service kit's `floorPlaces`) and offers the roll-up `GET /v1/me/workspaces/{id}/rollup`. The shell asks for the catalogue of the floor you're on and asks again when you move. Admin, Apps shows where each app is on, floor by floor, with a choice for each, and lets an admin allow scopes a new version asks for. Services need `IDENTITY_URL` (set in both compose files).
- d1f8c5e: Notifications and the audit log know their floor. A service call that names a floor records it on each notification and audit entry, with the floor's path from the root as it stood then (asked of identity), so "everything under Finance" stays right after a team moves. `GET /v1/audit?workspace=` filters to a floor and the floors below it; admins read the whole log and a lead their own floor's. Team notices are opt-in per team (`PUT /v1/team-notices/{workspace}`, by its leads or an admin): `notify` with `toTeam` reaches everyone on the team as it is when sent, asked of identity's new `GET /v1/workspaces/{id}/people`. Identity records department changes on the department's floor, and the registry records floor rules on theirs. The shell tags a notification from another floor with its name, puts a dot on the gauge (and a count in Account) where something waits, and opening one goes to its floor. Admin, Activity filters by floor and says which floor an app was turned on, off or blocked for.
- 1981198: Apps can only load from allowed places. The registry refuses an app whose entry is a full address on a site an admin hasn't allowed (`/v1/origins`, audited as `origin.allowed` and `origin.removed`), and stops offering apps from a site once it's removed, marking them `blocked` in the catalogue. Admin's Apps screen gains "Where apps load from" to add and remove sites, and shows blocked apps. The shell's page is served with a Content Security Policy: scripts only from the platform, its import map and the sites in `APP_ORIGINS`.
- 0295651: The shared `SERVICE_TOKEN` is gone: every app and platform service signs in as itself. The service kit drops `SERVICE_TOKEN_HEADER`, `serviceFromHeaders` and `withoutServiceHeaders`; `ServiceCredentials` is now a name and a token source, and `platformCredentialsFromEnv` signs a platform service in as `platform-<name>`. Identity makes each platform service's Keycloak client (and the Library's, locally) from `SERVICE_CLIENT_SECRETS` when it starts, retrying until Keycloak is up. The registry and events accept only signed-in services; events asks the registry for grants as `platform-events`. `pnpm register-app` signs in as the app. Admin, Apps shows what each app may do and issues a new sign-in, showing its secret once. The deploy needs `IDENTITY_CLIENT_SECRET`, `REGISTRY_CLIENT_SECRET` and `EVENTS_CLIENT_SECRET` in place of `SERVICE_TOKEN` (see docs/upgrade.md).
- 4c96907: Backups are proven, not only taken. Once a week (and on first start) the backup container restores the newest backup into a throwaway database, checks the platform's tables and Keycloak's people came back, and records the result; `backup.sh --restore-test` runs one now. The gateway reads the last backup and restore test from `BACKUP_DIR` and adds them to `GET /api/gateway/v1/status` (API 1.1.0); Admin's Status shows them and its heading says "Backups need a look" when one failed or is overdue. Every request now carries one id from nginx through the gateway to each service: service-kit's `serviceLogging()` labels every log line with `requestId`, and the gateway returns it in `x-request-id`. New guide: `docs/upgrade.md`.

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
