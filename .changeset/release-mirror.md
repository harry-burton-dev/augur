---
"@augur/registry": minor
---

Releases can be mirrored for servers that can't reach GitHub. `scripts/mirror-release.mjs` copies a release's images, with their signatures, into your own registry and keeps a feed of mirrored releases (docs/mirror.md). The registry can now read that feed from a file on the server (`RELEASE_FEED_URL=file:///run/augur/releases/releases.json`, from `infra/deploy/releases`), and shows each mirrored release's notes link.
