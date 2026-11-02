# 0047. Apps in their own repositories release there, and AUGUR's feed lists them

- **Status:** Accepted
- **Date:** 2026-11-02
- **Decided by:** Harry
- **Replaces:** none. Builds on [0012](0012-apps-in-own-repositories.md) and [0017](0017-signed-release-feed.md).

## Context

[0012](0012-apps-in-own-repositories.md) moves every app into its own repository. Today an app's release is made in the platform repository, listed in AUGUR's signed feed ([0017](0017-signed-release-feed.md)), and its images are signed by the platform's release workflow, which every updater trusts. Once an app releases elsewhere, deployments have to find its releases and know whom to trust for them, without each server adding settings by hand.

## Options

1. **Each app repository publishes its own feed; deployments list the feeds they read.** No shared token, but every deployment needs a setting per app, and a feed nobody signs for AUGUR.
2. **AUGUR's feed lists the app repositories' releases; the updater trusts each repository for its own app.** One feed and no server settings. The feed workflow needs a token that can read the app repositories.
3. **App repositories call a reusable release workflow in the platform repository.** One copy of the release steps, but the signature then names the platform's workflow, not the app's repository, so the updater can no longer tell which repository released an app.

## Decision

Option 2.

- `release/app-repos.json` maps each app that lives in its own repository to that repository (`owner/repo`). Adding a line is part of the pull request that moves an app out, and it ships with the next AUGUR release.
- The Release feed workflow lists, from each of those repositories, only its own app's `app/<id>@<version>` releases whose `app-release.json` names that repository as its signer. It stops listing that app's older releases from the platform repository.
- The updater ships the same file and trusts each repository's `release.yml` (and its `app-dev.yml` and `app-preview.yml` for dev builds and previews) to sign that app, and no other. A release of that app signed anywhere else is refused.
- Each app repository keeps its own short workflows, from the app template; the release steps themselves come from a published package (`@augur/app-tools`), so they're kept in one place without changing who signs.
- One fine-grained token, `APP_RELEASES_TOKEN`, reads the app repositories' releases and lets an app's release workflow start the Release feed workflow. It's kept as a secret in the platform repository and in each app repository.

## Consequences

- A server needs no new setting for a moved app, and `APP_PUBLISHERS` stays for apps from outside AUGUR.
- A server trusts the app's new repository only once it runs the AUGUR release whose file names it. The feed lists the app from its new repository as soon as the file names it, so the app's first release from there should follow that AUGUR release, not come before it.
- The token is a credential with read access to the app repositories and Actions access to the platform repository; it is the one secret this adds, and it expires and is renewed like the read key.
- Tests: `scripts/publish-feed.test.mjs` and the updater's runner tests check that a repository can't list or sign another app.

## Links

- Linear PER-244, PER-160
- Repository split plan (a private design note)
