# 0031. A mirror's feed is the organisation's own, and carries the publisher's halt marks

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** part of [0017](0017-signed-release-feed.md) ("the signature travels with it, mirrors included")

## Context

[0017](0017-signed-release-feed.md) says the publisher's feed signature travels to every deployment, mirrors included. Building it showed a mirror can't do that: `scripts/mirror-release.mjs` doesn't copy the publisher's feed, it writes its own `releases.json` and `apps.json`, one release at a time, naming the images where the organisation keeps them. The publisher's signature covers a different file, so it can't vouch for the mirror's.

What a mirror's server still needs from 0017 is the halt signal, and protection from images nobody signed. The second it already has: the updater and the app runner check every image's own signature, wherever it was mirrored from.

## Options

1. **The mirror's feed is the organisation's own.** The mirror script carries each release's halt mark from the publisher, and the registry shows the feed as "your organisation's mirror" rather than "signed by the publisher". The organisation can sign its mirror's feed with its own identity later (`FEED_SIGNER`), when it wants the same guarantee inside its network.
2. **The mirror serves the publisher's signed feed unchanged,** plus a separate map from the publisher's image names to the mirror's. The feed then lists releases the organisation hasn't mirrored, and servers need a second file to make sense of it.
3. **Full TUF with the organisation as a delegated signer.** The right end state, and already the next step in 0017, but too much for one publisher today.

## Decision

Option 1.

- A mirror's feed is trusted as the organisation's own: the Upgrade Centre says so in words, and it is never shown as signed by the publisher.
- `scripts/mirror-release.mjs` copies the publisher's halt mark (halted.json) onto each release it mirrors. Mirroring a release again picks up a later halt or a resume.
- Expiry applies to the publisher's signed feed only. A mirror's feed doesn't expire, since the organisation decides when it refreshes it.
- A server that reads GitHub's releases straight (the old `GITHUB_TOKEN` path) is shown as not signed.

## Consequences

- An organisation must re-run the mirror script to pass on a halt. docs/mirror.md says so.
- Signing the mirror's own feed with the organisation's identity is left for when an organisation asks for it; the registry's `FEED_SIGNER` setting is the hook.

## Links

- Linear PER-177
- [0017](0017-signed-release-feed.md), [0018](0018-rollout-gates.md)
