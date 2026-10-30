---
"@augur/registry": minor
"@augur/shell": minor
---

Live on the workbench: `pnpm dev:app <id> --live` loads your app's frontend, from source on your machine over the tailnet, into the workbench's real shell, with real sign-in, floors and data, for you alone. Paste the address it prints into Previews, **Live from my machine**. Only an app's developers can, and only on the workbench (`SERVER_RING=dev`), where the front door's Content Security Policy allows `https://*.ts.net`; elsewhere Previews says why (docs/release-channels.md, "Live on the workbench").
