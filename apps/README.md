# Apps

Each folder is one product app that runs on the platform. An app owns its service, its database schema, its object storage bucket ([App storage](../docs/app-storage.md)) and its frontend, and ships a `manifest.json` describing it.

A new app starts in its own repository, made from [augur-app-template](https://github.com/harry-burton-dev/augur-app-template), and `pnpm dev:app ../augur-<id>` runs it here in a stand-in shell; [Build an app](../docs/build-an-app.md) goes from there to an app in the shell.

An app reaches the platform only through `@augur/*` packages, the gateway, the registry manifest and events. It never imports another app, and the platform never imports an app; `pnpm check:boundaries` enforces both.

## Getting into the catalogue

An app's service registers its app when it starts: it reads `manifest.json` and calls `registerApp` from `@augur/service-kit`, which puts it to the registry over the internal network, signed in as the app itself (`REGISTRY_URL`, and the `SERVICE_CLIENT_SECRET` an admin issues in Admin, Apps). Registering again with a new version updates the entry. The registry refuses unknown fields, the platform's own app ids and a route another app already has. An admin can also register or remove an app through the gateway.

A manifest carries two versions. `version` is the app's release; don't edit it, because `pnpm version-packages` copies it from the app's frontend package (or its service package when it has no frontend). `sdk` is the range of `@augur/mfe-sdk` releases the app works with, such as `^1.0.0`; the shell won't open an app whose range its SDK doesn't satisfy. See [Versioning](../docs/versioning.md).

An app without a service (frontend only) is registered by `pnpm register-app <manifest.json>`, which does the same with `REGISTRY_URL`, `OIDC_TOKEN_URL` and the app's `SERVICE_CLIENT_SECRET`.

## Telling other services

When something happens that other services may care about (a document published), an app's service publishes a domain event on its own topic, and follows the platform's (`platform.team.member-removed`) to keep up. See [Domain events](../docs/domain-events.md).

## Asking another app

To get something from another app, such as a document picked from Folio, an app raises an intent through its mount context rather than calling that app. See [platform/frontends](../platform/frontends/README.md#apps-asking-each-other).

## Telling people, and keeping a record

An app's service tells people something with `notify` from `@augur/service-kit`: it reaches each recipient's Shell stream live, and stays there until they open or dismiss it. Anything that needs a record (a document published, access changed) goes in the platform's audit log with `recordAudit`. Both call the events service at `EVENTS_URL` as the app, which needs the `notifications:send` or `audit:write` scope in its manifest.

A notification can carry up to two `actions`, each a `label` ("Approve", "Open", at most 30 characters) and an `intent` some app `handles`, with a payload of at most 1 KB as JSON (send an id, not the document). Pressing one in the Shell raises that intent in the person's browser exactly as `ctx.raise` would, opening whichever app handles it, and marks the notification read. The app runs no code in the stream, so an action is never more than a way into an app.

```ts
await notify({ eventsUrl, credentials, workspace, notification: {
  app: 'expenses', recipients: [lead], level: 'needs', title: 'Approve Sam’s claim',
  actions: [{ label: 'Approve', intent: { type: 'expense.approve', payload: { id: claim.id } } }, { label: 'Open', intent: { type: 'expense.open', payload: { id: claim.id } } }],
} });
```

The apps that ship with AUGUR live in their own repositories: Artifacts in [augur-folio](https://github.com/harry-burton-dev/augur-folio), Explorer in [augur-auspex](https://github.com/harry-burton-dev/augur-auspex) Data Atlas in [augur-atlas](https://github.com/harry-burton-dev/augur-atlas) and Mandate in [augur-mandate](https://github.com/harry-burton-dev/augur-mandate). AUGUR's releases ship the release of each that `release/shipped-apps.json` pins ([ADR 0049](../docs/decisions/0049-pillar-apps-shipped-from-their-releases.md)).
