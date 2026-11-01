# 0017. The release feed is signed, expires, and can mark a release halted

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** none (extends [0013](0013-versions-and-releases.md))

## Context

Every image and release file is signed with cosign, but the feed that tells a deployment which releases exist (`ghcr.io/<repo>/feed`) is not. Whoever controls the path to a deployment, a mirror included, could leave a fix out of the feed (a freeze attack) or list a withdrawn release again, and the deployment couldn't tell. Deployments pull and air-gapped ones can't be reached, so a stop signal can only travel in the feed. The Update Framework (TUF) names these attacks and is the standard defence.

## Options

1. **Sign the feed now, with an expiry and a per-release halted mark. Adopt full TUF later.** Same cosign identity as the images, no new dependency.
2. **Full TUF now** (a TUF repository plus the tuf-js client). Threshold keys and an offline root are more key ceremony than a single publisher needs.
3. **Leave the feed unsigned.**

## Decision

Option 1.

- The Release workflow signs the feed with the same keyless identity it signs images with, and the signature travels with it, mirrors included. A mirror never re-signs.
- The feed carries `expires`. The registry refuses a feed whose signature doesn't verify or that has expired, keeps everything running, and the Upgrade Centre says why and what to do.
- Each release in the feed can carry `halted` with a reason and a date. A halted release is never offered or scheduled, and a deployment running one is told what to move to.
- Full TUF (tuf-js, with root keys an organisation can hold) is the next step when an organisation needs its own root or there is more than one publisher. It needs its own record.

## Consequences

- Air-gapped mirrors must be refreshed before the feed expires; the Upgrade Centre warns ahead of time.
- `scripts/publish-feed.mjs`, the registry's feed reader and `docs/mirror.md` change in the build PR. Tests cover an unsigned, a tampered and an expired feed.

## Links

- Linear PER-177
- Updater research (a private design note)
