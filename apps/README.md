# Apps

Each folder is one product app that runs on the platform. An app owns its service, its database schema, its object storage bucket ([App storage](../docs/app-storage.md)) and its frontend, and ships a `manifest.json` describing it.

Start a new one with `pnpm create-app <id>` and run it with `pnpm dev:app <id>`; [Build an app](../docs/build-an-app.md) goes from there to an app in the shell.

An app reaches the platform only through `@augur/*` packages, the gateway, the registry manifest and events. It never imports another app, and the platform never imports an app; `pnpm check:boundaries` enforces both.

## Getting into the catalogue

An app's service registers its app when it starts: it reads `manifest.json` and calls `registerApp` from `@augur/service-kit`, which puts it to the registry over the internal network, signed in as the app itself (`REGISTRY_URL`, and the `SERVICE_CLIENT_SECRET` an admin issues in Admin, Apps). Registering again with a new version updates the entry. The registry refuses unknown fields, the platform's own app ids and a route another app already has. An admin can also register or remove an app through the gateway.

A manifest carries two versions. `version` is the app's release; don't edit it, because `pnpm version-packages` copies it from the app's frontend package (or its service package when it has no frontend). `sdk` is the range of `@augur/mfe-sdk` releases the app works with, such as `^1.0.0`; the shell won't open an app whose range its SDK doesn't satisfy. See [Versioning](../docs/versioning.md).

An app without a service (frontend only) is registered by `pnpm register-app <manifest.json>`, which does the same with `REGISTRY_URL`, `OIDC_TOKEN_URL` and the app's `SERVICE_CLIENT_SECRET`.

## Asking another app

To get something from another app, such as a document picked from the Library, an app raises an intent through its mount context rather than calling that app. See [platform/frontends](../platform/frontends/README.md#apps-asking-each-other).

## Telling people, and keeping a record

An app's service tells people something with `notify` from `@augur/service-kit`: it reaches each recipient's Shell stream live, and stays there until they open or dismiss it. Anything that needs a record (a document published, access changed) goes in the platform's audit log with `recordAudit`. Both call the events service at `EVENTS_URL` as the app, which needs the `notifications:send` or `audit:write` scope in its manifest.

A notification can carry up to two `actions`, each a `label` ("Approve", "Open", at most 30 characters) and an `intent` some app `handles`, with a payload of at most 1 KB as JSON (send an id, not the document). Pressing one in the Shell raises that intent in the person's browser exactly as `ctx.raise` would, opening whichever app handles it, and marks the notification read. The app runs no code in the stream, so an action is never more than a way into an app.

```ts
await notify({ eventsUrl, credentials, workspace, notification: {
  app: 'expenses', recipients: [lead], level: 'needs', title: 'Approve Sam’s claim',
  actions: [{ label: 'Approve', intent: { type: 'expense.approve', payload: { id: claim.id } } }, { label: 'Open', intent: { type: 'expense.open', payload: { id: claim.id } } }],
} });
```

| App | What it is |
| --- | --- |
| `library/` | The first app (name to be decided): document libraries that users and departments publish for internal distribution, with a readable reader view. |
