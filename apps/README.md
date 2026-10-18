# Apps

Each folder is one product app that runs on the platform. An app owns its service, its database schema, its object storage bucket and its frontend, and ships a `manifest.json` describing it.

An app reaches the platform only through `@platform/*` packages, the gateway, the registry manifest and events. It never imports another app, and the platform never imports an app; `pnpm check:boundaries` enforces both.

## Getting into the catalogue

An app's service registers its app when it starts: it reads `manifest.json` and calls `registerApp` from `@platform/service-kit`, which puts it to the registry over the internal network with the environment's service token (`REGISTRY_URL`, `SERVICE_TOKEN`). Registering again with a new version updates the entry. The registry refuses unknown fields, the platform's own app ids and a route another app already has. An admin can also register or remove an app through the gateway.

A manifest carries two versions. `version` is the app's release; don't edit it, because `pnpm version-packages` copies it from the app's frontend package (or its service package when it has no frontend). `sdk` is the range of `@platform/mfe-sdk` releases the app works with, such as `^1.0.0`; the shell won't open an app whose range its SDK doesn't satisfy. See [Versioning](../docs/versioning.md).

An app without a service (frontend only) is registered by `pnpm register-app <manifest.json>`, which does the same with `REGISTRY_URL` and `SERVICE_TOKEN`.

## Asking another app

To get something from another app, such as a document picked from the Library, an app raises an intent through its mount context rather than calling that app. See [platform/frontends](../platform/frontends/README.md#apps-asking-each-other).

## Telling people, and keeping a record

An app's service tells people something with `notify` from `@platform/service-kit`: it reaches each recipient's Shell stream live, and stays there until they open or dismiss it. Anything that needs a record (a document published, access changed) goes in the platform's audit log with `recordAudit`. Both call the events service at `EVENTS_URL` with the service token.

| App | What it is |
| --- | --- |
| `library/` | The first app (name to be decided): document libraries that users and departments publish for internal distribution, with a readable reader view. |
| `sample-board/`, `sample-palette/` | Samples, not product apps. Board asks for a colour with the `colour.pick` intent and Palette answers it; neither knows the other exists. Frontend only, so they are registered with `pnpm register-app`. |
