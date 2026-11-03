# 0049. AUGUR ships the pinned releases of its pillar apps, made in their own repositories

- **Status:** Accepted
- **Date:** 2026-11-03
- **Decided by:** Harry
- **Replaces:** none. Builds on [0012](0012-apps-in-own-repositories.md), [0017](0017-signed-release-feed.md) and [0047](0047-app-repositories-in-augurs-feed.md).

## Context

The apps every deployment runs (Artifacts, Explorer and Data Atlas) are part of an AUGUR release: Compose runs them from `${PLATFORM_IMAGES}/<id>:${PLATFORM_VERSION}`, the updater restarts them in its roll order, and the web image serves their frontends. Until now the Release workflow built them from `apps/`. They now live and release in their own repositories ([0047](0047-app-repositories-in-augurs-feed.md)), so AUGUR has to take them from there, without a change on any server.

## Options

1. **Pin each app's release and take its images.** AUGUR's release copies the pinned release's signed service image under its own images (same digest), signs it again as AUGUR's, and serves the frontend it carries. Nothing changes for Compose, the updater or servers. Each app's release is checked against its own repository's signature first.
2. **Build each app from its repository's source at a pinned tag.** Same result for servers, but the image AUGUR ships is not the one the app released and tested, and every release rebuilds every app.
3. **Let the updater's app runner install the pillar apps from the feed, like any other app.** The cleanest end state, but it moves running apps from AUGUR's Compose project into the app runner's, which is a server change with its own upgrade path.

## Decision

Option 1, for now; option 3 stays open as a later, separate change.

- `release/shipped-apps.json` pins, for each app AUGUR ships, its repository and the release (`app/<id>@<version>`) this AUGUR release ships, with that release's package versions, which are AUGUR parts as before. Only releases are pinned, never a dev build or preview.
- `node scripts/shipped-apps.mjs pin <id> <version>` moves a pin: it checks the release exists, reads its packages' versions, and adds a changeset so the next Version packages pull request moves AUGUR's version.
- The Release and dev builds workflows (`infra/release-images.sh`) take each pinned release's `app-release.json`, refuse it unless it is that app at that version signed by its own repository's `release.yml` on `main`, check the image's signature against that identity, copy the image under AUGUR's images and sign it as AUGUR's Release workflow does. The web image serves the frontend the service image carries.
- An image the app's release doesn't carry is built from the app's source at its release tag (`build` in the pin: Artifacts' rendition worker), reused by git tree for dev builds as before.
- Shipped apps stay out of `release/app-repos.json`, so the feed doesn't offer them separately from AUGUR.

## Consequences

- A server needs nothing new: the images, tags, Compose services and signatures it checks are the same.
- An app change reaches AUGUR only when its pin moves: a pull request that runs `pin`, then the Version packages pull request. Renovate or the app's release could open that pull request later.
- The Release workflow needs `APP_RELEASES_TOKEN` (releases and source) and `PACKAGES_READ_TOKEN` (the app images; GitHub's fine-grained tokens can't read packages) in this repository.
- Tests: `scripts/shipped-apps.test.mjs` (what a pin and a release must be); CI's image job checks the web image serves what's put in `.shipped/frontends`; the deploy test checks each shipped frontend and service on the real release.

## Links

- Linear PER-244, PER-278
- Repository split plan (a private design note)
