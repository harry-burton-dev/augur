---
'@augur/mfe-sdk': patch
---

The entity intents' documentation no longer says Data Atlas handles them out of the box: no app ships with AUGUR, so they are handled by whichever installed app declares it, the shell says when none does, and an app reads or changes the knowledge graph through `connectKnowledge` in `@augur/clients`.
