# @augur/updater

## 0.10.0

### Minor Changes

- 1aa37dc: Installing an app on the app contract brings its frontend: the app runner checks the bundle's signature, pulls it by the digest the release names and gives it to the registry, which keeps it at `/apps/<id>/<version>/`, where the shell loads the app from. Previews get theirs the same way. The registry is on contract 1.42.0.
- db7ec72: An app that asks for the internet (augur-outbound) reaches it only once a deployment admin allows it in Admin → Apps; then only its parts that ask for it do.
- 73eed92: Each app on the app contract runs on a network of its own, which the gateway joins, and Postgres, the object store and the collector only for an app granted them; nothing on it reaches the internet.
- ec63a74: An app's own settings (text, number, on or off, a choice, or a secret) are filled in by a deployment admin in Admin → Apps and reach its parts through augur-settings; a changed value starts again only the parts that read it.
- 23117fe: Removing an app from the server takes its sign-in away at once and keeps its data, settings and floors for APP_DATA_GRACE_DAYS (30), then deletes them after a backup; installing it again before then keeps them. A deletion that fails waits longer each time, up to a day, and Admin shows why.
- be9a894: The app runner runs app contract 3 releases: one container per Score part, `app-<id>-<part>-<slot>`, given only what its resources' provisioners hand it (the gateway, a database login, a bucket, scratch and files folders, telemetry, the floor graphs, settings), its secrets as files mounted as Compose secrets, its memory and CPU limits applied within the deployment's new ceilings, a read-only root with `/tmp`, and refused when its image runs as root. Job parts run to the end before the switch; every service part must answer `/healthz` on the new version. Only `APP_PUBLISHERS` says who may publish apps, and the runner tells the registry the deployment's own networks at start.

### Patch Changes

- c8584cd: The backup container runs the database's own image, with pgvector, so the restore test brings back apps' vector columns (Data Atlas's `atlas.entity_vectors`) instead of failing on them and stopping every upgrade. When an upgrade doesn't go ahead, the updater's log now says why.
- bd8ff7e: The last of the machinery for apps that ship with AUGUR (ADR 0049) is gone, now that none does (ADR 0075). The release no longer takes apps' releases into AUGUR's images, the updater no longer restarts shipped apps or hands runner-installed apps over to AUGUR, and the registry no longer reads `PILLAR_APPS`: a platform or pillar app's kind is honoured when the app runner installed it from the signed feed. Registry API 1.36.1 marks `ships` and `pillar` deprecated; neither is ever set.
- dfc36c1: The app runner keeps its record of previews through installs and undoes a failed switch fully. A tarball with a negative size is refused, ids that collide with platform secrets or jobs schemas are reserved, previews use their own jobs schema, and one refused outbox row no longer holds up the rest.
- 683062a: Upgrades and backups hold up when things go wrong. The updater writes .env whole, refuses an upgrade on a nearly full disk or one whose settings would change what the server trusts, never goes back by itself past a breaking release once a part has restarted, and goes back after a restart partway through. Backups are readable by root alone and the gateway sees only their results; the off-server copy carries .env and secrets, encrypted, and refuses an empty or another server's dump; and the lost-server guide restores before anything is copied. Telemetry and Artifacts' rendition worker get networks of their own. Feed, promote, halt and Lockfile workflows refuse to run outside main or to leak their token, and a beta that fails its deploy test is listed halted.
- 57b8fee: The updater no longer rolls back a release that moves a running part onto AUGUR's own image (Keycloak in 0.19.0). It used to pull that part before writing the new compose.yml, so it fetched the old image (Keycloak's own) and stopped with "The keycloak image pulled for … isn't the one the release names". Such a part is now pulled once the new compose.yml names AUGUR's image, and going back puts it on the old image again.
- Updated dependencies [3e2ff05]
- Updated dependencies [e2089a3]
- Updated dependencies [656f2d1]
- Updated dependencies [b2c7a81]
- Updated dependencies [0e4e55f]
- Updated dependencies [6c0abe4]
- Updated dependencies [699af61]
- Updated dependencies [dfc36c1]
- Updated dependencies [f01d0c4]
- Updated dependencies [832458f]
- Updated dependencies [1ce4194]
  - @augur/app-tools@0.5.0
  - @augur/service-kit@0.18.0

## 0.9.5

### Patch Changes

- Updated dependencies [4cfab7e]
  - @augur/service-kit@0.17.1

## 0.9.4

### Patch Changes

- 6ec3e70: What these services say as they start, and the storage and realm jobs as they run, goes through the service kit's `startupLog` instead of `console`: the same JSON lines as the rest of their logs, sent to the deployment's telemetry stack with them.
- Updated dependencies [1a8561d]
- Updated dependencies [c678672]
  - @augur/service-kit@0.17.0

## 0.9.3

### Patch Changes

- Updated dependencies [c0de29b]
- Updated dependencies [8eba62b]
- Updated dependencies [ab9f61f]
  - @augur/service-kit@0.16.0

## 0.9.2

### Patch Changes

- Updated dependencies [833b4ed]
- Updated dependencies [431db38]
  - @augur/service-kit@0.15.0

## 0.9.1

### Patch Changes

- 90057d9: Every call one service makes to another now has a deadline (PER-213). `withDeadline` and `serviceTimeoutMs` in the service kit give each call 5 seconds unless `SERVICE_CALL_TIMEOUT_SECONDS` says otherwise. The kit's helpers (callService, floors, people, grants, settings, the service token, domain events) use it, as do the gateway's calls to identity and the registry, identity's calls to Keycloak (15 seconds), storage's to Garage and the updater's to the registry. A hung service now gives the caller its usual "can't be reached" error, so it answers 503 within seconds rather than waiting minutes. Calls to the model gateway get 3 minutes, and frontend uploads get 2.
- 1e58d38: A printable card for the admin who wakes to an upgrade that went back by itself, didn't install, or kept running after its watch saw a problem: docs/upgrade-went-back.md. The updater's, the after-watch's and the Upgrade Centre's messages now point at it. deploy.md's restore now stops everything but Postgres, as its words always said.
- Updated dependencies [1f83a5f]
- Updated dependencies [2f2b01a]
- Updated dependencies [7886a1e]
- Updated dependencies [f902da5]
- Updated dependencies [866c076]
- Updated dependencies [04d7ed1]
- Updated dependencies [4f8d944]
- Updated dependencies [90057d9]
- Updated dependencies [858fad1]
- Updated dependencies [33b6fa3]
  - @augur/service-kit@0.14.0

## 0.9.0

### Minor Changes

- 9ad4399: Mandate ships with AUGUR, like Artifacts, Explorer and Data Atlas: a `mandate` container with its own sign-in, login and schema (`MANDATE_*` in `.env`). On a server whose app runner installed it, AUGUR's container takes over the same schema, the updater stops the runner's copy, and Admin → Apps stops listing it as an installed app.

### Patch Changes

- 03e7d87: Every deployment setting is described once, in infra/deploy/settings.schema.json, and CI checks compose.yml, .env.example, the guides and the services' code against it (`pnpm check:settings`). Settings the guides named but compose never passed now reach their services: FEED_SIGNER (registry), IMAGE_SIGNER, IMAGE_SIGNER_ISSUER and AUGUR_DEV_SIGNER (updater), DOMAIN_EVENTS_KEEP_DAYS (events), MODEL_TIMEOUT_SECONDS (models), CALLER_SIGNING_KEY (gateway), and OTEL_EXPORTER_OTLP_HEADERS, OTEL_TRACES_SAMPLER and OTEL_TRACES_SAMPLER_ARG (every service). An empty DOMAIN_EVENTS_KEEP_DAYS or MODEL_TIMEOUT_SECONDS keeps its default, and AUGUR_DEV_SIGNER follows the repository a fork's IMAGE_SIGNER names.
- 7517bd7: `release/shipped-apps.json` is now the one list of the apps that ship with AUGUR. The updater reads it from its image to restart them in order and check each comes back, and refuses an upgrade with an image for a part the server runs that it doesn't know, instead of restarting it unchecked. `pnpm check:release` fails when a compose file disagrees with it. The registry refuses an app whose id a part of AUGUR answers to (a platform service, a platform app, a deployment service or a path the front door serves), saying which, and storage makes no schema under such an id (`RESERVED_APP_IDS` in the service kit).

  The updater restarts AUGUR's own Keycloak image first, giving it up to five minutes to be ready, and keeps it running when going back to a release from before that image.

- b7f0f21: The app runner takes a backup before an app's first release from another repository, such as an app moving into its own (ADR 0047). That release takes over the data the old one left. The install's first step names the backup file. Later releases from that repository install as before.
- Updated dependencies [7dbdf7b]
- Updated dependencies [2dbdc22]
- Updated dependencies [0ec750c]
- Updated dependencies [7518ce8]
- Updated dependencies [dec1a40]
- Updated dependencies [566f261]
- Updated dependencies [7517bd7]
  - @augur/service-kit@0.13.0

## 0.8.1

### Patch Changes

- 3b86bbc: `node dist/index.js check` runs one look of the watch after an upgrade on demand: sign-in, AUGUR's calls at the gateway and every part's readiness. It prints what it found as one JSON line and exits 1 when anything is wrong. The deploy test's new `broken` mode uses it to show the watch sees a real failure on real containers.
- Updated dependencies [b3060e0]
  - @augur/service-kit@0.12.0

## 0.8.0

### Minor Changes

- 7bb3f92: An app upgrade is watched for 5 minutes after the switch, while the old version still runs. If the new version stops answering, the runner goes back to the old one by itself.
- 0afbe4d: Apps that live in their own repositories (release/app-repos.json, ADR 0047) are trusted from there: the updater takes each such app only as signed by its own repository, and the release feed lists that repository's releases of it. No app is listed yet, so nothing changes on a server until one moves.
- 7dffd91: A watch too quiet to judge errors by keeps going lightly until AUGUR's services have had 20 calls, for up to a day. A problem it finds then shows in Needs you and doesn't go back by itself (ADR 0020, amended).
- 3d000f8: After an upgrade to a newer release, the updater watches it for 10 minutes before calling it done: sign-in must keep answering and no more than 5% of the gateway's calls may fail (ADR 0020). If either fails it goes back by itself, unless a breaking release lies between, when it leaves the release running and says so. The registry asks for the watch with each forward upgrade, and the new watch step is listed.
- 9b033fd: The watch after an upgrade really signs in (a fresh token as the updater), checks every part stays ready, judges errors by AUGUR's own services' calls only, and says when it was too quiet to judge errors.

### Patch Changes

- 975801a: AUGUR's repository is about to be renamed from `im-platform`. The updater and registry now take AUGUR's releases, dev builds and release feed signed under either name, and an app built in AUGUR's repository counts as the same publisher under both. Images and the feed stay at `ghcr.io/harry-burton-dev/im-platform`, so nothing on a server changes. A server needs this release before the rename (docs/upgrade.md).
- Updated dependencies [137791c]
- Updated dependencies [2021f8a]
  - @augur/service-kit@0.11.0

## 0.7.1

### Patch Changes

- 14e1944: Takes releases signed on `main` and on a hotfix's `release/<unit>-<major>.<minor>` branch, and dev builds signed on `main` as well as `dev`, ready for releases to come from one branch, `main`.

## 0.7.0

### Minor Changes

- 8d67974: AUGUR dev builds: every merge into `dev` that changes AUGUR is built, signed and released as the pre-release `augur@<next patch>-dev.<run>`, and the workbench (`SERVER_RING=dev`) takes each one by itself, after a backup, when nothing needs a person. The registry's new `dev` channel (`RELEASE_CHANNEL=dev`, the workbench's default) follows dev builds and every release; the updater checks a dev build's signature against the AUGUR dev builds workflow on `dev` and refuses one on any other server (docs/release-channels.md, "AUGUR dev builds").

### Patch Changes

- 92547d6: A third server ring, `SERVER_RING=dev`, for the workbench you build on: everything a preview server takes (preview releases, apps' dev builds, pull requests' builds, opt-in feature previews), and later AUGUR's own dev builds. Set it on the workbench in place of `preview` (docs/release-channels.md, "Server rings").
- Updated dependencies [ea41136]
  - @augur/service-kit@0.10.0

## 0.6.0

### Minor Changes

- d709061: Dev builds: every merge into `dev` that changes a runner app builds it as `<next patch>-dev.<run>`, signed on `dev`. A preview server's admin can set an app to **Dev builds too** in Admin → Apps, and the updater takes a backup before each one; production servers refuse them. A migration is frozen once it's on `dev`. Registry contract 1.26.0 (docs/release-channels.md, "Dev builds").

## 0.5.0

### Minor Changes

- 65f4ede: Go back: Admin → Updates lists the releases before yours and goes back to one with the updater's usual steps (a backup first), while no release between is breaking; across a breaking one it says which and why, and going back is by hand. The updater stops parts the older release doesn't have, and starts them again if it has to roll back. Admin → Apps goes back to one of an app's three earlier versions and holds it there. Registry contract 1.25.0 (`PUT /v1/platform/go-back`, `goBack`, `older`).
- 0f21cbd: Takes releases signed by the Release workflow on `preview` or `production` as well as `main`, ready for release channels (docs/release-channels.md). An app's release is checked the same way. Upgrade to this release before the first release made on `preview`, or the updater refuses it.

## 0.4.2

### Patch Changes

- 08ec784: The app runner puts apps on the network the updater itself is on, rather than assuming `platform_default`, so installs work when the platform's Compose project has another name. `APPS_NETWORK` in `.env` still wins.

## 0.4.1

### Patch Changes

- eef32c2: Data Atlas ships with AUGUR: its own container, schema and sign-in in every deployment, and the updater restarts it and waits for it to answer.
- b556614: The updater restarts Auspex, which now ships with AUGUR, and waits for it to answer.
- Updated dependencies [f0d02e2]
- Updated dependencies [bbdad18]
  - @augur/service-kit@0.9.0

## 0.4.0

### Minor Changes

- 8cea360: Checks signatures offline when the deploy folder has a copy of Sigstore's trust root (`releases/trusted_root.json`), which the mirror script now writes. The mirror script also mirrors apps' releases (`mirror-release.mjs apps`) into a feed for `APP_FEED_URL`.
- 3e3c173: One read key per deployment. With a read:packages token in `secrets/github-read-key` and `GITHUB_READ_USER` in `.env`, the registry checks for new AUGUR and app releases in the feed the Release workflow now keeps beside the images (`ghcr.io/<repo>/feed:latest`, `RELEASE_FEED_URL=oci://…`), and the updater signs Docker in with the same key to pull. The older `release-feed-token` and `image-pull-token` still work. See "The read key" in docs/upgrade.md.
- 71a6ec6: New settings a release needs are entered on Admin → Updates. **Upgrade to …** has a field for each new setting only a person can give; the registry passes what's entered to the updater (kept in memory until the upgrade ends, never stored, only names audited), and the updater writes it to `.env`, quoted when needed. A new secret (`_SECRET`, `_PASSWORD`, `_TOKEN`) gets no field: Updates says the updater makes it up.
- 315c78b: The updater now upgrades a server whose deploy files the new release changes, instead of sending it to be upgraded by hand. Each release's updater image carries that release's `infra/deploy`; the updater checks the files against the release file, writes them, starts any part the release adds, and makes again anything that mounts a changed file. Going back puts the old files back. It still stops when a file it would change has been edited on the server. A new required setting ending in `_SECRET`, `_PASSWORD` or `_TOKEN` is made up and added to `.env`. User 1000 now has to be able to write `infra/deploy` (docs/upgrade.md, The updater).

### Patch Changes

- aa1724a: Services check their settings before they start. The service kit's `loadConfig` takes a list of the settings a service reads (`Setting`, plus `commonSettings` for the ones services share). In production, a missing required setting stops the service with one message listing every problem, instead of falling back to a `localhost` address. A secret can be given as a file in `<NAME>_FILE`. `describeConfig` reports each setting and where it came from, never a secret's value, ready for Admin → Deployment.
- Updated dependencies [aa1724a]
  - @augur/service-kit@0.8.0

## 0.3.0

### Minor Changes

- 82ce131: Pull requests that change an app get previews: the App previews workflow builds, signs and releases each push as `<x.y.z>-pr.<n>.<run>`, and a server with the app installed runs the newest build beside it (at most three per app, for a week after the last build, gone when the pull request closes) with scratch storage of its own. An admin names an app’s developers in Admin → Apps; each developer can switch to a preview for themselves (`/v1/previews`), which gives them its frontend and sends their calls to it, while everyone else stays on the installed version.
- 57d3760: The updater can now run apps: with `APP_SECRETS_KEY` in `.env` it installs, upgrades and removes apps that don't ship with AUGUR, from their signed releases, in a Compose project of its own (`augur-apps`). Upgrades are blue/green with a health check: a version that doesn't come up leaves the old one serving. Admins ask for installs and removals through the registry's new `/v1/app-runner/jobs`, and the service kit's `registerApp` leaves registering to the runner when it runs the app.

### Patch Changes

- Updated dependencies [57d3760]
- Updated dependencies [476907a]
- Updated dependencies [ef587a4]
- Updated dependencies [a6b6bca]
- Updated dependencies [948526d]
  - @augur/service-kit@0.7.0

## 0.2.0

### Minor Changes

- 94d0c0c: Folio ships with AUGUR. The release builds its images and pins its version, the deploy stack runs it (`folio`, `folio-worker`, its frontend in `web`) and it registers itself on first start with no admin step. The registry's `PILLAR_APPS` are given the scopes their release asks for, can't be pinned to a version, and can be turned off but not removed (409); Admin shows them as shipping with AUGUR, without versions to go back to or a sign-in to issue. The updater restarts Folio and its worker in an upgrade. The service kit works out a bucket key's id from its secret (`bucketKeyIdFor`), so apps need only `S3_SECRET_ACCESS_KEY`. The shell's dev-app mode takes other apps beside the one being developed (`DEV_ALSO`), and the contract tests run with Folio on and off.

### Patch Changes

- Updated dependencies [f7fc3e6]
- Updated dependencies [94d0c0c]
- Updated dependencies [4608af1]
- Updated dependencies [936bb00]
  - @augur/service-kit@0.6.0

## 0.1.0

### Minor Changes

- 2b9dffb: The updater: an optional container for Docker Compose deployments that runs the upgrade an admin asks for on Admin → Updates. It checks each image's signature and digest, the release's deploy files and required settings, takes a backup and test-restores it, pulls, restarts each part in turn and waits for its new version, and goes back to the release it was on by itself when a part doesn't come up. The registry now gives it each part's version, the required settings and the deploy files' hashes with the upgrade, and release files list those hashes. Turn it on with `COMPOSE_PROFILES=updater` (docs/upgrade.md, The updater).

### Patch Changes

- Updated dependencies [ebb8b97]
- Updated dependencies [a3ba7ef]
- Updated dependencies [a09b413]
- Updated dependencies [b90f63b]
  - @augur/service-kit@0.5.0
