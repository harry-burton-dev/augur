# Apps

Each folder is one product app that runs on the platform. An app owns its service, its database schema, its object storage bucket and its frontend, and ships a `manifest.json` the registry loads.

An app reaches the platform only through `@platform/*` packages, the gateway, the registry manifest and events. It never imports another app, and the platform never imports an app; `pnpm check:boundaries` enforces both.

| App | What it is |
| --- | --- |
| `library/` | The first app (name to be decided): document libraries that users and departments publish for internal distribution, with a readable reader view. |
