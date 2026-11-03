---
---

Mandate moves to its own repository, harry-burton-dev/augur-mandate (ADR 0047): `release/app-repos.json` lists it, so AUGUR's feed lists its releases from there and the updater trusts only that repository to sign it. `apps/mandate` is removed from this repository. The release feed trims a stray line ending from `APP_RELEASES_TOKEN`.
