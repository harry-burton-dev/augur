# Mirroring AUGUR releases

For a server that can't reach GitHub: copy each release into your organisation's own image registry, and keep a feed of releases where the server can read it. Admin → Updates, the updater and the steps in [upgrade.md](upgrade.md) then work as usual, from your mirror.

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

For servers that can't reach the repository, unpack the release's deploy files in place of `git checkout augur@<version>`:

```sh
tar -xzf augur-0.3.0-deploy.tar.gz       # infra/deploy, docs, scripts/preflight.mjs
```

It never overwrites `.env`, `secrets/` or `backups/`, which aren't in it.

## Signatures

The updater checks each image's signature before running anything, and that check reads Sigstore's public trust root. A server whose outbound traffic is blocked needs these two allowed for the updater, read-only:

- `tuf-repo-cdn.sigstore.dev`
- `rekor.sigstore.dev`

A server with no outbound traffic at all can't run the updater's check yet. Upgrade it by hand from the mirror ([upgrade.md](upgrade.md)). The mirror script checked each image's signature when it copied it, and `pc pull` pulls the tags it wrote, so keep pushing to your registry to the people and machines that run the script.
