---
'@augur/updater': minor
'@augur/registry': patch
---

Mandate ships with AUGUR, like Artifacts, Explorer and Data Atlas: a `mandate` container with its own sign-in, login and schema (`MANDATE_*` in `.env`). On a server whose app runner installed it, AUGUR's container takes over the same schema, the updater stops the runner's copy, and Admin → Apps stops listing it as an installed app.
