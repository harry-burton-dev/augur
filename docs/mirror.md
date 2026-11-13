# Mirroring AUGUR releases

For a server that can't reach GitHub: copy each release into your organisation's own image registry, and keep a feed of releases where the server can read it. the Upgrade Centre, the updater and the steps in [upgrade.md](upgrade.md) then work as usual, from your mirror.

A mirror holds:

- **The images**, by the digest the release names, with their signatures, so the updater can still prove each one was built by this repository's Release workflow.
- **The feed**: `releases.json`, a list of the release files (`augur-release.json`) you've mirrored. The registry reads it in place of GitHub's releases.
- Optionally, **the deploy files** for each release (`infra/deploy`, `docs` and the preflight script), for servers that can't reach the repository either.

## Mirror a release

On a machine that can reach GitHub and your registry, with a checkout of this repository, Node 22 and [cosign](https://docs.sigstore.dev/cosign/system_config/installation/):

```sh
docker login ghcr.io                     # a token with read:packages
docker login registry.example.org        # one that can push to your registry
export GITHUB_TOKEN=<a token that can read this repository's releases>
git fetch --tags
node scripts/mirror-release.mjs 0.3.0 --to registry.example.org/augur --feed ./augur-mirror --bundle
```

It copies each image to `registry.example.org/augur/<part>:0.3.0`, checks the copy's signature from your registry, adds the release to `augur-mirror/releases.json` and, with `--bundle`, writes `augur-mirror/augur-0.3.0-deploy.tar.gz`. Run it again for each new release with the same `--feed` folder: the feed keeps every release you've mirrored, newest first.

A release starts on the beta channel. When it's promoted to stable on GitHub, run the script for that version again so the feed says so.

## Point the server at it

In `infra/deploy/.env`:

```sh
PLATFORM_IMAGES=registry.example.org/augur
RELEASE_FEED_URL=https://mirror.example.org/augur/releases.json
```

`RELEASE_FEED_URL` is wherever you publish `releases.json`: any web server the registry can reach, without a sign-in. If there's none, keep the feed on the server instead, in `infra/deploy/releases/` (copy `releases.json` there each time), and set `RELEASE_FEED_URL=file:///run/augur/releases/releases.json`.

The server pulls from your registry, so sign Docker in to it (`docker login registry.example.org`, read-only). For the [updater](upgrade.md#the-updater), save the same read-only token as `infra/deploy/secrets/image-pull-token` and set `IMAGE_PULL_USER` to its account, as for ghcr.

Each release also carries its own signed deploy bundle, `augur-deploy-<version>.tar.gz` ([Install AUGUR, step 1](src/content/docs/run/install.md#1-get-the-release)): download it and its `.sigstore.json` from the release page and publish them beside your feed, for servers that can reach your mirror but not GitHub. The script doesn't copy them yet. For servers that can't reach the repository, unpack one in place of `git checkout augur@<version>`, or the script's own `--bundle`, which adds the docs but is unsigned and has no `SHA256SUMS`:

```sh
tar -xzf augur-0.3.0-deploy.tar.gz       # infra/deploy, docs, scripts/preflight.mjs
```

It never overwrites `.env`, `secrets/` or `backups/`, which aren't in it.

## Signatures

The updater checks each image's signature before running anything, and that check reads Sigstore's public trust root. A server whose outbound traffic is blocked needs these two allowed for the updater, read-only:

- `tuf-repo-cdn.sigstore.dev`
- `rekor.sigstore.dev`

A server with no outbound traffic at all checks them offline instead, from a copy of the trust root. The mirror script writes one, `trusted_root.json`, into the `--feed` folder each time it runs; copy it to `infra/deploy/releases/trusted_root.json`. When that file is there, the updater checks every signature (AUGUR's and apps') against it and the transparency-log proof each signature carries, and asks Sigstore nothing. Sigstore rotates its keys now and then, so copy the newest one across with each release you mirror.

## Halted releases

When the publisher halts a release ([release-channels.md](release-channels.md#halting-a-release)), the mirror script copies the mark onto that release in your feed, and a later resume takes it off. It only sees the mark when it runs, so mirror a halted release again to pass the halt on to your servers (`node scripts/mirror-release.mjs <version> --to …`, and `apps` for an app's). The Upgrade Centre shows a mirror's feed as your organisation's own: the publisher's feed signature covers the publisher's feed, not the one the mirror writes, so it can't vouch for yours (ADR 0031). Every image is still checked against the publisher's signature. An AUGUR beta whose deploy test hasn't passed (still running, timed out or failed) is copied as halted too, as the publisher's feed lists it; mirror it again once its deploy test passes.

## Mirror apps

Apps the [app runner](upgrade.md#the-app-runner) installs have releases of their own (`app/<id>@<version>`). Mirror them the same way, into the same feed folder:

```sh
node scripts/mirror-release.mjs apps --to registry.example.org/augur --feed ./augur-mirror
node scripts/mirror-release.mjs apps --to registry.example.org/augur --feed ./augur-mirror --app notes   # just one app
```

For each app it copies its newest 3 releases, stable or beta (never pull requests' previews or drafts): each part's image to `registry.example.org/augur/apps/<image name>` (an older release's one service to `…/apps/<id>`) and its frontend to `…/apps/<id>-frontend`, by the same digests, with their signatures, each checked again from your registry. It writes `augur-mirror/apps.json`, the apps' feed, with the release files pointing at your copies, and keeps releases it mirrored before.

Then point the registry at it in `infra/deploy/.env`, as for AUGUR's feed:

```sh
APP_FEEDS=https://mirror.example.org/augur/apps.json
# or, kept on the server in infra/deploy/releases/:
APP_FEEDS=file:///run/augur/releases/apps.json
```

Without `APP_FEEDS` (or `APP_FEED_URL`, its name before), a server whose `RELEASE_FEED_URL` is a mirror reads no app releases at all. Previews of pull requests aren't mirrored: they're for servers that can reach GitHub ([app-previews.md](app-previews.md)).

Default apps (`DEFAULT_APPS`, [upgrade.md](upgrade.md#the-app-runner)) come from the feed too, so mirror each one's stable releases before naming it: until the mirror's `apps.json` has a stable release of it, Deployment → Apps says it's waiting for one.
