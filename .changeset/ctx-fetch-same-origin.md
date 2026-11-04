---
'@augur/mfe-sdk': minor
'@augur/shell': patch
---

`ctx.fetch` adds the person's token and the floor only to requests for AUGUR's own origin (the gateway); a request to another site goes without them, so an app fetching a public resource never hands it the person's sign-in. The production import map's `react/jsx-dev-runtime` now has a working `jsxDEV` (made from `jsx`), so an app built in development mode renders against a production shell.
