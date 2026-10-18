# Apps

Each folder is one product app that runs on the platform. An app owns its service, its database schema, its object storage bucket and its frontend, and ships a `manifest.json` describing it.

An app reaches the platform only through `@platform/*` packages, the gateway, the registry manifest and events. It never imports another app, and the platform never imports an app; `pnpm check:boundaries` enforces both.

## Getting into the catalogue

An app's service registers its app when it starts: it reads `manifest.json` and calls `registerApp` from `@platform/service-kit`, which puts it to the registry over the internal network with the environment's registration token (`REGISTRY_URL`, `REGISTRATION_TOKEN`). Registering again with a new version updates the entry. The registry refuses unknown fields, the platform's own app ids and a route another app already has. An admin can also register or remove an app through the gateway.

| App | What it is |
| --- | --- |
| `library/` | The first app (name to be decided): document libraries that users and departments publish for internal distribution, with a readable reader view. |
