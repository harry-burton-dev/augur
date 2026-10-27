# Build an app

This takes you from nothing to an app running in AUGUR's shell. An app is three things in `apps/<id>/`: a **frontend** the shell mounts, a **service** with the app's own API, and a **manifest** that tells the registry about both. The app reaches the platform only through `@augur/mfe-sdk` (in the browser), `@augur/service-kit` (in its service) and the gateway. It never imports another app, and the platform never imports it.

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
- The catalogue is Home and your app. Home (`/@me/home`) shows what your app's `ctx.notify({ needsYou: true })` sends, and your glance card if you have one. `ctx.raise` and `ctx.request` reach your app when it `handles` the intent, and otherwise fail the way they do when no app handles one.
- Notifications from `ctx.notify` appear in the stream. Ones your service sends with `notify` from the service kit don't, because there's no events service.

To try your app with the rest of the platform, use the full local stack (see the [README](../README.md)) and register it as in step 7.

## 3. The frontend

`src/entry.ts` default-exports a micro frontend. The shell calls `mount(el, ctx)` when someone opens your app, and `unmount(el)` before the next one opens. Render into `el` and nowhere else.

```ts
import { defineMicroFrontend, type MountContext } from '@augur/mfe-sdk';
import { html, render } from 'lit';
import '@augur/ui-kit';

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
| `ctx.notify({ title, body?, needsYou?, actions? })` | A notification on the shell's stream. `actions` (SDK 1.2) is up to two `{ label, intent }` buttons on it; pressing one raises the intent through the shell, as `ctx.raise` does |
| `ctx.raise(intent)` | Open whichever app handles an intent, such as `{ type: 'document.open', payload: { id } }` |
| `ctx.request(intent)` | Ask whichever app handles an intent for an answer; it opens over yours. Rejects with `isIntentCancelled(err)` when the person closes it |
| `ctx.intent`, `ctx.reply` | Present when your app was opened to handle an intent, or to answer a request (`reply.respond(result)`) |
| `ctx.bus` | Events within the page |

Build screens from the kit's components (run `pnpm --filter @augur/ui-kit storybook` to see them) and its tokens (`var(--space-6)`, `var(--ink)`). Don't bundle your own copy of the kit or Lit: the shell serves one copy to every app, and `vite.config.ts` keeps `lit`, `lit/*` and `@augur/ui-kit` out of your bundle. Anything else you import, you bundle.

## 4. The service

`service/src/app.ts` serves `/healthz` for operators, and the app's API under `/v1`. The gateway checks the sign-in token and passes on who is calling, signed for your service alone. The scaffold's `signedCallers` hook checks that signature, so `callerFromHeaders` only ever reads the person the gateway signed (see [Signed caller](signed-caller.md)):

```ts
import { callerCheckFromEnv, callerFromHeaders, signedCallers } from '@augur/service-kit';

app.addHook('onRequest', signedCallers(callerCheckFromEnv('expenses')));

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
  "floors": ["team", "org"],
  "surfaces": [
    { "floor": "team", "slot": "card", "module": "./TeamClaims", "rollup": true },
    { "floor": "org", "slot": "page", "module": "./AllClaims", "role": "lead" }
  ],
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
- `requiredRole` hides the app from anyone without that role. `handles` lists the intent types it answers. `menu` gives the app an Orbit; an app that draws its own menu inside it sets `"orbit": false` (SDK 1.4) to open straight away, with Title still listing its menu; see [platform/frontends](../platform/frontends/README.md#title-and-orbit).
- `scopes` is what the app's service asks to do on the platform: `notifications:send` to notify people from the service (`notify` in the service kit), `audit:write` to add to the audit log (`recordAudit`), `models:use` to ask an AI model through the model gateway (`askModel`, see [Agents and models](agents.md)), `events:publish` and `events:subscribe` to tell other services what happened and hear what they did (see [Domain events](domain-events.md)), `people:read` to ask who someone stands for and find people and teams to share with (see [Sharing](#sharing)). An app may always register itself, and may only send for itself. Without the scope, the call is refused with a 403. `ctx.notify` in the frontend needs no scope. A new version that asks for more scopes is still served, but gets the new ones only once an admin allows them in Admin, Apps.
- `floors` is the kinds of floor the app works on: `personal` (someone's own), `team` (any team, at any depth) and `org`. Leave it out for all three. The shell never offers the app on another kind.
- `surfaces` says what the app shows on each kind of floor, for the shell to place: a `page`, a `card` on the floor's page, a `panel`, the floor's `settings` or `admin`, each from a `module` the entry exposes. `role` limits one to members or leads there; `rollup` means it shows the floor and the teams below it that the person is on (identity's `GET /v1/me/workspaces/{id}/rollup`). Each surface's floor must be in `floors`. When several match, the most specific floor wins, then a role condition, then manifest order. The shell places `card`s on Home (SDK 1.2); the other slots are checked and kept, and placed later.

### A glance card on Home

A `card` surface puts a tile on Home on that kind of floor: a quick look at the app's state with one way in, never a whole screen. Home shows up to six, the apps the person opened most recently first. The `module` names a key of `surfaces` on the entry's default export, and the card is mounted with the same `ctx` as the app (at path `/`), so `ctx.fetch`, `ctx.raise` and `ctx.workspace` work as they do in the app:

```ts
export default defineMicroFrontend({
  mount(el, ctx) { /* the app */ },
  surfaces: {
    './TeamClaims': {
      async mount(el, ctx) {
        const { waiting } = await (await ctx.fetch('/api/expenses/v1/summary')).json();
        render(html`<ui-facts .items=${[{ value: waiting, label: 'Waiting for you' }]}></ui-facts>
          <ui-button kind="secondary" @click=${() => ctx.raise({ type: 'expense.open', payload: {} })}>Open claims</ui-button>`, el);
      },
      unmount(el) { render(html``, el); },
    },
  },
});
```

The tile is about 320 by 200 pixels and has the app's name and icon above the card. A card that's missing or throws shows "couldn't show this right now" in its tile without touching the rest of Home. Keep it fast: Home mounts every card at once.

- `search: true` puts the app's content in the shell's Find; see [Find](#find) below. SDK 1.3.
- `maxUpload` is the largest request, in MB (1 to 2048), the gateway lets through to your service; 10 without it. Bodies stream through the gateway and are never held there, and one past the limit gets 413 before your service sees it. An admin can lower it in Admin, Apps. The manifest the shell gives your frontend has the limit in force, so check a file against it before sending. SDK 1.4.
- `settings` are what admins can change about your app, in Admin, Apps: up to 10, each a whole number with an `id`, a `label`, an optional `detail` and `unit`, and its `min`, `max` and `default`. Your service reads them as itself with `appSettings({ registryUrl, credentials, app })` from the service kit, which gives each id's value: an admin's, or the default. Ask again each time you use one, since an admin can change it at any time; changes are in the activity log. If a newer version narrows a range past an admin's value, the default is used until an admin sets it again.

  ```json
  "settings": [{ "id": "retentionDays", "label": "Keep deleted documents for", "type": "integer", "unit": "days", "min": 1, "max": 3650, "default": 30 }]
  ```
- `storage` says the app keeps its own database schema (`"database": true`) or files (`"bucket": true`) on the platform; an admin gives it them, and its service reads them with `appStorageFromEnv()`. See [App storage](app-storage.md).

`pnpm check:manifest` puts every app's manifest to a registry running in memory, so it fails on exactly what the real registry would refuse: an unknown or misspelt field, a bad version or range, a route another app has.

### Find

With `"search": true` in the manifest, the shell's Find asks your service `GET /v1/search?q=<what they typed>` (through the gateway, so `/api/<id>/v1/search`, with the person and their floor attached) as they type, and lists what you answer under your app's name:

```ts
import type { SearchAnswer } from '@augur/mfe-sdk';

app.get<{ Querystring: { q: string } }>('/v1/search', async (req, reply) => {
  const caller = callerFromHeaders(req.headers);
  if (!caller) return reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to search.' });
  const claims = await store.search(req.query.q, { visibleTo: caller, floor: caller.workspace?.id });
  return { results: claims.map((c) => ({ id: c.id, title: c.title, detail: `Claim · ${c.status}`, path: `/claims/${c.id}` })) } satisfies SearchAnswer;
});
```

- Only answer with what this person can open: the shell shows whatever you send. Check permissions in your service, as for every other call.
- Best first, at most ten (the shell drops the rest). A result opens your app at its `path`; give `workspace` (a floor id) for one that lives on another floor than the one asked from, and the shell lists it after this floor's and goes there when it's chosen.
- Answer within 1.5 seconds. Every app is asked at once and each fills in as it answers, but past that the shell stops waiting and says your app didn't answer in time.

### Documents from other apps

`document.open` and `document.pick` are the standard document intents (SDK 1.4), with `library.open` beside them. Artifacts (`folio`) handles all three out of the box; any app may handle them too by listing them in `handles`. An app that shows or needs documents doesn't need to know which app keeps them:

```ts
import { isIntentCancelled, openDocument, openLibrary, pickDocument } from '@augur/mfe-sdk';

// Open one: whichever app handles document.open opens it.
await openDocument(ctx, { app: 'folio', id: 'd-42', title: 'Travel policy' });

// Ask the person for one: the handling app opens over yours and answers with a DocumentRef.
try {
  const doc = await pickDocument(ctx, { purpose: 'Attach a policy', accept: ['application/pdf'] });
  attach(doc); // { app, id, version?, title }
} catch (err) {
  if (!isIntentCancelled(err)) throw err;
}
```

`library.open` opens a whole library the same way: `openLibrary(ctx, { app: 'folio', id: 'l-7', name: 'Policies' })`, with a `LibraryRef` in the handling app's `ctx.intent.payload` (check it with `isLibraryRef`).

An app that handles `document.open` finds a `DocumentRef` in `ctx.intent.payload`. One that handles `document.pick` gets a `DocumentPick` there and answers with `ctx.reply.respond(ref)`; `pickDocument` checks the answer is a `DocumentRef`.

### Sharing

An app that lets people share things with each other asks identity two things, as itself, with the `people:read` scope.

- **Who someone stands for.** `identityPrincipals` from `@augur/service-kit` gives a person's principals: `person:<id>`, `team:<id>` for each team they're on, `tree:<id>` for each of those teams and every team above it, and `org`. Keep, with each thing, the principals who may see it (`tree:<finance>` for "Finance and the teams below it"), and a person may see it when the two lists overlap. Answers are kept for 30 seconds, so someone added to a team can see its things within that time.
- **Who to share with.** `identityDirectory` finds people and teams by name for the app's share dialog, and names the ones it has already shared with by id.
- **Who an audience reaches.** `identityAudience` gives the ids of everyone who stands for at least one of some principals, so the app can tell them something was sent to them (`notify` takes at most 500 people a call). A team from the directory carries its `path`, the ids of the teams it sits in and its own, so an app can tell whether one team is inside another.

The platform has a **publisher** role for people who may put things out beyond their own team, to the whole org or to any team. An app checks it in the caller's `roles`; an admin gives it in Admin, People. Identity adds the role to the sign-in service when it starts, so a server set up before it gets it too.

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

The registry lists an app once its service registers it, which it does when it starts with `REGISTRY_URL` set and a way to sign in. The gateway sends `/api/<id>/…` to the app's service: where the registry says it is (set by whatever runs the app, or an admin with `PUT /api/registry/v1/apps/<id>/upstream`), or, for the ones the server's compose file starts, where `APP_UPSTREAMS` says. `APP_UPSTREAMS` wins when both name an app. It checks the person's sign-in first and passes them on in `x-user-*` headers and in a token it signs for that service (read them with the service kit's `callerFromHeaders`, behind its `signedCallers` hook); it never passes on their own sign-in token. The names `identity`, `registry`, `events` and `gateway` belong to the platform. An app's `route` must be its own: not one another app has, and not inside or around another app's, `/admin` and `/home` included.

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
      APP_UPSTREAMS: folio=http://folio:8083,expenses=http://expenses:8090
```

Then serve the frontend where the manifest's `entry` says. Locally, build it and tell the shell's dev server where it is:

```sh
pnpm --filter @apps/expenses-frontend build
APP_DIST=expenses=$PWD/apps/expenses/frontend/dist pnpm --filter @augur/shell dev
```

On the server, give the registry each version's frontend before registering that version, and the shell loads it from `/apps/expenses/<version>/` (where the deployment keeps frontends by version; see [Versioning](versioning.md#going-back-to-an-earlier-app-version)). Build the service's image with the frontend in it (`--build-arg FRONTEND=@apps/expenses-frontend` to `infra/service.Dockerfile` puts it at `/app/frontend`), and when the service starts:

```ts
import { publishFrontend, registerApp } from '@augur/service-kit';

// false where the deployment doesn't keep frontends by version; the manifest's entry is used then.
await publishFrontend({ registryUrl, credentials, app: manifest.id, version: manifest.version, dir: '/app/frontend' }).catch(log);
await registerApp({ registryUrl, credentials, manifest });
```

A version's frontend never changes once given: the same files again are fine (every restart gives them), different ones are refused, so change the version. The manifest's `entry` must be a file under `/apps/expenses/`, such as `/apps/expenses/entry.js`, and keep its other files beside it with relative imports, as Vite's library build does. Otherwise `infra/web.Dockerfile` can build it and copy its `dist` to `/site/apps/expenses` beside Home and Admin, served from the manifest's entry as it is. An admin can turn the app off in Admin without removing it, or choose where it's on: in Admin, Apps, open the app and set each floor to on, off or blocked. On and off carry on to the teams below; blocked means no team below can turn it back on. Everyone's own floor follows the org. The shell asks the registry for the apps on the floor the person is on, and the platform holds the app's service to its scopes only where it's on.

### Serving the frontend from somewhere else

An `entry` that is a path (`/apps/expenses/entry.js`) is served by the platform and always allowed. An `entry` that is a full address (`https://apps.example.org/expenses/entry.js`) is only accepted when an admin has allowed that site in Admin, **Apps**, **Where apps load from**. Otherwise registering fails with a 400 that says so, and `pnpm check:manifest` doesn't catch it, because only the real registry knows which sites are allowed. The site also has to be in the server's `APP_ORIGINS` so the shell's Content Security Policy lets the browser run it, and it has to send CORS headers, since the entry is loaded as a module from another origin. See [Deploy](deploy.md#day-to-day).

Whichever way you serve it, the shell's page doesn't allow inline scripts or `eval`. Bundle your code into files and don't build functions from strings. Inline `style` attributes are fine.
