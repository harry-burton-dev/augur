---
"@platform/registry": patch
---

One platform version over every part. The Version packages PR now writes `release/platform-release.json`: the platform version (starting at 0.1.0 on the beta channel), every part's version, what changed, what's breaking, which platform versions it upgrades from, and the deployment's settings with any added or removed. Merging it makes the GitHub release `platform@<version>` with the file attached and every changed part's changelog in its notes (see "The platform release" in `docs/versioning.md`). Admin, Apps now shows Home and Admin at their released versions instead of 0.1.0: the registry takes them from their packages, kept in step by `scripts/versions.mjs`.
