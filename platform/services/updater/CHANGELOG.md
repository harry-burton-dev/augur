# @augur/updater

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
