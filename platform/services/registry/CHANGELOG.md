# @augur/registry

## 0.22.0

### Minor Changes

- c22a013: Admin is on the app contract (contract 3) and runs in the shell's worker like Deployment. Its places are People, Departments, Organisation, Apps and Activity. Each person, department, app and Activity entry has a page of its own, and every simple setting is changed where it's shown: a name or email saves as you leave the field, a role or department as you pick it. A change that may ask for your password again (deleting someone, two-step for everyone, how long leavers' and Activity's records are kept) opens a question at a path of its own, so signing in again comes back to it. An app's page in Admin opens the same app's page in Deployment for what the server runs for it.
- 2c03d1e: Admin has a Roles place: the roles made in AUGUR for the org and each department, each on a page of its own. An admin makes a role, gives it to people (until a day if they like) or to everyone in a department, says what it gives on a department or the org, and takes any of it back with a reason. The permissions service's role answer now says what a role can give on a floor and on the org.
- 1176abf: What the server runs for an installed app moves from Admin to its page in Deployment: rolling it back (installing an earlier release, which puts it on hold), its internet, its own settings saved as they change, its developers and previews, a new sign-in for its service, and removing it. Where apps load from moves to Deployment's Apps. Deployment may look people up (`people:read`) to name and find developers. Admin's Status and Dev to production pages go: Deployment's Health, Backups and Release channel show the same. Messages that sent people to Admin for these now name Deployment.
- b7ac676: Shadow mode reaches the registry (ADR 0085): its admin and deployment admin checks (the catalogue, installs and removals, versions, allowed sites, app settings, feature previews, upgrades, the overview and reporting) are also asked of the permissions service, after the registry has answered as it always has, and disagreements are counted and logged (docs/observability.md). The registry's own answer still decides.

### Patch Changes

- Updated dependencies [5243f84]
- Updated dependencies [e5a1e2b]
- Updated dependencies [eb53688]
- Updated dependencies [4442766]
  - @augur/service-kit@0.20.0
  - @augur/app-tools@0.6.1

## 0.21.0

### Minor Changes

- 531cf56: Removing an app, pinning and unpinning its version, allowing and stopping a site apps load from, and issuing an app's sign-in now need the deployment-admin role (ADR 0084). Admin shows those buttons turned off to a plain admin, with the reason.
- b1ec856: Deployment gains Health (each part's health, email and event deliveries) and Backups (the last backup, the copy off the server, point in time and restore tests). Each page's history is now the kit's paged list, and an upgrade's watch checks a check list.
- 3875cc9: Deployment gains its Release channel page: the channel this deployment and each component tracks, each component's path from main to stable from the pipeline feed, and every change of channel.
- 71c250a: Deployment (once the Upgrade Centre) now runs on the app contract: the registry lists its contract 3 manifest, the web image serves its `sandbox.js`, and the React page is gone.
- f59617f: An app names what it needs of the knowledge graph in its `augur-floor-graphs` resource: `classes` (class IRIs) and `actions` (action names). The registry asks the deployment's knowledge graph what it offers when an app is installed, and refuses an install that needs a class or action it lacks, saying which and who can adopt a class. When the knowledge graph can't be asked, it only warns. The knowledge graph's `GET /meta` now lists every class it has (`ontology.classes`), and Admin's review of an install names the classes and actions.
- d2ce7c9: Apps can ask for the knowledge graph in their manifest's `scopes`: `knowledge:read` to read it as the person they act for, `knowledge:act` for its actions apps are granted, and `knowledge:extract` to add what a source says (retain). The gateway lets an app's calls to the knowledge graph through on those scopes, Admin names them when an admin allows an app, and an app's catalog entry names the knowledge API. The knowledge graph itself still refuses apps until its next release, which checks each action's own scope.

  Not breaking: registry.openapi.yaml lists three more scopes an app's entry may carry. The list grows as AUGUR adds what apps can be granted, and its readers (Admin, the shell and the registry client) show a scope they don't know by its name.

- 1506ff8: The platform overview says whether the caller is a deployment admin (`you.deploymentAdmin`), so a frontend that is never told someone's roles can show what they may change.
- 5ef8329: AUGUR's own apps can be on the app contract (ADR 0083): the registry sends such an app's contract 3 manifest, with its role, its kind and whether the floor gauge rests, and the front door serves its frontend from the image at /apps/<id>/<version>/ before the frontends bucket. No own app uses it yet.
- cc7aa74: Platform scopes (ADR 0083): AUGUR's own admin APIs get scopes of their own (`people:manage`, `apps:manage`, `org:manage`, `audit:read`, `deployment:upgrade`, `deployment:apps`, `deployment:health`, `deployment:settings`). The registry gives them only to AUGUR's own frontends (Admin holds who and what is allowed; the Upgrade Centre what runs and changing it), and the gateway lets a person's call made through one of those frontends reach the matching API with them. No app from a feed can ask for one. The service still checks the person's roles.

### Patch Changes

- Updated dependencies [d6f1a93]
- Updated dependencies [f59617f]
- Updated dependencies [d2ce7c9]
- Updated dependencies [e60b45e]
- Updated dependencies [7e6b12b]
- Updated dependencies [12064f5]
- Updated dependencies [cc7aa74]
- Updated dependencies [7adc7fc]
- Updated dependencies [7f0d097]
  - @augur/mfe-sdk@3.1.0
  - @augur/app-tools@0.6.0
  - @augur/service-kit@0.19.0

## 0.20.0

### Minor Changes

- 7e057b6: Admin → Apps shows, before an app installs, each part's kind, each setting's type and whether it's secret or required, the folders to fill and who signed the release, and installs an app from a release file's address an admin pastes.
- 1aa37dc: Installing an app on the app contract brings its frontend: the app runner checks the bundle's signature, pulls it by the digest the release names and gives it to the registry, which keeps it at `/apps/<id>/<version>/`, where the shell loads the app from. Previews get theirs the same way. The registry is on contract 1.42.0.
- db7ec72: An app that asks for the internet (augur-outbound) reaches it only once a deployment admin allows it in Admin → Apps; then only its parts that ask for it do.
- ec63a74: An app's own settings (text, number, on or off, a choice, or a secret) are filled in by a deployment admin in Admin → Apps and reach its parts through augur-settings; a changed value starts again only the parts that read it.
- 23117fe: Removing an app from the server takes its sign-in away at once and keeps its data, settings and floors for APP_DATA_GRACE_DAYS (30), then deletes them after a backup; installing it again before then keeps them. A deletion that fails waits longer each time, up to a day, and Admin shows why.
- e57c67f: DEFAULT_APPS names the apps a deployment installs from the app feed by default, their asks agreed by the deployment; Admin marks them and refuses to remove one while it's named. A release on a contract this AUGUR no longer serves is refused in the spec's words, naming the app, its version and the contracts it needs. The mirror script copies contract 3 releases' part images.
- 0e4e55f: AUGUR pushes each domain event to the inbound part of every app granted `events:subscribe` (contract 3, spec 8.6): `POST /augur/events` through the gateway, in order per app, with `Idempotency-Key: events-<seq>`, retried with a backoff from a second to ten minutes, passed over and recorded after a day. An app's own events and events on floors where it lacks the scope are not sent. The gateway now takes a platform service's token, but only to an app's part, signing the caller `augur:<service>` for the part to check (`isServiceCaller`, `serviceOfCaller`); the registry lists the apps granted a scope (`GET /v1/scopes/{scope}/apps`, platform services); events shows how each app is taking its events (`GET /v1/deliveries`, admins), which Admin → Apps shows, saying since when and why an app is stalled.
- 8a4ea28: The gateway admits apps (contract 3, ADR 0075, spec section 8). An app's part signs in as itself at `POST /api/identity/v1/token` (a client-credentials grant, the only one passed on to the sign-in service) and its token, audience `platform-services` (`OIDC_SERVICE_AUDIENCE`), is accepted for an app the registry knows and has on, held to the scopes it is granted where the call is for, with a refusal that names the scope it lacks. A call the shell's host makes for an app (`x-augur-app`) gets a delegated caller: signed for the app's own client `app-<id>`, carrying the app and its scopes and lasting `APP_DELEGATION_SECONDS` (default 300), which the part sends back in `x-augur-delegation` on its own calls for the person and the gateway turns into a fresh caller for the target. Calls to apps' parts have brakes (`APP_CONNECT_TIMEOUT_MS` 5000, `APP_RESPONSE_TIMEOUT_MS` 60000, `APP_CONCURRENT_CALLS` 64) that answer 502, 504 and 503 in words naming the app and never hold AUGUR's own routes. The registry's `/v1/apps/:id/grants` now says the app's `name` and whether it is `on` where the call is for, and answers the gateway as well as the platform's services.
- b2c7a81: A person's plain call to an app on the app contract (no `x-augur-app`: a direct API call, the run suite) is signed for the app's client, `app-<id>`, which its part checks for, instead of the app's bare id, which the part refused. The registry's `GET /v1/apps/:id/grants` says the app's `contract` (contract 1.43.0); the gateway refuses a plain call to any app with 503 in words while the registry can't be asked (it already did, a step later, when it checked the person's catalogue), and refuses one to an app turned off on the floor naming the app, as it does a call the shell's host makes for the app.
- 699af61: Followers can't miss an event, and leavers can't be lost. Publishers take turns on a lock only the events login can touch, so seq order is commit order and a long transaction elsewhere no longer stalls followers. An audit entry, its domain event, and each inbox step are one transaction, and `recordAudit` sends an `Idempotency-Key`, so a retry keeps one entry (contract 1.15.0, migrations `013_one_write_each`, `014_forget_notes`). The events channels carry ids only and ignore anything else. A night identity can't give Activity's retention removes nothing. A leaver's team items that couldn't go back are retried. Leaving now and Delete now answer 503 when Activity can't be reached and carry on within five minutes, and a heir who can't sign in any more is passed over and admins told. Deletion also takes a leaver's note (`note` is in `PERSONAL_DETAIL_KEYS`), the notice that they asked to leave, their inbox notes and open items, and, in the registry, their name on upgrades (`GET /v1/people/{id}/data`, contract 1.36.0, migrations `022_followed_events`, `lifecycle_006_carry_on`). Entra's first sign-in no longer links an account holding a two-step role, and a flow that isn't whole is rebuilt. A removed app can't publish a frontend. Gateway refusals use an app's name, not its id. The service kit adds `followLeavers`, `readPersonLeft`, `readPersonDeleted`, `eventCursor`, `EVENT_CURSOR_TABLE_SQL` and `leaveNoticeKey`; the outbox keeps `refused_at` and `refused_why`. Followers keep their place past events they don't follow (`next`). No app has to change.
- 9086482: The registry reads app contract 3 releases (`augur.app-release/v2`): it checks them against the contract's schemas and Score's, refuses what spec 9.2 lists with a plain reason each, warns about what 9.3 lists, and holds a later version that asks for anything new for an admin. A contract 2 file is refused, naming the contract. `GET /v1/contract` answers the majors served, and the app runner says the deployment's own networks with `PUT /v1/runner/networks`, which replace the fixed 172.16.0.0/12 rule for apps' addresses. Admin → Apps lists what a release asks for by part.

  Not breaking for anyone: the job request and Admin → Apps' asks change shape, and their only callers (Admin and the app runner) ship in the same release; contract 2 releases are refused by design (ADR 0075 point 10, spec 11.6).

- 7fa6362: The registry takes an app's contract 3 manifest from the release the app runner installed and serves it to the shell as the manifest in force; reads every feed in APP_FEEDS (APP_FEED_URL kept as its old name), lists contract 2 release files as refused, and reads a release file from an address an admin pastes.
- bd8ff7e: The last of the machinery for apps that ship with AUGUR (ADR 0049) is gone, now that none does (ADR 0075). The release no longer takes apps' releases into AUGUR's images, the updater no longer restarts shipped apps or hands runner-installed apps over to AUGUR, and the registry no longer reads `PILLAR_APPS`: a platform or pillar app's kind is honoured when the app runner installed it from the signed feed. Registry API 1.36.1 marks `ships` and `pillar` deprecated; neither is ever set.
- ac2ac9a: An upgrade only takes settings it adds, never what the server trusts. App feeds refuse replays, automatic upgrades and updates hold while a feed has a problem or has expired, a production server refuses unpromoted app releases, an app an admin removed can't register itself back, and a failed report no longer stops the registry.
- 3c995b6: No app ships with AUGUR any more (ADR 0075): Artifacts, Explorer, Data Atlas and Mandate are taken out of the compose files, the release and the contract tests, to be redesigned under the app contract and installed from the app feed. Their data goes with them, after the upgrade's backup: the storage job takes away the schemas, logins and buckets of the apps in `RETIRED_APPS`, once on each server, keeping any that `APP_STORAGE` still names, and the registry's migration `023_retire_shipped_apps` forgets them. Their guides and settings are gone; docs/upgrade.md says what an admin can tidy up.
- 1ce4194: Urgent news (ADR 0044 D3, PER-283). A notification can be `urgent`, from AUGUR's own services only (an app's is refused, 403). The Upgrade Centre marks a halted release and a go-back that didn't finish urgent, and offers a feature preview, `urgent-letterbox`: with it on, the shell opens urgent news in a see-through letterbox over the work, one at a time with the rest in its queue, and steps it back to the edge rule until someone opens it. Events contract 1.14.0.

  Not breaking: `NewNotification.urgent` in `@augur/service-kit` is a new optional field, so existing callers build and send as before.

### Patch Changes

- a4f9905: SDK 3: installed apps run only on the app contract (ADR 0075 point 10). An installed app that names an SDK 2 range no longer opens: opening it, and its card on Home, say it was made for an older version of AUGUR, and intents and Find pass it by. The shell's own frontends (Home, Admin, the Upgrade Centre) keep the in-page mount from the same SDK and name `^2.0.0 || ^3.0.0`. An app on the contract that declares `contributes.card` gets its card on Home, drawn by the app into `ctx.frame.card` from a worker of its own (`ctx.surface` is `'card'` there, and a card moves the person or opens another app only just after a press in it); Find asks an app on the contract as itself (`x-augur-app`). The contract tests run against a reference app on the contract.
- Updated dependencies [3e2ff05]
- Updated dependencies [e2089a3]
- Updated dependencies [656f2d1]
- Updated dependencies [b2c7a81]
- Updated dependencies [0e4e55f]
- Updated dependencies [40a331c]
- Updated dependencies [6c0abe4]
- Updated dependencies [699af61]
- Updated dependencies [dfc36c1]
- Updated dependencies [a4f9905]
- Updated dependencies [f01d0c4]
- Updated dependencies [832458f]
- Updated dependencies [1ce4194]
  - @augur/app-tools@0.5.0
  - @augur/service-kit@0.18.0
  - @augur/mfe-sdk@3.0.0

## 0.19.2

### Patch Changes

- Updated dependencies [4cfab7e]
  - @augur/service-kit@0.17.1

## 0.19.1

### Patch Changes

- 6ec3e70: What these services say as they start, and the storage and realm jobs as they run, goes through the service kit's `startupLog` instead of `console`: the same JSON lines as the rest of their logs, sent to the deployment's telemetry stack with them.
- Updated dependencies [1a8561d]
- Updated dependencies [c678672]
  - @augur/service-kit@0.17.0

## 0.19.0

### Minor Changes

- 8eba62b: Apps say they bind their things to entities with `links: { entities: true }` and name the types they bind in `bindings` (lowercase, up to 10, never `entity` or `role`; SDK 2.1, ADR 0066). The registry lists those apps and types for any service at `GET /v1/entity-links`, and the service kit's `registryBindingApps` reads it, cached, so a follower such as Data Atlas subscribes to exactly `<app>.<type>.entity-bound` and `-unbound`.

### Patch Changes

- 325b583: Admin → Organisation shows the organisation's name, time zone and email sender, and lets an admin change them in one form that sends only what changed (ADR 0042). It says plainly that AUGUR's email doesn't use the organisation's sender yet: mail still goes from the relay's address (`SMTP_FROM`) under the product's name. Activity writes `organisation.changed` as a sentence, and Admin's menu gains a Settings group in the Organisation area.
- f3c0ffd: The registry keeps its catalogue only in Postgres: its in-memory store is gone, and its tests run on real Postgres. Run locally, it needs `DATABASE_URL`.
- Updated dependencies [c0de29b]
- Updated dependencies [8eba62b]
- Updated dependencies [ab9f61f]
  - @augur/service-kit@0.16.0
  - @augur/mfe-sdk@2.1.0

## 0.18.0

### Minor Changes

- 5be0fd6: The design direction behind feature previews (PER-283). AUGUR's own apps can offer feature previews: they stay at the server's default (opt-in on a dev or preview server, off on a production one), people turn them on in Previews, and Admin says why it can't change them. Home offers two, both off until someone turns them on: `focal-planes` (what needs you comes forward, with its count in light and words, and the glance cards go quiet) and `radial-menu` (each thing that needs you opens its actions in a ring: right-click, a long press, or its "more" mark).

  The shell serves kit 0.5.4 (Common 0.8.0, Quill 0.9.0), which brings the design picks' parts, each off until an app turns it on.

### Patch Changes

- 833b4ed: The registry tells AUGUR's services the role an app's manifest says a person needs (`requiredRole` in an app's grants), and the service kit reads it (`registryRequiredRole`), so models can check it for an AI app as the gateway does for the app's own API.
- cfc0c69: After SDK 2.0's release, Home, Admin and the Upgrade Centre ask for `^2.0.0`, and the contract tests keep the reference app built against 2.0 (`frozen/sdk-2.0`). The Lockfile workflow can keep a frozen build where no package token can make one (**freeze**).
- Updated dependencies [833b4ed]
- Updated dependencies [431db38]
  - @augur/service-kit@0.15.0

## 0.17.0

### Minor Changes

- 4f8d944: Apps declare the kinds of notification they send in `notifications.kinds` (id, label, detail; up to 10), and `NotifyMessage` gains `kind` (SDK 1.13). The registry names them in an app's grants, and the service kit's `registryNotificationKinds` looks them up, so the events service can check them and people can choose each kind in Account.
- ff1c7c5: Settings entered for an upgrade that a registry restart lost end the upgrade at once, saying to ask again; the registry refuses a signed feed older than the newest it took; Grafana's admin password is required.

### Patch Changes

- cbd1abc: SDK 2 drops Lit and the Lit kit (`@augur/ui-kit`, PER-264). The shell no longer builds or serves them: its import map holds React, Common and Quill from the kit bundle, and in production the shell's own stand-in for `react/jsx-dev-runtime` at `/shared/`. The shell's build stops if the pinned kit doesn't serve every module the SDK promises apps. An app that still imports `lit` or `@augur/ui-kit` doesn't load. The typefaces (Jost and Nunito) now come with the kit's styles (kit 0.5.0). `pnpm dev:app` drops its `--kit` switch, and the registry takes a `.tsx` entry for Live on the workbench. `pnpm check:boundaries` fails on any import of Lit or the Lit kit under `platform/`.
- 439fd3c: AUGUR's upgrade routes move out of the registry's app.ts into their own module, behind a checked seam between the app catalogue and update control (ADR 0067). No route or table changes.
- 1e58d38: A printable card for the admin who wakes to an upgrade that went back by itself, didn't install, or kept running after its watch saw a problem: docs/upgrade-went-back.md. The updater's, the after-watch's and the Upgrade Centre's messages now point at it. deploy.md's restore now stops everything but Postgres, as its words always said.
- Updated dependencies [1f83a5f]
- Updated dependencies [f12bbaf]
- Updated dependencies [2f2b01a]
- Updated dependencies [7886a1e]
- Updated dependencies [f902da5]
- Updated dependencies [866c076]
- Updated dependencies [04d7ed1]
- Updated dependencies [4f8d944]
- Updated dependencies [cbd1abc]
- Updated dependencies [90057d9]
- Updated dependencies [858fad1]
- Updated dependencies [33b6fa3]
  - @augur/service-kit@0.14.0
  - @augur/mfe-sdk@2.0.0

## 0.16.0

### Minor Changes

- b4cad59: Feature previews can be turned on for chosen floors: Admin → Apps picks the floors, the preview is on there and on the floors beneath them, and off everywhere else, without a release (ADR 0021, amended). `ctx.previewOn` is unchanged; an app's service passes `?workspace=` when it asks the registry for a person.
- 8606741: The deployment watches itself (ADR 0059). otel-lgtm now runs in every deployment, keeps 72 hours, and its Grafana loads AUGUR's alert rules (a part down, server errors, browser errors, backups) and dashboard from `infra/deploy/observability/`. Each alert, and its all-clear, reaches deployment admins as a notice through the registry's new webhook (`POST /v1/platform/alerts`, contract 1.32.0, with `ALERT_WEBHOOK_TOKEN`). Before upgrading, set `GRAFANA_ADMIN_PASSWORD` and `ALERT_WEBHOOK_TOKEN` in `.env`; a server with its own collector sets `OTEL_LGTM_REPLICAS=0`. `OTEL_SDK_DISABLED=true` now also stops the shell sending browser errors. See docs/upgrade.md, "The deployment watches itself".
- 0ec750c: The Inbox's items (ADR 0026, PER-146): apps' services put work that waits on a person or a team in their inbox with the new `inbox:write` scope (`inboxItem`, `updateInboxItem`, `getInboxItem` in the service kit), keyed by the app's own id, and close it when it's done or withdraw it. People list theirs (`/v1/inbox`, `/v1/inbox/counts`) and take, release, decline, hand on or mark done; each step is in the item's history and the audit log, and published as `platform.inbox.*`. The notification stream also carries `inbox` events, so the shell's count stays live. Closed items are kept `INBOX_KEEP_DAYS` (90) days. Admin names the scope "Put work in people's inboxes". Events API 1.9.0.
- 7518ce8: Apps declare the kinds of work they put in people's inboxes in their manifest's `inbox.kinds` (SDK 1.12: `id`, `label`, `icon`, up to 10), and the events service refuses an item of a kind the app doesn't declare. The registry names them in an app's grants (`inboxKinds`), read with `registryInboxKinds` from the service kit. The SDK gains the Inbox's types (`InboxItem`, `InboxKind`, `InboxCounts`, `InboxChange`) and `INBOX_TOPICS`.
- 8606741: The registry sends its signed record to Backstage at least every 15 minutes, not once a day, so Backstage can raise the alarm when a deployment goes quiet (ADR 0059). The record's reason for a send with nothing new is `heartbeat` (contract 1.32.0), and the Upgrade Centre calls it the regular record.

### Patch Changes

- 9ad4399: Mandate ships with AUGUR, like Artifacts, Explorer and Data Atlas: a `mandate` container with its own sign-in, login and schema (`MANDATE_*` in `.env`). On a server whose app runner installed it, AUGUR's container takes over the same schema, the updater stops the runner's copy, and Admin → Apps stops listing it as an installed app.
- 873a050: The app manifest's schema is written in TypeBox and published as contracts/manifest.schema.json, and a manifest may carry "$schema" pointing at it.
- 03e7d87: Every deployment setting is described once, in infra/deploy/settings.schema.json, and CI checks compose.yml, .env.example, the guides and the services' code against it (`pnpm check:settings`). Settings the guides named but compose never passed now reach their services: FEED_SIGNER (registry), IMAGE_SIGNER, IMAGE_SIGNER_ISSUER and AUGUR_DEV_SIGNER (updater), DOMAIN_EVENTS_KEEP_DAYS (events), MODEL_TIMEOUT_SECONDS (models), CALLER_SIGNING_KEY (gateway), and OTEL_EXPORTER_OTLP_HEADERS, OTEL_TRACES_SAMPLER and OTEL_TRACES_SAMPLER_ARG (every service). An empty DOMAIN_EVENTS_KEEP_DAYS or MODEL_TIMEOUT_SECONDS keeps its default, and AUGUR_DEV_SIGNER follows the repository a fork's IMAGE_SIGNER names.
- 46619f9: The registry API's schemas are TypeBox, and contracts/registry.openapi.yaml is generated from them (ADR 0055). The contract now names every refusal the routes already sent, and the fields they already answered with.
- 5622ece: Close two address-check bypasses (PER-209). An app's entry is judged as the browser resolves it, so `/\evil.example/x.js` no longer passes as a path on AUGUR, and the manifest schema refuses backslashes and control characters in `entry`. Where an app's service is reached is now an allow-list: on AUGUR's own network only `app-<id>` containers, and never loopback, link-local or Docker's default range, however the address is written.
- 83858e8: AUGUR's repository is now `harry-burton-dev/augur`. The registry reads the release list from the new address by default, and app-tools names it when a release has no `GITHUB_REPOSITORY`. Images and the feed stay at `ghcr.io/harry-burton-dev/im-platform`, and releases signed under the old name are still trusted.
- 566f261: The service kit has one migration runner, `runMigrations(pool, { schema, migrations })`, and the events, identity, models and registry services use it in place of their own copies; what they do at start is unchanged. New migrations are linted with Squawk (ADR 0053), which catches drops, renames and type changes the old check missed.
- 7517bd7: `release/shipped-apps.json` is now the one list of the apps that ship with AUGUR. The updater reads it from its image to restart them in order and check each comes back, and refuses an upgrade with an image for a part the server runs that it doesn't know, instead of restarting it unchecked. `pnpm check:release` fails when a compose file disagrees with it. The registry refuses an app whose id a part of AUGUR answers to (a platform service, a platform app, a deployment service or a path the front door serves), saying which, and storage makes no schema under such an id (`RESERVED_APP_IDS` in the service kit).

  The updater restarts AUGUR's own Keycloak image first, giving it up to five minutes to be ready, and keeps it running when going back to a release from before that image.

- Updated dependencies [7dbdf7b]
- Updated dependencies [2dbdc22]
- Updated dependencies [0ec750c]
- Updated dependencies [7518ce8]
- Updated dependencies [dec1a40]
- Updated dependencies [cceb953]
- Updated dependencies [566f261]
- Updated dependencies [7517bd7]
  - @augur/service-kit@0.13.0
  - @augur/mfe-sdk@1.12.0

## 0.15.0

### Minor Changes

- 2c37293: Apps that ship with AUGUR now say what kind they are (ADR 0032). SDK 1.11 adds an optional `category` to the manifest (`platform` or `pillar`), with `AppCategory` and `APP_CATEGORIES`. The registry counts Home, Admin and the Upgrade Centre as platform apps, honours the kind only for apps that ship with AUGUR or come from the signed app feed, and reports the kind in force in `/v1/manifest`, `/v1/me/apps` and `/v1/apps`, which also gain `ships` (the old `pillar` stays, deprecated). Admin → Apps shows a Kind column, says the kind in each app's dialog and explains a claim it doesn't honour, and says AUGUR instead of "platform" in what it shows.
- ef9976f: A deployment admin can install a release its publisher halted, on request, to prove AUGUR goes back by itself from a broken release (ADR 0051): `PUT /v1/platform/upgrade/halted` with the exact version and a reason, after a fresh sign-in, on dev and preview servers only. The release must be newer, able to upgrade from the running one and have no breaking release between. Every request, allowed or refused, is audited, and the Updates page says whether this server allows it (`haltedInstall`).
- 5ad27cc: Back and Forward inside an app no longer throw away what it holds (PER-308). SDK 1.11 adds `followsAddress` to the manifest, for an app that follows the address itself, and `navigated(el, path)` on the app. While an app with both stays open on the same floor and nothing is waiting for it, the shell keeps it mounted on a move inside its route and calls `navigated` with the new path; an intent, a request, another floor or a changed preview still mounts it again. An app without `navigated` is mounted again as before, since the shell's own moves push the address without a popstate. The registry accepts the flag (contract 1.33.0).

### Patch Changes

- b3060e0: Every platform service answers errors as RFC 9457 problem details (`application/problem+json`) with AUGUR's `reason` and `whoCanChange`, and keeps `error` and `message` for SDK 1.x clients. The service kit adds `problemDetails()`, `Problem`, `sendProblem` and `serviceFastifyOptions()`. A service's unexpected errors are logged and answered with a plain 500, never with their own words.
- 8d48714: Fixes from the 2 Nov audit. In Admin → People, a person's sign-in (on or off, a new one-time password) sits in its own section that says it takes effect at once: each asks first, acts straight away and says what happened, while their name, email, department and roles change only on Save. Agents stay among the Shell's functions and say they aren't here yet, and Home keeps the card of an app this shell can't open, saying why and who can change it, instead of hiding either. Messages people read say AUGUR, not "the platform", and `pnpm check:reasons` now catches it. The centre menu's transitions stop for AUGUR's own reduced-motion setting as well as the system's and are timed from motion tokens; the lifecycle's divider uses the hairline token; overlay shadows use the shadow token. A new test holds the Lit kit and AUGUR's frontends to tokens only.
- Updated dependencies [2c37293]
- Updated dependencies [2ad8555]
- Updated dependencies [5ad27cc]
- Updated dependencies [b3060e0]
- Updated dependencies [8a89c6f]
- Updated dependencies [49a631f]
  - @augur/mfe-sdk@1.11.0
  - @augur/service-kit@0.12.0

## 0.14.0

### Minor Changes

- b9e2818: Installing, upgrading or removing an app and changing how it takes new releases need the deployment-admin role, and changing how any unit takes updates asks for a fresh sign-in (ADR 0022, PER-200).
- 245ee83: Upgrading AUGUR, going back to an earlier release, taking back a waiting upgrade and changing how a unit takes updates (policy, pin, windows) need the `deployment-admin` role (ADR 0022). A refusal says so as `requiredRole: 'deployment-admin'`, so the Upgrade Centre can name the role.
- 9e88e11: The registry reports what the deployment runs to the company's Backstage, signed with the deployment's own key, after each change and once a day, or exports it as a file for an air-gapped server (ADR 0019). Set DEPLOYMENT_ID (and PORTAL_URL) in .env to turn it on; DEPLOYMENT_REPORTING=off turns it off.
- 3e9a46a: Each unit (AUGUR and every installed app) has a desired state: policy, how far Automatic goes, a semver pin and weekly upgrade windows in the deployment's time zone (ADR 0020). AUGUR on production installs patch releases by itself in Sunday's 02:00 window unless an admin changes that; apps keep their channel and policy. New `GET /platform/overview` lists every unit with its record, what Automatic does next and what needs an admin; failed and went-back results stay in Needs you until an admin marks them looked at, for every admin. DEPLOYMENT_TIME_ZONE sets the time zone.
- 1743f40: Automatic waits until an admin has upgraded AUGUR on a server once, and a 0.x minor counts as a major for AUGUR and apps (ADR 0020, amended). ADR 0045 is accepted.
- 7dffd91: A watch too quiet to judge errors by keeps going lightly until AUGUR's services have had 20 calls, for up to a day. A problem it finds then shows in Needs you and doesn't go back by itself (ADR 0020, amended).
- 7aa2c19: A service call that names no floor is checked on the organisation's floor, as the gateway already does, so an app that is off for the organisation can't act everywhere by naming none. Identity's `/v1/workspaces/org` names the organisation's floor.
- 3d000f8: After an upgrade to a newer release, the updater watches it for 10 minutes before calling it done: sign-in must keep answering and no more than 5% of the gateway's calls may fail (ADR 0020). If either fails it goes back by itself, unless a breaking release lies between, when it leaves the release running and says so. The registry asks for the watch with each forward upgrade, and the new watch step is listed.
- eaf538e: A new build of an app version's frontend now takes the old build's place instead of being refused. Each build is kept in a folder of its own (`/apps/<id>/<version>_<digest>/`), so browsers, which keep a folder for good, load the new one straight away. Before this, the workbench and any server that got a rebuilt pillar app (Artifacts, Data Atlas, Explorer) without a version change kept serving the first build it was given: the registry answered 409 and the app's service only logged it. Frontends kept before this stay where they are until their app gives a new build, which happens on its next start. Migration 019 adds the folder.
- d64d724: SDK 1.10: a generic `Ref` and `EntityBinding` for apps that bind their things to entities (ADR 0025), an optional reserved `marking` on every reference, and a reserved `ctx.focus` with a `focus` manifest field (ADR 0029). Nothing sets or enforces either yet. The registry accepts `focus` in a manifest.
- 5fec7d8: The registry checks the release feed's cosign signature and expiry before it believes it, and turns down an unsigned, tampered or expired feed (ADR 0017). Releases can be halted with the new Halt rollout workflow: a halted release is listed with its reason but never offered, chosen or installed, and a server running one is told where to go. The Upgrade Centre says how far the feed is trusted and shows halted releases. Mirrors pass halt marks on.
- 2021f8a: Deployment admins now hear in the shell when a new AUGUR or app release is available, and deployment admins and admins hear when an upgrade or install finishes, fails or goes back by itself (ADR 0044). Platform services can address a notification to an `audience` such as `role:deployment-admin`, worked out by identity as it's sent, and any sender can give one a `key` so each person is told that news once (events contract 1.7.0, identity contract 1.14.0).
- 8b6525f: The Upgrade Centre opens as its own app at /upgrades (ADR 0030): an overview (Needs you, this deployment, units, next window, last checked), a page for AUGUR and each installed app (how it moves, what is on offer, going back) and the history. Changes still go through Admin, Upgrade Centre until the change flow ships.

### Patch Changes

- 7bb3f92: An app upgrade is watched for 5 minutes after the switch, while the old version still runs. If the new version stops answering, the runner goes back to the old one by itself.
- 975801a: AUGUR's repository is about to be renamed from `im-platform`. The updater and registry now take AUGUR's releases, dev builds and release feed signed under either name, and an app built in AUGUR's repository counts as the same publisher under both. Images and the feed stay at `ghcr.io/harry-burton-dev/im-platform`, so nothing on a server changes. A server needs this release before the rename (docs/upgrade.md).
- 23a2f8f: Each platform service and Keycloak connects to Postgres with its own login, which owns only its own schema (Keycloak: its own database). The storage job makes the logins from `PLATFORM_DATABASE_LOGINS` and the `*_DATABASE_PASSWORD` settings, and hands each one what its service made as the admin login. The services make their schema only when it isn't there, since their own logins may not create schemas.
- 6a7d54b: A server built from source (compose.build.yml) says so: the registry reports `running.build: 'source'`, and the Upgrade Centre and Admin show AUGUR as built from source, based on the last release, instead of looking like an out-of-date release.
- dbcb6b9: The Upgrade Centre opens again: its manifest entry asked for SDK ^1.10.0, which this AUGUR doesn't speak until the next release, so the shell wouldn't open it. It now asks for ^1.9.0, and a test checks every platform app asks for an SDK its own AUGUR speaks.
- Updated dependencies [137791c]
- Updated dependencies [fccb126]
- Updated dependencies [d64d724]
- Updated dependencies [2021f8a]
  - @augur/service-kit@0.11.0
  - @augur/mfe-sdk@1.10.0

## 0.13.1

### Patch Changes

- afafeb6: AUGUR releases carry a release name beside their version: each new minor or major takes the next bird in `release/names.json`, and patches keep their release's.

## 0.13.0

### Minor Changes

- 8d67974: AUGUR dev builds: every merge into `dev` that changes AUGUR is built, signed and released as the pre-release `augur@<next patch>-dev.<run>`, and the workbench (`SERVER_RING=dev`) takes each one by itself, after a backup, when nothing needs a person. The registry's new `dev` channel (`RELEASE_CHANNEL=dev`, the workbench's default) follows dev builds and every release; the updater checks a dev build's signature against the AUGUR dev builds workflow on `dev` and refuses one on any other server (docs/release-channels.md, "AUGUR dev builds").
- 92547d6: A third server ring, `SERVER_RING=dev`, for the workbench you build on: everything a preview server takes (preview releases, apps' dev builds, pull requests' builds, opt-in feature previews), and later AUGUR's own dev builds. Set it on the workbench in place of `preview` (docs/release-channels.md, "Server rings").
- 1a55170: Live on the workbench: `pnpm dev:app <id> --live` loads your app's frontend, from source on your machine over the tailnet, into the workbench's real shell, with real sign-in, floors and data, for you alone. Paste the address it prints into Previews, **Live from my machine**. Only an app's developers can, and only on the workbench (`SERVER_RING=dev`), where the front door's Content Security Policy allows `https://*.ts.net`; elsewhere Previews says why (docs/release-channels.md, "Live on the workbench").
- efea56f: The Upgrade Centre replaces Admin → Updates. It shows this server, then the line from dev to production: each part's version on dev, preview and production from the new pipeline feed, where this server sits, what's waiting between the branches, and the open Version packages and Promote pull requests, linked to GitHub. Set `PORTAL_URL` to the company's Backstage for links to each part there. The registry reads the pipeline beside the release feed (`PIPELINE_FEED_URL` overrides it) and adds `line` and `portalUrl` to the updates page.

### Patch Changes

- da6159a: Live on the workbench loads apps only from machines on the workbench's own tailnet, taken from `PLATFORM_URL`, not from any `*.ts.net` address: every Tailscale user's machines are under `*.ts.net`. The front door's Content Security Policy allows `https://*.<tailnet>.ts.net` alone, and a workbench whose `PLATFORM_URL` isn't on Tailscale loads from no machine and says why in Previews.
- ea41136: Services stay up through a Postgres restart: a dropped idle connection is logged (`steadyPool` in the service kit) rather than ending the process, and the events service listens again on a new connection, so open notification streams don't go quiet for good.
- Updated dependencies [ea41136]
- Updated dependencies [5ab5009]
  - @augur/service-kit@0.10.0
  - @augur/mfe-sdk@1.9.0

## 0.12.1

### Patch Changes

- Updated dependencies [bb91780]
  - @augur/mfe-sdk@1.8.0

## 0.12.0

### Minor Changes

- d709061: Dev builds: every merge into `dev` that changes a runner app builds it as `<next patch>-dev.<run>`, signed on `dev`. A preview server's admin can set an app to **Dev builds too** in Admin → Apps, and the updater takes a backup before each one; production servers refuse them. A migration is frozen once it's on `dev`. Registry contract 1.26.0 (docs/release-channels.md, "Dev builds").
- 5b2c80c: Feature previews (SDK 1.7): an app lists features it's trying in its manifest's `previews` and asks `ctx.previewOn(id)`. Admins choose who gets each in Admin → Apps (off, for those who turn it on, or everyone; opt-in by default on a preview server, off on a production one), people turn opt-in ones on in the shell's Previews, and the shell marks an app with one on. A preview past its `until` day is off for everyone. Registry contract 1.27.0 (docs/release-channels.md, "Feature previews").

### Patch Changes

- Updated dependencies [5b2c80c]
  - @augur/mfe-sdk@1.7.0

## 0.11.0

### Minor Changes

- 65f4ede: Go back: Admin → Updates lists the releases before yours and goes back to one with the updater's usual steps (a backup first), while no release between is breaking; across a breaking one it says which and why, and going back is by hand. The updater stops parts the older release doesn't have, and starts them again if it has to roll back. Admin → Apps goes back to one of an app's three earlier versions and holds it there. Registry contract 1.25.0 (`PUT /v1/platform/go-back`, `goBack`, `older`).
- 91f62f3: Admin → Updates shows the history of every upgrade (who asked, from and to, how it ended, how long it took and the backup it took) and **What's new since** your version: every change between it and the newest release, once each, breaking ones first. Admin → Apps shows the same for each installed app: what's new in the waiting version and its history of installs. Releases carry each changed part's changelog (`changelogs` in the AUGUR release file) for this. Registry contract 1.24.0.
- ab76a1a: Server rings: `SERVER_RING=preview|production` in `.env` (required). A production server follows stable (production) releases only, for AUGUR and for every app, and runs pull requests' builds only with `ALLOW_PR_PREVIEWS=on`. Updates and Apps show the ring, and Admin calls the channels Production and Preview (docs/release-channels.md).

## 0.10.0

### Minor Changes

- a9cfcf7: The floor gauge opens out smoothly. Pointing at it or tabbing into it, each floor's label grows from nothing to its size while it fades in, the gaps widen, and the pinned app icon shrinks away, so nothing jumps. It closes the same way. In an app that shows the same on every floor, the gauge rests: it stays in view, dimmed, and pointing at it says why, and Page Up and Page Down don't move floors. Apps say this with the new manifest field `sameOnEveryFloor` (SDK 1.6, registry contract 1.22.0), and Admin sets it. `ShellApp` gains `sameOnEveryFloor`, and `ui-shell` gains `floorsRest`.

### Patch Changes

- Updated dependencies [a9cfcf7]
  - @augur/mfe-sdk@1.6.0

## 0.9.0

### Minor Changes

- 1580b6b: Title shows what an app covers, not how to get around in it. An app may name up to six `areas` in its manifest (SDK 1.5), and each menu group its `area`. Title lists an app's areas, each opening its Orbit at the area's first group; an app with one area or none is a choice by itself, captioned with its description, so nothing is offered twice. Orbit keeps an area's groups together and names the area before the group ("Organisation / People"), and the area sits under the app's name below the handle. A group with one page is that page. Nothing repeats the label or icon of what it sits under: the registry warns when a manifest does (`menuWarnings`, also printed by `pnpm check:manifest`) and still accepts it. Admin has two areas, Organisation and System, with new kit icons `list`, `structure`, `server` and `gauge`. `ui-centre-menu` takes a category with no items as a choice by itself, and a category `section` that Orbit names before it.
- 5bb4315: `GET /v1/me/apps?workspace=`: every app and whether you can use it on the floor you're on, with the reason, the floor whose rule decides it and who set that rule and when. Apps a role keeps from you are listed too, saying which role, so Auspex never hides an app for being out of reach.

### Patch Changes

- Updated dependencies [1580b6b]
- Updated dependencies [f0d02e2]
- Updated dependencies [bbdad18]
- Updated dependencies [778b6f9]
- Updated dependencies [513e2e9]
  - @augur/mfe-sdk@1.5.0
  - @augur/service-kit@0.9.0

## 0.8.0

### Minor Changes

- 3e3c173: One read key per deployment. With a read:packages token in `secrets/github-read-key` and `GITHUB_READ_USER` in `.env`, the registry checks for new AUGUR and app releases in the feed the Release workflow now keeps beside the images (`ghcr.io/<repo>/feed:latest`, `RELEASE_FEED_URL=oci://…`), and the updater signs Docker in with the same key to pull. The older `release-feed-token` and `image-pull-token` still work. See "The read key" in docs/upgrade.md.
- 71a6ec6: New settings a release needs are entered on Admin → Updates. **Upgrade to …** has a field for each new setting only a person can give; the registry passes what's entered to the updater (kept in memory until the upgrade ends, never stored, only names audited), and the updater writes it to `.env`, quoted when needed. A new secret (`_SECRET`, `_PASSWORD`, `_TOKEN`) gets no field: Updates says the updater makes it up.

### Patch Changes

- aa1724a: Services check their settings before they start. The service kit's `loadConfig` takes a list of the settings a service reads (`Setting`, plus `commonSettings` for the ones services share). In production, a missing required setting stops the service with one message listing every problem, instead of falling back to a `localhost` address. A secret can be given as a file in `<NAME>_FILE`. `describeConfig` reports each setting and where it came from, never a secret's value, ready for Admin → Deployment.
- Updated dependencies [aa1724a]
  - @augur/service-kit@0.8.0

## 0.7.0

### Minor Changes

- f371945: Admin → Apps installs apps from their releases and keeps them up to date: the registry reads app releases every 15 minutes, lists those not installed with what each asks for, and for each installed app follows stable or beta releases, Automatic (fixes and features that ask for nothing new install by themselves), Ask first or Hold. Versions that wait for an admin show under Needs you with why, and each install and removal is followed step by step.
- 82ce131: Pull requests that change an app get previews: the App previews workflow builds, signs and releases each push as `<x.y.z>-pr.<n>.<run>`, and a server with the app installed runs the newest build beside it (at most three per app, for a week after the last build, gone when the pull request closes) with scratch storage of its own. An admin names an app’s developers in Admin → Apps; each developer can switch to a preview for themselves (`/v1/previews`), which gives them its frontend and sends their calls to it, while everyone else stays on the installed version.
- 57d3760: The updater can now run apps: with `APP_SECRETS_KEY` in `.env` it installs, upgrades and removes apps that don't ship with AUGUR, from their signed releases, in a Compose project of its own (`augur-apps`). Upgrades are blue/green with a health check: a version that doesn't come up leaves the old one serving. Admins ask for installs and removals through the registry's new `/v1/app-runner/jobs`, and the service kit's `registerApp` leaves registering to the runner when it runs the app.
- 70df61e: An app can keep its menu inside it: `"orbit": false` in its manifest (SDK 1.4) means the shell never shows its Orbit. Its root opens the app, Title still lists its menu and opens the chosen category's first page, and Esc stays with the app. The band now names the open app after the floor, with **All apps** (`ui-home`) as the deliberate way back to Title. The floor gauge pins the open app beside the floor you're on and, pointed at or tabbed into, opens out to say what each floor is, who sees it, and which one the app is showing; Account's floor list says the same. Changing floor no longer mounts the app twice, once against the last floor's catalogue: nothing of the old floor's stays mounted until the new floor's catalogue arrives.
- ef587a4: Apps' frontends are kept by version. An app's service gives the registry each version's built frontend before registering it (`publishFrontend` in the service kit, `PUT /v1/apps/{id}/versions/{version}/frontend`), the registry writes it to the new `augur-frontends` bucket that the storage container makes, and the front door serves it from Garage at `/apps/<id>/<version>/`. The manifest the shell is given then points at that version's own copy, so holding an app at an older version in Admin, Apps holds its code too. A version's frontend never changes once given. Folio gives its own on every start. Needs `FRONTENDS_BUCKET_SECRET` in `.env` (docs/upgrade.md); without it apps are served from their manifests' entry as before.
- 948526d: The gateway finds apps' services through the registry. Whatever runs an app (a platform service) or an admin says where its service is (`PUT /v1/apps/{id}/upstream`), and the gateway sends `/api/<id>/…` there, asking the registry as itself (`GET /v1/upstreams`, the signed caller `augur:gateway`) every 30 seconds and keeping the last answer through a registry restart. Status checks those apps too. `APP_UPSTREAMS` still works and wins for the apps it names, so nothing changes for a server until an app is set up this way. Upstreams can never be one of the platform's own parts.

### Patch Changes

- Updated dependencies [57d3760]
- Updated dependencies [476907a]
- Updated dependencies [70df61e]
- Updated dependencies [ef587a4]
- Updated dependencies [a6b6bca]
- Updated dependencies [948526d]
  - @augur/service-kit@0.7.0
  - @augur/mfe-sdk@1.4.0

## 0.6.0

### Minor Changes

- f7fc3e6: Apps can offer admins settings: a manifest's `settings` (whole numbers with a label, unit, range and default), set in Admin, Apps and audited as app.setting-changed, kept across versions. The registry serves them at `GET /v1/apps/{id}/settings` to admins and the app itself, and the service kit's `appSettings` reads them. Folio offers "Keep deleted documents for" (30 days by default): past it, a deleted document's files are removed from its bucket and its text forgotten, recorded as document.purged.
- 94d0c0c: Folio ships with AUGUR. The release builds its images and pins its version, the deploy stack runs it (`folio`, `folio-worker`, its frontend in `web`) and it registers itself on first start with no admin step. The registry's `PILLAR_APPS` are given the scopes their release asks for, can't be pinned to a version, and can be turned off but not removed (409); Admin shows them as shipping with AUGUR, without versions to go back to or a sign-in to issue. The updater restarts Folio and its worker in an upgrade. The service kit works out a bucket key's id from its secret (`bucketKeyIdFor`), so apps need only `S3_SECRET_ACCESS_KEY`. The shell's dev-app mode takes other apps beside the one being developed (`DEV_ALSO`), and the contract tests run with Folio on and off.

### Patch Changes

- 4608af1: Apps can look people up for sharing, with the new `people:read` scope. Identity says who a person stands for (`GET /v1/people/:id/principals`: `person:`, `team:` and `tree:` principals and `org`) and finds people and teams by name or names them by id (`GET /v1/directory`). The service kit's `identityPrincipals` (kept 30 seconds) and `identityDirectory` call them. Admin shows the scope as "Look up people and teams".
- Updated dependencies [f7fc3e6]
- Updated dependencies [94d0c0c]
- Updated dependencies [4608af1]
- Updated dependencies [936bb00]
  - @augur/service-kit@0.6.0

## 0.5.0

### Minor Changes

- ebb8b97: App storage: an app can keep its own database schema and files on the platform. A new one-shot `storage` service gives each app listed in `APP_STORAGE` a database login that owns one schema, and a bucket on Garage (the new S3-compatible object store in the deploy stack) with a key that opens only that bucket, from secrets in `.env`. Postgres gains pgvector. The service kit adds `appStorageFromEnv()`, manifests may say `"storage": { "database": true, "bucket": true }`, and the nightly backup now takes apps' files as well. See docs/app-storage.md.
- a3ba7ef: Admin → Updates can ask for an upgrade. **Upgrade to …** records the wanted release in the registry (`PUT /v1/platform/upgrade`, audited), after the admin enters their password again: the gateway now passes on when the caller last signed in (`x-user-signed-in-at`, `Caller.signedInAt`, `signedInRecently()` in the service kit), and the shell's `/auth/again?return=<path>` asks for the password and comes back. The deployment's updater (signed in as `platform-updater`) reads the upgrade from `/v1/platform/upgrade/target` and reports each step to `/v1/platform/upgrade/progress`; Updates follows along and says how it ended. An upgrade nothing has started can be cancelled.
- 2b9dffb: The updater: an optional container for Docker Compose deployments that runs the upgrade an admin asks for on Admin → Updates. It checks each image's signature and digest, the release's deploy files and required settings, takes a backup and test-restores it, pulls, restarts each part in turn and waits for its new version, and goes back to the release it was on by itself when a part doesn't come up. The registry now gives it each part's version, the required settings and the deploy files' hashes with the upgrade, and release files list those hashes. Turn it on with `COMPOSE_PROFILES=updater` (docs/upgrade.md, The updater).
- a09b413: Domain events: services tell each other what happened. The events service keeps events on topics (`folio.document.published`), which an app publishes on its own topics with the new `events:publish` scope, and hands them out in one order, never with a gap, to services with `events:subscribe`. It publishes the platform's own (`platform.person.disabled`, `platform.team.member-added`, `platform.app.turned-off` and more) as identity and the registry record those changes. The service kit adds an outbox (`OUTBOX_TABLE_SQL`, `addToOutbox`, `outboxRelay`) so an event is sent if and only if its change commits, `followEvents` for followers, `publishEvents` and `PLATFORM_TOPICS`. Admin names the two new scopes. Events are kept 30 days. See docs/domain-events.md.
- e0ecc1c: Releases can be mirrored for servers that can't reach GitHub. `scripts/mirror-release.mjs` copies a release's images, with their signatures, into your own registry and keeps a feed of mirrored releases (docs/mirror.md). The registry can now read that feed from a file on the server (`RELEASE_FEED_URL=file:///run/augur/releases/releases.json`, from `infra/deploy/releases`), and shows each mirrored release's notes link.
- b90f63b: Signed caller: the gateway signs the person it passes on (`x-augur-caller`, Ed25519, one minute, one service as audience) and publishes its key at `/api/gateway/v1/caller-keys`. The service kit's `signedCallers` hook drops unsigned `x-user-*` headers and puts back only the signed caller; the platform's services and new apps use it.
- 71dc094: Admin → Updates: whether a newer AUGUR release is out, what changes in each part, and what needs doing first (a release to go through, new settings, breaking changes, apps that won't open on the new SDK). The registry checks the release feed once a day and when an admin presses Check now (audited). Status marks a release that's out. New optional settings: `RELEASE_FEED_URL`, `RELEASE_CHANNEL`, and a read-only token in `infra/deploy/secrets/release-feed-token` for a private repository.
- 972d0ed: Uploads and document intents (SDK 1.4). A manifest's `maxUpload` (MB, 1 to 2048; 10 without it) is the largest request the gateway lets through to the app's service. Bodies stream through nginx and the gateway without being held; one past the limit gets 413, by its length or as it streams. Admins can lower an app's limit in Admin, Apps (`PUT /v1/apps/{id}/upload-limit`, audited as `app.upload-limit-set`), and the manifest the registry serves carries the limit in force. The SDK adds the standard document intents: `DOCUMENT_OPEN`, `DOCUMENT_PICK`, `DocumentRef` `{ app, id, version?, title }`, `DocumentPick`, `openDocument`, `pickDocument` (which checks the answer) and `isDocumentRef`.

### Patch Changes

- Updated dependencies [ebb8b97]
- Updated dependencies [a3ba7ef]
- Updated dependencies [a09b413]
- Updated dependencies [b90f63b]
  - @augur/service-kit@0.5.0

## 0.4.0

### Minor Changes

- f090793: The model gateway: a new platform service (`models`) that alone holds an AI provider's key. It speaks the OpenAI-style chat API to whichever provider the server sets (`MODEL_API_URL`: OpenRouter, a LiteLLM proxy, any compatible API, or `stand-in`, a built-in model that doesn't think, for trying things out), records every call in the audit log before making it, and gives each app a number of calls a day. It is off until an admin turns it on. App services ask it with `askModel` from the service kit and need the new `models:use` scope; the gateway forwards `/api/models` to it.
- 1622cd9: The platform is now called AUGUR. Packages move from `@platform/*` to `@augur/*`, and the shell's title, `<ui-shell>`'s default product name, Admin and new sign-in realms say AUGUR. Running servers keep their realm, database, Compose project and `.env` names; see docs/upgrade.md. The shell's import map still answers to `@platform/ui-kit`, so apps built before the rename keep loading.

### Patch Changes

- 8c0a9c8: Servers run released images instead of building them. Each AUGUR release now builds, pushes and signs (cosign, keyless) the web, gateway, identity, registry, events and models images to `ghcr.io/<repo>/<part>:<version>`, and its `augur-release.json` asset names each by digest. `infra/deploy/compose.yml` runs `${PLATFORM_IMAGES}/<part>:${PLATFORM_VERSION}` (new setting `PLATFORM_VERSION`, optional `PLATFORM_IMAGES` for a mirror); `compose.build.yml` builds from the checkout instead. The images run as unprivileged users, and the web container listens on 8080. See "Images from releases" in `docs/upgrade.md`.
- One AUGUR version over every part. The Version packages PR now writes `release/augur-release.json`: the AUGUR version (starting at 0.1.0 on the beta channel), every part's version, what changed, what's breaking, which AUGUR versions it upgrades from, and the deployment's settings with any added or removed. Merging it makes the GitHub release `augur@<version>` with the file attached and every changed part's changelog in its notes (see "The AUGUR release" in `docs/versioning.md`). Admin, Apps now shows Home and Admin at their released versions instead of 0.1.0: the registry takes them from their packages, kept in step by `scripts/versions.mjs`.
- Updated dependencies [f090793]
- Updated dependencies [1622cd9]
  - @augur/service-kit@0.4.0

## 0.3.0

### Minor Changes

- c40b827: Activity in Admin: the audit log, readable. Events' `GET /v1/audit` gains `since` and `until` (a time range) and `before` (the id of the oldest entry shown, for the next page); API 1.1.0. Admin's new Activity screen, under Platform, lists every change newest first as a sentence ("Alex Rivera added Sam Okafor to Finance"), filters by who, where and when (today, 7 days, 30 days, any time, or between two dates), shows 50 at a time with Show older, and opens any change to see everything recorded about it.
- b92585d: Admin app for people, departments and apps, so nobody needs Keycloak's console. Identity gains an admin API (`/v1/admin/people`, `/departments`, `/roles`) that manages people, roles and departments in Keycloak and audits every change; an admin can't turn off their own sign-in or remove their own admin role. The registry lists the whole catalogue for admins (`GET /v1/apps`) and lets them turn an app off and on (`PATCH /v1/apps/:id`); an app that is off stays off when it registers again. Admin now appears for admins. The UI kit adds `ui-select`, `ui-toggle` and `ui-checkbox-group`, four icons (`user-plus`, `department`, `key`, `plus`), and dialogs scroll inside instead of running off the screen.
- 0ba927c: Status in Admin: whether every part of the platform is answering, without the command line. The gateway checks every service's `/healthz` and the sign-in service's signing keys every 30 seconds, keeps the last answer, and serves it to admins at `GET /api/gateway/v1/status` (new contract `contracts/gateway.openapi.yaml`, API 1.0.0); a part that fails its check, or goes quiet for 2 minutes, reads Down. Admin's new Status screen lists each part with its version, state and when it last answered, refreshes every 15 seconds, and says what to check for a part that's down. Admin's menu gains a Platform stop with Status. The UI kit adds a `pulse` icon.
- 2abdd1d: Apps sign in to the platform as themselves. An admin issues an app's own sign-in with `POST /v1/admin/apps/{id}/credential` on identity, which makes (or gives a new secret to) the Keycloak client `app-<id>`: client credentials only, 5-minute tokens for the `platform-services` audience, audited without the secret. The app's service gets it as `SERVICE_CLIENT_SECRET`; the service kit's `appCredentialsFromEnv`, `clientCredentials` and `serviceVerifier` sign in and check those tokens, and `notify`, `recordAudit` and `callService` can name the floor a call is for. Manifests gain `scopes` (`notifications:send`, `audit:write`). The registry lets an app register only itself, and tells platform services what an app is granted (`GET /v1/apps/{id}/grants?workspace=`): for now, what its manifest asks for on every floor, and nothing while it is off. Events lets an app notify and write the audit log only for itself and only with the scope on the call's floor (403 otherwise, 503 while it can't be checked), keeping each answer for 30 seconds. The shared `SERVICE_TOKEN` still works for now. The Library and new apps from `pnpm create-app` sign in as themselves when they have a secret.
- ade8ba0: Go back to an earlier app version from Admin. The registry keeps the last 5 versions each app registers (`GET /v1/apps/:id/versions`) and lets an admin serve one of them and hold the app there (`PUT /v1/apps/:id/pin`) or follow new versions again (`DELETE /v1/apps/:id/pin`); API 1.2.0. A held app's new registrations are kept but not used. Admin's app details list the kept versions, pick the one to give the shell, and warn when an older version loads from the same address, so only its manifest comes back. Activity describes holds and held registrations. See "Going back to an earlier app version" in `docs/versioning.md`.
- d14956f: An app can be on for one floor and off for another. The registry keeps three separate things: whether an app is turned on at all (as before), installs per floor in a new `registry.installs` table (on or off, carrying on to the teams below unless told not to), and guardrails in `registry.guardrails`, where a block on a floor wins over anything below it. Everyone's own floor follows the org. Manifests gain `floors` (the kinds of floor an app works on) and a checked `surfaces` block (page, card, panel, settings or admin per kind of floor, with an optional role and roll-up). `GET /v1/manifest?workspace=` lists the apps on for the floor the gateway checked, and grants now hold only where an app is on. Admins set floors with `PUT /v1/apps/{id}/floors/{workspace}` and see them with `GET /v1/apps/{id}/floors`; a new version asking for more scopes is served but gets them only after `PUT /v1/apps/{id}/scopes`. Identity tells platform services where a floor sits (`GET /v1/workspaces/{id}`, read with the service kit's `floorPlaces`) and offers the roll-up `GET /v1/me/workspaces/{id}/rollup`. The shell asks for the catalogue of the floor you're on and asks again when you move. Admin, Apps shows where each app is on, floor by floor, with a choice for each, and lets an admin allow scopes a new version asks for. Services need `IDENTITY_URL` (set in both compose files).
- 9fe54e8: Find searches apps' own content (SDK 1.3). An app that declares `"search": true` in its manifest (the registry now accepts it) answers `GET /v1/search?q=` on its service with `{ results: [{ id, title, detail?, path?, workspace? }] }` (`SearchAnswer` and `SearchResult` in the SDK). As the person types, after a short pause and from two letters, the shell asks every such app on the current floor at once, through the gateway with the floor attached. Each app's results (at most ten, the current floor's first, others tagged with their floor) show under its name after Apps and Pages as they arrive. One still answering says "Still looking…" and one that takes longer than 1.5 seconds is let go, so none holds up the rest. Choosing a result opens its app at its `path`, on its floor. `ui-shell` takes `findGroups` beside `findResults` for results grouped and still coming. The contract tests check that Find asks the reference app on the floor and opens what it answers, and that a slow app doesn't hold Find up.
- 1981198: Apps can only load from allowed places. The registry refuses an app whose entry is a full address on a site an admin hasn't allowed (`/v1/origins`, audited as `origin.allowed` and `origin.removed`), and stops offering apps from a site once it's removed, marking them `blocked` in the catalogue. Admin's Apps screen gains "Where apps load from" to add and remove sites, and shows blocked apps. The shell's page is served with a Content Security Policy: scripts only from the platform, its import map and the sites in `APP_ORIGINS`.
- 0295651: The shared `SERVICE_TOKEN` is gone: every app and platform service signs in as itself. The service kit drops `SERVICE_TOKEN_HEADER`, `serviceFromHeaders` and `withoutServiceHeaders`; `ServiceCredentials` is now a name and a token source, and `platformCredentialsFromEnv` signs a platform service in as `platform-<name>`. Identity makes each platform service's Keycloak client (and the Library's, locally) from `SERVICE_CLIENT_SECRETS` when it starts, retrying until Keycloak is up. The registry and events accept only signed-in services; events asks the registry for grants as `platform-events`. `pnpm register-app` signs in as the app. Admin, Apps shows what each app may do and issues a new sign-in, showing its secret once. The deploy needs `IDENTITY_CLIENT_SECRET`, `REGISTRY_CLIENT_SECRET` and `EVENTS_CLIENT_SECRET` in place of `SERVICE_TOKEN` (see docs/upgrade.md).

### Patch Changes

- d1f8c5e: Notifications and the audit log know their floor. A service call that names a floor records it on each notification and audit entry, with the floor's path from the root as it stood then (asked of identity), so "everything under Finance" stays right after a team moves. `GET /v1/audit?workspace=` filters to a floor and the floors below it; admins read the whole log and a lead their own floor's. Team notices are opt-in per team (`PUT /v1/team-notices/{workspace}`, by its leads or an admin): `notify` with `toTeam` reaches everyone on the team as it is when sent, asked of identity's new `GET /v1/workspaces/{id}/people`. Identity records department changes on the department's floor, and the registry records floor rules on theirs. The shell tags a notification from another floor with its name, puts a dot on the gauge (and a count in Account) where something waits, and opening one goes to its floor. Admin, Activity filters by floor and says which floor an app was turned on, off or blocked for.
- 6a64067: Security fixes from the code review. The gateway checks sign-in on every path but `/healthz`, by the route a request matched rather than its raw URL, so a percent-encoded path such as `/%61pi/library/…` can no longer skip the check. It no longer forwards the person's `Authorization` header to any service; services already get the caller in `x-user-*` headers. `APP_UPSTREAMS` may not name a platform service. The registry refuses an app route inside or around another app's route (`/admin/people` would have taken over Admin's People page). Events treats an `X-Workspace-Id` that won't URI-decode as an unknown floor (400) instead of failing with 500.
- 778157a: Shell alpha: settings, Away and recent apps save to each person's account through a new Identity preferences API (`/v1/me/preferences`); Find also searches every app's menu pages and opens them; Agents, Switch workspace and the unbuilt Admin app are hidden until they exist. The UI kit adds `reducedMotion()`, which honours `data-motion="reduce"` on `<html>`, and `canSwitchWorkspace` on `ui-shell`.
- 4c96907: Backups are proven, not only taken. Once a week (and on first start) the backup container restores the newest backup into a throwaway database, checks the platform's tables and Keycloak's people came back, and records the result; `backup.sh --restore-test` runs one now. The gateway reads the last backup and restore test from `BACKUP_DIR` and adds them to `GET /api/gateway/v1/status` (API 1.1.0); Admin's Status shows them and its heading says "Backups need a look" when one failed or is overdue. Every request now carries one id from nginx through the gateway to each service: service-kit's `serviceLogging()` labels every log line with `requestId`, and the gateway returns it in `x-request-id`. New guide: `docs/upgrade.md`.
- Updated dependencies [2abdd1d]
- Updated dependencies [d14956f]
- Updated dependencies [d1f8c5e]
- Updated dependencies [45dfa21]
- Updated dependencies [94ea6cc]
- Updated dependencies [0295651]
- Updated dependencies [4c96907]
  - @augur/service-kit@0.3.0

## 0.2.0

### Minor Changes

- b705f16: Version the HTTP APIs and report releases on health. Each service's API now lives under `/v1` (through the gateway, `/api/<service>/v1/...`), matching its OpenAPI contract's major version, and `GET /healthz` answers with the service's release and API version. The registry requires every app to say which SDK releases it works with (`sdk`, a semver range) and a semver `version`; the shell won't open an app whose range its SDK doesn't satisfy, and says why.

### Patch Changes

- Updated dependencies [b705f16]
  - @augur/service-kit@0.2.0
