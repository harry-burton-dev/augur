# Build an app

This takes you from nothing to an app running in the platform's shell. An app is three things in `apps/<id>/`: a **frontend** the shell mounts, a **service** with the app's own API, and a **manifest** that tells the registry about both. The app reaches the platform only through `@platform/mfe-sdk` (in the browser), `@platform/service-kit` (in its service) and the gateway. It never imports another app, and the platform never imports it.

## 1. Start it

```sh
pnpm install
pnpm create-app expenses --name "Expenses"
```

The id is the app's folder, its route (`/expenses`) and its prefix behind the gateway (`/api/expenses`): 2 to 40 lowercase letters, digits and dashes. `create-app` writes:

| Path | What it is |
| --- | --- |
| `apps/expenses/manifest.json` | How the registry lists the app |
| `apps/expenses/frontend/` | `@apps/expenses-frontend`: `src/entry.ts` and its test |
| `apps/expenses/service/` | `@apps/expenses`: a Fastify service with `/healthz` and `GET /v1/greeting`, and their tests |
| `.changeset/new-app-expenses.md` | The app's first release, 0.1.0 |

The new app already works: the frontend asks its service who you are and shows the answer, and has a button that sends you a notification.

## 2. Run it

```sh
pnpm dev:app expenses
```

Open http://localhost:5173/expenses. This is the real shell and the real UI kit, with your frontend loaded from source and your service running beside it on port 8090 (`APP_SERVICE_PORT` changes it). Edit either and it reloads.

Nothing else of the platform runs, so the shell stands in for it:

- You are signed in as **Dev Person**, in the Development department, with the role your manifest's `requiredRole` asks for. `DEV_ROLES=admin pnpm dev:app expenses` adds roles.
- You're on your own floor (`/@me/expenses`); `/@org/expenses` puts your app on the org's.
- Calls to `/api/expenses/…` go to your service with Dev Person attached, exactly as the gateway sends them, so `callerFromHeaders` works.
- The catalogue is just your app. `ctx.raise` and `ctx.request` reach your app when it `handles` the intent, and otherwise fail the way they do when no app handles one.
- Notifications from `ctx.notify` appear in the stream. Ones your service sends with `notify` from the service kit don't, because there's no events service.

To try your app with the rest of the platform, use the full local stack (see the [README](../README.md)) and register it as in step 7.

## 3. The frontend

`src/entry.ts` default-exports a micro frontend. The shell calls `mount(el, ctx)` when someone opens your app, and `unmount(el)` before the next one opens. Render into `el` and nowhere else.

```ts
import { defineMicroFrontend, type MountContext } from '@platform/mfe-sdk';
import { html, render } from 'lit';
import '@platform/ui-kit';

export default defineMicroFrontend({
  mount(el: HTMLElement, ctx: MountContext) {
    render(html`<ui-heading heading="Expenses"></ui-heading>`, el);
  },
  unmount(el: HTMLElement) {
    render(html``, el);
  },
});
```

Everything you need from outside your app comes through `ctx`:

| | |
| --- | --- |
| `ctx.user` | Who is signed in: `id`, `name`, `email`, `departments`, `roles` |
| `ctx.path` | Where in your app they are, below its route: `/reports/q3` for `/expenses/reports/q3` |
| `ctx.getToken()` | A current token to send as `Authorization: Bearer …` to `/api/<id>/…` |
| `ctx.workspace`, `ctx.getWorkspace()` | The floor the person is on: their own (`personal`), a `team` or the `org`, with its `name`, `slug`, `path` from the org down and their `role`. SDK 1.1 |
| `ctx.fetch(path, init?)` | `fetch` with the token and the floor (`X-Workspace-Id`) added; the gateway refuses a floor the person isn't on. SDK 1.1 |
| `ctx.notify({ title, body?, needsYou? })` | A notification on the shell's stream |
| `ctx.raise(intent)` | Open whichever app handles an intent, such as `{ type: 'document.open', payload: { id } }` |
| `ctx.request(intent)` | Ask whichever app handles an intent for an answer; it opens over yours. Rejects with `isIntentCancelled(err)` when the person closes it |
| `ctx.intent`, `ctx.reply` | Present when your app was opened to handle an intent, or to answer a request (`reply.respond(result)`) |
| `ctx.bus` | Events within the page |

Build screens from the kit's components (run `pnpm --filter @platform/ui-kit storybook` to see them) and its tokens (`var(--space-6)`, `var(--ink)`). Don't bundle your own copy of the kit or Lit: the shell serves one copy to every app, and `vite.config.ts` keeps `lit`, `lit/*` and `@platform/ui-kit` out of your bundle. Anything else you import, you bundle.

## 4. The service

`service/src/app.ts` serves `/healthz` for operators, and the app's API under `/v1`. The gateway checks the sign-in token and passes on who is calling, so your service never reads tokens:

```ts
import { callerFromHeaders } from '@platform/service-kit';

app.get('/claims', async (req, reply) => {
  const caller = callerFromHeaders(req.headers);
  if (!caller) return reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to see claims.' });
  // caller.id, caller.name, caller.roles, caller.departments
});
```

From the service kit, `notify` puts a notification on someone's stream and `recordAudit` writes to the platform's audit log; see [apps/README](../apps/README.md). A breaking API change goes under `/v2` beside `/v1`, as in [Versioning](versioning.md#http-apis).

A frontend-only app can delete `service/`; it is then registered with `pnpm register-app` (step 7).

## 5. The manifest

```json
{
  "id": "expenses",
  "name": "Expenses",
  "route": "/expenses",
  "entry": "/apps/expenses/entry.js",
  "version": "0.0.0",
  "sdk": "^1.0.0",
  "description": "Claims and approvals",
  "icon": "apps",
  "requiredRole": "finance",
  "handles": ["expense.open"],
  "scopes": ["notifications:send"],
  "menu": [
    { "label": "Claims", "icon": "document", "items": [
      { "label": "Mine", "path": "/mine", "detail": "Drafts and sent" }
    ] }
  ]
}
```

- `version` is copied from the frontend's `package.json` on release; don't edit it.
- `sdk` is the range of SDK releases the app works with. The shell refuses an app outside it.
- `icon` and menu `icon`s are the kit's icon names (see Storybook's Icons).
- `requiredRole` hides the app from anyone without that role. `handles` lists the intent types it answers. `menu` gives the app an Orbit; see [platform/frontends](../platform/frontends/README.md#title-and-orbit).
- `scopes` is what the app's service asks to do on the platform: `notifications:send` to notify people from the service (`notify` in the service kit), `audit:write` to add to the audit log (`recordAudit`). An app may always register itself, and may only send for itself. Without the scope, the call is refused with a 403. `ctx.notify` in the frontend needs no scope.

`pnpm check:manifest` puts every app's manifest to a registry running in memory, so it fails on exactly what the real registry would refuse: an unknown or misspelt field, a bad version or range, a route another app has.

## 6. Before you open a pull request

```sh
pnpm build
pnpm --filter "@apps/expenses*" test
pnpm check:manifest
pnpm check:boundaries
pnpm check:versions
pnpm changeset        # say what changed in @apps/expenses and @apps/expenses-frontend
```

CI runs all of these, and fails a pull request without a changeset.

## 7. Putting it on the platform

The registry lists an app once its service registers it, which it does when it starts with `REGISTRY_URL` set and a way to sign in. The gateway sends `/api/<id>/…` to the services in `APP_UPSTREAMS`.

The app's service signs in to the platform as itself. An admin issues its sign-in once, and again whenever the secret may have leaked (the old one stops working):

```sh
# through the gateway, as an admin
curl -X POST https://<platform>/api/identity/v1/admin/apps/expenses/credential -H "authorization: Bearer <admin token>"
# {"clientId":"app-expenses","secret":"…"}
```

Give the service that secret as `SERVICE_CLIENT_SECRET`. It gets 5-minute tokens for its Keycloak client `app-expenses`, and the platform checks each call against the scopes the registry grants it on the floor the call names. An admin can do the same from Admin, Apps: open the app and choose **Issue a new sign-in**. The secret is shown once.

In `infra/docker-compose.yml` (and `infra/deploy/compose.yml` for the server), add the service and its upstream:

```yaml
  expenses:
    <<: *service
    build: { context: .., dockerfile: infra/service.Dockerfile, args: { PACKAGE: "@apps/expenses" } }
    environment:
      PORT: 8090
      <<: *internal
      APP_MANIFEST: /app/manifest.json
    volumes: ["../apps/expenses/manifest.json:/app/manifest.json:ro"]

  gateway:
    environment:
      APP_UPSTREAMS: library=http://library:8083,expenses=http://expenses:8090
```

Then serve the frontend where the manifest's `entry` says. Locally, build it and tell the shell's dev server where it is:

```sh
pnpm --filter @apps/expenses-frontend build
APP_DIST=expenses=$PWD/apps/expenses/frontend/dist pnpm --filter @platform/shell dev
```

On the server, `infra/web.Dockerfile` builds it and copies its `dist` to `/site/apps/expenses` beside Home and Admin. An admin can turn the app off in Admin without removing it.

### Serving the frontend from somewhere else

An `entry` that is a path (`/apps/expenses/entry.js`) is served by the platform and always allowed. An `entry` that is a full address (`https://apps.example.org/expenses/entry.js`) is only accepted when an admin has allowed that site in Admin, **Apps**, **Where apps load from**. Otherwise registering fails with a 400 that says so, and `pnpm check:manifest` doesn't catch it, because only the real registry knows which sites are allowed. The site also has to be in the server's `APP_ORIGINS` so the shell's Content Security Policy lets the browser run it, and it has to send CORS headers, since the entry is loaded as a module from another origin. See [Deploy](deploy.md#day-to-day).

Whichever way you serve it, the shell's page doesn't allow inline scripts or `eval`. Bundle your code into files and don't build functions from strings. Inline `style` attributes are fine.
