---
"@augur/mfe-sdk": minor
"@augur/shell": minor
---

Apps get the person's date formats (PER-323): `ctx.formats` (SDK 2.0) carries their `language`, the `locale` to write dates in, their `timeZone` and `hourCycle`, read live from Account's Language and region. Additive: an older shell leaves it out.
