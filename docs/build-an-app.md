# Build an app

This takes you from nothing to an app running in AUGUR's shell. An app is three things in `apps/<id>/`: a **frontend** the shell mounts, a **service** with the app's own API, and a **manifest** that tells the registry about both. The app reaches the platform only through `@augur/mfe-sdk` (in the browser), `@augur/service-kit` (in its service) and the gateway. It never imports another app, and the platform never imports it.

## 1. Start it

Every app starts from [augur-app-template](https://github.com/harry-burton-dev/augur-app-template), in a repository of its own (ADR 0012). On GitHub, **Use this template** to make `augur-expenses`, clone it next to your AUGUR checkout, and name it:

```sh
export NODE_AUTH_TOKEN=<a token with read:packages>   # AUGUR's packages come from GitHub Packages
pnpm make-app expenses --name "Expenses"
pnpm install && pnpm test
```

The id is the app's route (`/expenses`) and its prefix behind the gateway (`/api/expenses`): 2 to 40 lowercase letters, digits and dashes. The template's README is the whole path, from here to its first release, in 15 minutes. What it gives you:

| Path | What it is |
| --- | --- |
| `manifest.json` | How the registry lists the app, with `$schema` pointing at AUGUR's published schema |
| `frontend/` | `@apps/expenses-frontend`: a React app on the app kit's starter, `src/entry.tsx` and its test |
| `service/` | `@apps/expenses`: a Fastify service on the service kit's starter, with `/healthz` and `GET /v1/greeting`, and their tests |
| `service/src/api-types.ts` | The wire types, written once, which the service answers with and the frontend reads |
| `run/index.ts` | A stub of its scenarios for the run suite (augur-run, ADR 0050) |
| `.github/workflows/` | CI on every pull request; previews, dev builds and releases ([Ship an app](ship-an-app.md)) |
| `.changeset/first-release.md` | The app's first release, 0.1.0 |

The new app already works: the frontend asks its service who you are and shows the answer, and has a button that sends you a notification.

## 2. Run it

From your AUGUR checkout (after its own `pnpm install`):

```sh
pnpm dev:app ../augur-expenses
```

Open http://localhost:5173/expenses. This is the real shell and the real UI kit, with your frontend loaded from source and your service running beside it on port 8090 (`APP_SERVICE_PORT` changes it). Edit either and it reloads. An app still in this repository's `apps/` runs by its id instead: `pnpm dev:app <id>`.

Nothing else of the platform runs, so the shell stands in for it:

- You are signed in as **Dev Person**, in the Development department, with the role your manifest's `requiredRole` asks for. `DEV_ROLES=admin pnpm dev:app ../augur-expenses` adds roles.
- `DEV_PREVIEWS=all` turns your feature previews on; `DEV_HOST=0.0.0.0` opens it to your other machines on the tailnet ([release-channels.md](release-channels.md#the-live-dev-loop)). The React kits are in the augur-kit repository: work on them in its Storybook.
- Your inbox items show in the stand-in shell's Inbox: put one in from the browser console ([inbox.md](inbox.md#trying-it-with-pnpm-devapp)).
- You're on your own floor (`/@me/expenses`); `/@org/expenses` puts your app on the org's.
- Calls to `/api/expenses/…` go to your service with Dev Person attached, exactly as the gateway sends them, so `callerFromHeaders` works.
- The catalogue is Home and your app. Home (`/@me/home`) shows what your app's `ctx.notify({ needsYou: true })` sends, and your glance card if you have one. `ctx.raise` and `ctx.request` reach your app when it `handles` the intent, and otherwise fail the way they do when no app handles one.
- Notifications from `ctx.notify` appear in the stream. Ones your service sends with `notify` from the service kit don't, because there's no events service.
- Nor do the domain events your service publishes. To try your `refreshOn`, send one from the browser console: `dispatchEvent(new CustomEvent('augur:dev-domain-event', { detail: { topic: 'expenses.claim.approved', payload: { claim: 'c1' } } }))`. It reaches your app on the floor you're on (`workspace` names another).

To try your app with the rest of the platform, use the full local stack (see the [README](../README.md)) and register it as in step 7.

## 3. The frontend

`src/entry.tsx` default-exports what the shell mounts. `defineReactApp` from the app kit makes it: the shell calls `mount(el, ctx)` when someone opens your app and `unmount(el)` before the next one opens, and each part of your app reads `ctx` with `useAppContext()`. React and the kits are served by the shell to every app, so they stay out of your bundle (`isSharedModule` in `vite.config.ts`).

```tsx
import { defineReactApp } from '@augur/app-kit';
import type { MountContext } from '@augur/mfe-sdk';
import manifest from '../../manifest.json';
import { App, places } from './app.js';

export default defineReactApp<MountContext>({ name: manifest.name, App, routes: places });
```

`places` are the app's places on the address bar (`placeRoutes`, `place('/claims/:claim', Claim)`), and `useData` loads what each shows, kept per floor and refreshed by `refreshOn`. Add a `Glance` for a card on Home, a `Picker` to answer requests, and `intents` to open at a place. An app can also default-export `defineMicroFrontend` from the SDK and render into `el` itself.

Everything you need from outside your app comes through `ctx`:

| | |
| --- | --- |
| `ctx.user` | Who is signed in: `id`, `name`, `email`, `departments`, `roles` |
| `ctx.path` | Where in your app they are, below its route: `/reports/q3` for `/expenses/reports/q3` |
| `ctx.getToken()` | A current token to send as `Authorization: Bearer …` to `/api/<id>/…` |
| `ctx.workspace`, `ctx.getWorkspace()` | The floor the person is on: their own (`personal`), a `team` or the `org`, with its `name`, `slug`, `path` from the org down and their `role`. A team also has its `level`, what its level is called ("Department" right below the org, "Team" below that, unless an admin renamed them, SDK 1.9): say it where you'd say "team". The `kind` stays `team` at every level. SDK 1.1 |
| `ctx.fetch(path, init?)` | `fetch` with the token and the floor (`X-Workspace-Id`) added; the gateway refuses a floor the person isn't on, and a call to your app on a floor where it's off for them (a call naming no floor is checked on the organisation's). Only a request to AUGUR's own origin carries them: since SDK 1.11 a URL on another site is fetched without the token or the floor, so fetching a public resource never hands it the person's sign-in. SDK 1.1 |
| `ctx.notify({ title, body?, needsYou?, actions? })` | A notification on the shell's stream. `actions` (SDK 1.2) is up to two `{ label, intent }` buttons on it; pressing one raises the intent through the shell, as `ctx.raise` does |
| `ctx.raise(intent)` | Open whichever app handles an intent, such as `{ type: 'document.open', payload: { id } }` |
| `ctx.request(intent)` | Ask whichever app handles an intent for an answer; it opens over yours. Rejects with `isIntentCancelled(err)` when the person closes it |
| `ctx.intent`, `ctx.reply` | Present when your app was opened to handle an intent, or to answer a request (`reply.respond(result)`) |
| `ctx.bus` | Events within the page. The shell also puts every domain event on your floor from the apps the person has there, and the platform's, on it under its topic: `ctx.bus.on('folio.document.published', …)`, or `useData(…, { refreshOn: [topic] })` in the app kit ([domain-events.md](domain-events.md#in-the-browser)) |

**What your app can reach.** Your app runs in the shell's own window with the signed-in person's session, so it can call anything that person can, admin routes included. That's why only apps the deployment's own team wrote or reviewed are installed this way (ADR 0024). Apps from anyone else will run sandboxed, with a token limited to their own upstreams. Your service still only gets the scopes the registry granted it, and the gateway still applies floor rules on every call.

Build screens from Quill's parts (`@augur/app-kit`, which also carries all of Common; see them in the `augur-kit` repository's Storybook) and AUGUR's tokens (`var(--space-6)`, `var(--ink)`). Don't bundle your own copy of React or the kit: the shell serves one copy to every app, and `vite.config.ts` keeps them out of your bundle (`isSharedModule`). Anything else you import, you bundle. Lit and the Lit kit (`@augur/ui-kit`) went with SDK 2: an app that still imports them doesn't load.

### On the app contract (contract 3)

An app whose manifest says `"contract": 3` (ADR 0075, 0076) runs differently, and the shell runs both today. Its frontend is one ES module, `frontend.entry` inside its bundle, which the shell serves from `/apps/<id>/<version>/` and loads into a web worker of its own: no DOM, no network, no token, nothing of the shell's page. It default-exports `start(ctx)`:

```ts
import { defineApp } from '@augur/mfe-sdk/sdk3';

export default defineApp((ctx) => {
  ctx.frame.set({ title: 'Notes', actions: [{ command: 'note.new' }] });
  ctx.frame.onCommand('note.new', () => ctx.navigate('/new'));
  ctx.frame.screen.render({ type: 'quill-list', props: { label: 'Notes', items: [{ id: 'n1', title: 'First' }], onOpen: (id) => ctx.navigate(`/notes/${id}`) } });
});
```

What it draws is Quill's remote vocabulary by name (`@augur/app-kit/remote`: `quill-list`, `quill-table`, `quill-page-head` and the rest, with the props each takes); the shell draws it with the real kit and drops anything else with a reason on the console. `render` takes a description (`{ type, props, children }`; a function prop `onOpen` hears the `open` event), or build the tree with `document.createElement('quill-list')` in the worker. Send a long list as `items` or `rows`, not as nodes: the shell draws only the rows in view, and stops an app that inserts more than 2,000 nodes in one go, keeps more than 50,000, sends more than 20,000 changes and messages in a second, or stops answering for 10 seconds after it opened, saying why in its pane. Set a handler prop back to `undefined` and the event is no longer heard. The shell draws the pane's heading from `ctx.frame.set`, and its states: opening, slow after 5 seconds, failed after 30 or when the worker throws, each with Try again; the rest of the shell keeps working.

`ctx.fetch(path)` takes a path under `/api/` (your service is `/api/<id>/…`) and refuses an address; the shell makes the call with the person's token, `X-Workspace-Id` and `x-augur-app: <id>`, and hands back a `Response` built from the bytes. The worker never sees the token, and headers it sets for those (and `Forwarded`, `X-Forwarded-*`) are dropped, and a redirect fails the call rather than being followed. `ctx.person` is the person's `id` and `name`; `ctx.workspace` the floor (`id`, `kind`, `name`), and a new floor starts the worker again. The shell owns the address: `ctx.path` is where your app was opened, `ctx.onNavigate` hears each move, and `ctx.navigate(path)` asks for one, below your app's own address (a path that climbs out of it, such as `/../admin`, is ignored). Functions cross to the shell only as an element's event handlers: one inside an intent, a reply or a notice is left out. `ctx.raise`, `ctx.request` and `ctx.notify` are as above. Files cross as bytes and the token never does: `ctx.files.upload(blob, path)` sends a file to your service (`POST`, with its type), `ctx.files.download(path)` gives you a `Blob`, and `ctx.files.download(path, { save: true })` has the shell save it for the person under the name your service gives in `Content-Disposition`. A body past your manifest's `maxUpload` gets the gateway's 413 answer without being sent. `ctx.files.onDrop(handler)` takes files dropped on your pane from the desktop while the handler is there. With `contributes.canvas: true`, `ctx.canvas.open('canvas.js')` puts a canvas in your pane in place of the screen, for the one place you draw your own pixels: `canvas.js` is one classic script (not a module) beside your entry, loaded in a frame with an opaque origin and no token, which may load scripts, styles and images from the shell and can't call anything (no `fetch`, no sockets). It finds `window.augurCanvas`, a `MessagePort` whose other end `open` resolves to, and that is its only way out; `ctx.canvas.close()` takes it away, and it stops with your app. With `contributes.card: true`, Home runs your app in a worker of its own for its card and shows what `start(ctx)` draws into `ctx.frame.card`; the card shows once the app draws it. With `contributes.search: true`, Find asks your service `GET /api/<id>/v1/search?q=` as your app (`x-augur-app`). The shell also draws the frame round your pane from the manifest. Ctrl+Shift+P (⌘⇧P on a Mac, or Alt+Shift+P, ⌥⇧P, which Firefox leaves free) opens the command palette over the `contributes.commands` your app declares; one you haven't given a handler with `ctx.frame.onCommand` yet stays in it, locked, saying your app hasn't loaded it. The SDK can't yet say what is selected, so a command declared `when: "selection"` runs from the radial menu, on the thing it opened on, and stays locked in the palette. Mark a thing with its kind (`thing: { kind: 'note' }` on a `quill-list` item, `{ kind, id }` on a `quill-kind-tile`, or `{ kind, label }` on a `quill-table`, where `label` names the column that says what each row is, and the row's id is the thing's): right-click, the context-menu key or a long press on it opens the radial menu with the `contributes.radial` actions for that kind, and the handler gets `{ thing: { kind, id, label } }`. A place that `fills` shows in the rail what you send with `ctx.frame.under(placeId, [{ label, path }])`, each opening below your app's address; the rail shows the first 50 and then "and n more", which opens the place. Each `contributes.about` section is in the About panel on the right, filled with what you draw into `ctx.frame.about(id)`; one you haven't drawn into says there's nothing there yet. The types are `@augur/mfe-sdk/sdk3`; the platform's contract tests run a reference app on it (`platform/contract/reference-app`).

### The app kit

Apps show more than the shell does, but each thing in them still says little: **show the shape, say one line, open the rest.** The kit's App group in Storybook holds the parts for it, and they keep these rules for you:

- **One line per thing.** A title and one line of meta; a second line only when it changes what you'd do.
- **Marks before words, words before sentences.** A colour never stands alone.
- **Counts until asked.** Show five, then "8 more".
- **Things open; text doesn't link.** A row has at most two actions, as words.
- **Explain on demand.** The reason sits behind the line (`<Note why="…">`), not in a paragraph above the form.
- **Nothing is obtuse.** A control you can't use now stays, dimmed, and says why: give every `Button` and `IconButton` that can be disabled a `reason` ("Only its leads can pass it down."), and list rows, list actions and menu entries a `reason` too. It stays focusable and shows on hover and focus. If it's only waiting for a request, use `busy` instead. `pnpm check:reasons` fails a platform screen that disables a control without one, and the kit warns on localhost.
- **One heading, one primary.**

| Part | For |
| --- | --- |
| `Notice` | One sentence in a page that needs attention, with one action: `tone` needs, warning, refused or info |
| `Note` | A quiet line that explains; `why` keeps the longer reason one press away; `live` for an action's result ("Saved.") |
| `AppFrame` | The page: the app's name and icon, an optional `rail` of `RailLink`s (folds to a strip), the main column, an optional `aside` and an optional `drawer` at the right edge, usually `About` (folds away; says more about what's on screen) |
| `KindTile`, `AddTile` in `Tiles` | One thing you walk into, by its kind's shape and name alone; `AddTile` makes another. Its actions open in a `RadialMenu` on right-click, never on the tile |
| `RadialMenu` | An object's actions in a ring around it |
| `PageHead` | The trail of what it's inside, eyebrow, title, one line of summary, and its `actions`: two show (one primary at most), the rest go in ⋯ |
| `Section` | A labelled part with its count, one quiet `action` and a `why`; shows five children and folds the rest behind "3 more" |
| `Card` in `Cards` | One thing in a grid. Its floor is a dot in the floor's colour with the floor's name (never a coloured edge), `meta` takes up to three facts, `note` is the one line that changes what you'd do. `unavailable` with a `reason` keeps it in the grid, locked, saying why |
| `Tally` | Counts drawn as segments, one per thing. Mark the counts that need attention `loud`; only those, and the total, are said in words |
| `Details` | The properties of the thing that's open. Empty values say "Not known" |
| `Timeline` | History as `{ at, who, what }`, grouped Today, Yesterday, Tue 27 Oct |
| `Path` | Line of sight: steps from the top floor down to here, each opening with `onOpen` |
| `Ref`, `Refs` | Things from other apps (an `EntityRef`, `DocumentRef`, intent, person or team) as chips: the kind's icon, the name, a floor dot when it's kept elsewhere. In `onOpen`, raise the matching intent (`openEntity`, `openDocument`); `onRemove` makes them removable. Give `closedCount` and `closedReason` for the ones the person can't open |
| `DateField` | A day, value YYYY-MM-DD. It shows "Fri 13 Nov · in 15 days", reads "13 nov", "friday", "end of month" or "+2w", and `empty` says what no day means ("Today", "Still holds"). `quick` takes up to four choices. Works in a `Dialog` like a text field |
| `PeoplePicker` | Give it `search` (people and teams by name, through the SDK) and, if some can't be chosen, `check` returning why. `onPick` fires; with `multiple`, chosen ones gather as chips (`onChange`) |
| `Editor` | For writing more than a line. Its value is Markdown with mentions as `[@Name](person:id)` links (`readMentions`). Give `mentionSource` to turn on `@` and `#`. `guide="2 sentences"` counts and never blocks. Show what it writes with `Prose` |

Events are callbacks (`onOpen`, `onAction`), and behaviour comes from React Aria. For an app's own layout, use Tailwind with only AUGUR's tokens (`@import '@augur/app-kit/theme.css'`), as the platform frontends do.

## 4. The service

`service/src/index.ts` starts the service with the service kit's `startAppService`, the one way every app starts: it builds the app, listens on `PORT`, launches its jobs, gives the registry its frontend and puts the app in the catalogue (on contract 2; on the app contract the app runner does both from the release, and a part never registers itself), and stops cleanly on `SIGTERM`. Everything it names (the app's id, its name in messages) comes from `manifest.json`:

```ts
import { readManifest, startAppService } from '@augur/service-kit';
import { buildApp } from './app.ts';

const manifest = readManifest(import.meta.url);
await startAppService({ manifest, buildApp: ({ jobs }) => buildApp({ manifest, jobs }) });
```

`service/src/app.ts` registers `appServer` first. It serves `/healthz` for operators, answers every error as problem details (below), and believes only the caller the gateway signed for your app (`callerAudienceOf(manifest)`: its client `app-<id>` on the app contract, its id on contract 2; see [Signed caller](signed-caller.md)). The app's API goes under `/v1`. `floorCaller(manifest)` gives the caller and the floor they're on, or answers 401 or 400 for you; `signedInCaller(manifest)` only needs someone signed in:

```ts
import Fastify from 'fastify';
import { appServer, floorCaller, serviceFastifyOptions } from '@augur/service-kit';

const app = Fastify(serviceFastifyOptions());
await appServer(app, { manifest });
const onFloor = floorCaller(manifest);

app.get('/v1/claims', async (req) => {
  const caller = onFloor(req); // caller.id, caller.name, caller.roles, caller.workspace
  return claims.on(caller.workspace.id);
});
```

On the app contract, a part's Score file asks for the app's database as an `augur-database` resource and names its outputs in the part's variables, as the template's `score/web.score.yaml` does: `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_SCHEMA`, `DATABASE_CONNECTIONS`, and the password written to a file that `DATABASE_PASSWORD_FILE` points at. The runner fills them in, and `appDatabaseFromEnv(appId)` reads them into a pool whose login already has the app's schema as its search path, and gives nothing under `pnpm dev:app`, where there is no `DATABASE_HOST`.

`auditFor(appId, log)`, `notifyFor(appId, log)` and `peopleFor(appId)` reach the audit log, people's streams and identity's directory as the app, and fall back to the log and stand-ins under `pnpm dev:app`. `startAppService` gives `buildApp` the first two ready made.

From the service kit, `notify` puts a notification on someone's stream (see [Notifications](notifications.md)) and `recordAudit` writes to the platform's audit log (each entry also keeps which service wrote it, from its signed token, so an entry that names someone as the actor still shows it came from your app); see [apps/README](../apps/README.md). A breaking API change goes under `/v2` beside `/v1`, as in [Versioning](versioning.md#http-apis).

Background and scheduled work goes through the service kit's `createJobs`: durable, run once across instances, and recorded in the audit log ([Jobs](jobs.md)). Don't use `setInterval`.

### Errors

Every AUGUR service answers an error as an [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem details body (`application/problem+json`): `type`, `title`, `status`, `detail`, and AUGUR's own `reason` and `whoCanChange`. `reason` is a stable code a client can switch on (`forbidden`, `not_found`, `conflict`, `unavailable`, `bad_request`, `internal`, …). `whoCanChange` says in plain words who can fix it, when someone can, so a screen can say why something can't be done and who to ask. `type` is `about:blank` unless a problem has its own page, so `title` is the status's phrase and the meaning is in `reason`. Each body also carries `error` (the same as `reason`) and `message` (the same as `detail`), which SDK 1.x clients read.

Register the service kit's `problemDetails()` first, before any routes, and throw or send a `Problem`:

```ts
import { Problem, problemDetails, sendProblem, serviceFastifyOptions } from '@augur/service-kit';

const app = Fastify(serviceFastifyOptions());
await app.register(problemDetails());

app.get('/claims/:id', async (req, reply) => {
  const claim = await claims.get(req.params.id);
  if (!claim) throw new Problem(404, 'not_found', 'That claim no longer exists.');
  if (!canSee(caller, claim)) return sendProblem(reply, 403, 'forbidden', 'Only the claim’s team can see it.', { whoCanChange: 'A lead of the claim’s team.' });
  return claim;
});
```

With it, a request that fails its schema is a 400 `bad_request` saying what was wrong; an error whose class ends in `Unavailable` (`PeopleUnavailable`, `ServiceAuthUnavailable`) is a 503 `unavailable` saying which part can't be reached; Fastify's other client errors (a body too large, a media type it doesn't take) keep their status; an unknown route is a 404 `not_found`; and anything else is a 500 `internal`, with the error in the service's log and never in the answer. A handler's `reply.code(403).send({ error, message })` still works: it is answered as a problem with those fields kept.

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

- `id` is 2 to 40 lowercase letters, digits and dashes, and becomes the app's `/api/<id>`, `/apps/<id>/`, schema and bucket, so it can't be one a part of AUGUR answers to: a platform service's (`identity`, `registry`, `events`, `models`, `storage`, `gateway`, `updater`), a platform app's, a deployment service's (`postgres`, `keycloak`…), a path the front door serves (`api`, `sso`, `kit`…), or one starting `augur-` or `pg-`. The registry refuses such a manifest and says what has the id; the list is `RESERVED_APP_IDS` in `@augur/service-kit`.
- `version` is copied from the frontend's `package.json` on release; don't edit it.
- `sdk` is the range of SDK releases the app works with. The shell refuses an app outside it.
- `icon` and menu `icon`s are the kit's icon names (see Storybook's Icons).
- `requiredRole` hides the app from anyone without that role. `handles` lists the intent types it answers. `menu` gives the app its pages in the shell's rail, one per item, and `category` puts it under Platform or Pillars on the app bar, the rest under Apps; `areas` (SDK 1.5) and `"orbit": false` (SDK 1.4) are still accepted and read, but no longer drawn as menus (PDR-020); an app that shows the same on every floor, as Admin does, sets `"sameOnEveryFloor": true` (SDK 1.6), and the shell's floor gauge rests while it's open, saying why; an app that follows the address itself, as one built on the app kit's `placeRoutes` does, sets `"followsAddress": true` and gives `navigated(el, path)` (SDK 1.11), and the shell keeps it mounted on Back, Forward and its own links while it stays open on the same floor, calling `navigated` with the new path (it needs both: the shell's own moves, such as Find, push the address without a popstate) (an intent, a request, another floor or a changed preview still mounts it again); see [platform/frontends](../platform/frontends/README.md#the-app-bar). How the shell draws the app bar follows the [shell principles](https://drive.google.com/drive/folders/1L14-L3PNjl5OVlztzZCu3TjD2D5QLs24).
- `previews` (SDK 1.7) lists features the app is trying before they're everyone's: `[{ "id": "board-view", "name": "Board view", "detail": "Tasks as columns.", "until": "2027-01-31" }]`. Ask `ctx.previewOn('board-view')` and keep working when it's false; admins decide who gets each, and people turn opt-in ones on in the shell's Previews ([release-channels.md](release-channels.md#feature-previews)).
- `scopes` is what the app's service asks to do on the platform: `notifications:send` to notify people from the service (`notify` in the service kit), `audit:write` to add to the audit log (`recordAudit`), `models:use` to ask an AI model through the model gateway (`askModel`, see [Agents and models](agents.md)), `events:publish` and `events:subscribe` to tell other services what happened and hear what they did (see [Domain events](domain-events.md)), `people:read` to ask who someone stands for and find people and teams to share with (see [Sharing](#sharing)). `inbox:write` to put work that waits on someone in their inbox, and close it when it's done (`inboxItem`, see [The Inbox](inbox.md)). Scopes are checked on the floor your service names (`X-Workspace-Id`, which the service kit's calls take as `workspace`); a call that names none is checked on the organisation's floor, as the gateway does. So if your app is off for the organisation and on only for some teams, name the team's floor when you notify or audit for it. An app may always register itself, and may only send for itself. Without the scope, the call is refused with a 403. `ctx.notify` in the frontend needs no scope. A new version that asks for more scopes is still served, but gets the new ones only once an admin allows them in Admin, Apps.
- `category` (SDK 1.11) says what kind of app it is (ADR 0032): `platform`, for using and managing AUGUR, or `pillar`, the foundation of what AUGUR produces. Only apps that the app runner installed from the signed app feed can be either, and the registry's own apps (Home, Admin, the Upgrade Centre) are always platform apps. Any other app may send it and still registers, but it's just an app: the shell and `GET /v1/me/apps` get no kind for it, and Admin, Apps shows the claim and why it isn't used. Leave it out unless your app is one of those. Ask for `"sdk": "^1.11.0"` when you set it, so an older deployment refuses the release with a reason instead of the registry refusing the manifest. A value other than the two is refused when the app registers.
- `floors` is the kinds of floor the app works on: `personal` (someone's own), `team` (any team, at any depth) and `org`. Leave it out for all three. The shell never offers the app on another kind.
- `surfaces` says what the app shows on each kind of floor, for the shell to place: a `page`, a `card` on the floor's page, a `panel`, the floor's `settings` or `admin`, each from a `module` the entry exposes. `role` limits one to members or leads there; `rollup` means it shows the floor and the teams below it that the person is on (identity's `GET /v1/me/workspaces/{id}/rollup`). Each surface's floor must be in `floors`. When several match, the most specific floor wins, then a role condition, then manifest order. The shell places `card`s on Home (SDK 1.2); the other slots are checked and kept, and placed later.

### A glance card on Home

A `card` surface puts a tile on Home on that kind of floor: a quick look at the app's state with one way in, never a whole screen. Home shows up to six, the apps the person opened most recently first. The `module` names a key of `surfaces` on the entry's default export, and the card is mounted with the same `ctx` as the app (at path `/`), so `ctx.fetch`, `ctx.raise` and `ctx.workspace` work as they do in the app:

```tsx
export default defineMicroFrontend({
  mount(el, ctx) { /* the app */ },
  surfaces: {
    './TeamClaims': {
      async mount(el, ctx) {
        const { waiting } = await (await ctx.fetch('/api/expenses/v1/summary')).json();
        const root = createRoot(el);
        roots.set(el, root);
        root.render(
          <>
            <Facts items={[{ value: waiting, label: 'Waiting for you' }]} />
            <Button kind="secondary" onPress={() => ctx.raise({ type: 'expense.open', payload: {} })}>Open claims</Button>
          </>,
        );
      },
      unmount(el) {
        roots.get(el)?.unmount();
        roots.delete(el);
      },
    },
  },
});
```

The tile is about 320 by 200 pixels and has the app's name and icon above the card. A card that's missing or throws shows "couldn't show this right now" in its tile without touching the rest of Home. Keep it fast: Home mounts every card at once.

- `search: true` puts the app's content in the shell's Find; see [Find](#find) below. SDK 1.3.
- `maxUpload` is the largest request, in MB (1 to 2048), the gateway lets through to your service; 10 without it. Bodies stream through the gateway and are never held there, and one past the limit gets 413 before your service sees it. An admin can lower it in Admin, Apps. The manifest the shell gives your frontend has the limit in force, so check a file against it before sending. SDK 1.4.
- `inbox` (SDK 1.12) declares the kinds of work your service puts in people's inboxes: `{ "kinds": [{ "id": "assignment", "label": "Assigned to you", "icon": "compass" }] }`, up to 10, each id once. The Inbox shows the label and icon on each item, and an item of a kind you didn't declare is refused. It goes with `inbox:write` ([The Inbox](inbox.md)).
- `notifications` (SDK 2.0) declares the kinds of notification your service sends: `{ "kinds": [{ "id": "comment", "label": "Comments on your documents", "detail": "When someone comments on one you own" }] }`, up to 10, each id once. Send each notification with its `kind`. Account, Notifications lists them under your app, and each person chooses which kinds reach them out loud and which wait quietly ([Your account](account.md)). A notification of a kind you didn't declare is refused. It goes with `notifications:send`.
- `links` and `bindings` (SDK 2.1) say your app binds its things to entities: `"links": { "entities": true }, "bindings": ["claim"]`. Each type in `bindings` (lowercase, up to 10, never `entity` or `role`) is published on `<app id>.<type>.entity-bound` and `-unbound` ([Binding your things to entities](#binding-your-things-to-entities) below). The registry lists these apps and types for services at `GET /v1/entity-links`, which the service kit's `registryBindingApps` reads, so the entity catalogue follows exactly your binding topics and shows what uses each entity.
- `settings` are what admins can change about your app, in Admin, Apps: up to 10, each a whole number with an `id`, a `label`, an optional `detail` and `unit`, and its `min`, `max` and `default`. Your service reads them as itself with `appSettings({ registryUrl, credentials, app })` from the service kit, which gives each id's value: an admin's, or the default. Ask again each time you use one, since an admin can change it at any time; changes are in the activity log. If a newer version narrows a range past an admin's value, the default is used until an admin sets it again.

  ```json
  "settings": [{ "id": "retentionDays", "label": "Keep deleted documents for", "type": "integer", "unit": "days", "min": 1, "max": 3650, "default": 30 }]
  ```
- `storage` says the app keeps its own database schema (`"database": true`) or files (`"bucket": true`) on the platform; an admin gives it them, and its service reads them with `appStorageFromEnv()`. See [App storage](app-storage.md).

`pnpm check:manifest` checks every app's manifest with the registry's own schema and rules, so it fails on exactly what the real registry would refuse: an unknown or misspelt field, a bad version or range, a route another app has.

### Checking a manifest

The manifest has a published JSON Schema, `contracts/manifest.schema.json`. It is generated from the registry's own schema (`appEntrySchema` in `platform/services/registry/src/manifest.ts`, TypeBox) by `pnpm manifest-schema`, so it has exactly the fields and limits the registry accepts (ADR 0055). Point your manifest's `"$schema"` at it and your editor completes and checks the fields as you type:

```json
{ "$schema": "../../contracts/manifest.schema.json", "id": "expenses", … }
```

The path is relative to the manifest. In an app's own repository, point it at the copy inside `@augur/app-tools`, which every app already builds with, so the schema matches the tools it releases with and needs no checkout of AUGUR:

```json
{ "$schema": "./node_modules/@augur/app-tools/manifest.schema.json", "id": "expenses", … }
```

The registry accepts `$schema` and doesn't use it. A registry from before the schema was published refuses it as an unknown field, so leave it out of an app that may register with a deployment that hasn't upgraded.

To check manifests, build AUGUR, then name them, or name none to check every `apps/<id>/manifest.json`:

```sh
pnpm build
node scripts/check-manifests.mjs path/to/manifest.json
```

Each manifest is checked against the schema first, and each problem names where it is in plain words (`menu[0].items[2].path doesn't have the form it needs`). One that passes then meets the registry's own rules, the ones its `PUT /apps/:id` applies, for what a schema can't say: a semver version and range, surfaces on the app's floors, a route of its own. The check also fails when `contracts/manifest.schema.json`, or its copy in `@augur/app-tools`, is out of step with the registry; `pnpm build && pnpm manifest-schema` writes it again.

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

`document.open` and `document.pick` are the standard document intents (SDK 1.4), with `library.open` beside them. Any app may handle them by listing them in `handles`. An app that shows or needs documents doesn't need to know which app keeps them:

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

`unit.open` (SDK 1.8) opens one place in a floor's library at any level of its shape: a collection, subcollection, series or subseries, or a file. Pass a `UnitRef`, `openUnit(ctx, { kind: 'unit', app: 'folio', id: 'l-7/f-reports', level: 'series', name: 'Reports' })`; the handling app checks it with `isUnitRef`. Artifacts' unit ids are `<library>/<unit>`, or the library's own id for the collection at its top. `UNIT_LEVELS` lists the levels, top down.

An app that handles `document.open` finds a `DocumentRef` in `ctx.intent.payload`. One that handles `document.pick` gets a `DocumentPick` there and answers with `ctx.reply.respond(ref)`; `pickDocument` checks the answer is a `DocumentRef`.

### Entities from other apps

`entity.open`, `entity.pick` and `entity.explain` are the standard entity intents (SDK 1.5): the real things an organisation knows about, such as a ship, a port or a person. An app that keeps entities handles all three. An app that points at things keeps an `EntityRef` and doesn't need to know which app keeps them:

```ts
import { explainEntity, isIntentCancelled, openEntity, pickEntities } from '@augur/mfe-sdk';

// Ask the person for some: always a checked list, of one unless multiple is set.
try {
  const [ship] = await pickEntities(ctx, { purpose: 'Bind to this intent', types: ['vessel'] });
  keep(ship); // { kind: 'entity', id: 'ent_…', type: 'vessel', label?, at? }
} catch (err) {
  if (!isIntentCancelled(err)) throw err;
}

await openEntity(ctx, ship); // its page in Data Atlas
await explainEntity(ctx, ship); // the same, with why it shows from this floor marked
```

`types` takes kinds from the ontology, each with the kinds below it (`vehicle` brings vessels and aircraft). The `label` in a ref is what it was called when kept, so show it, but refresh it from the app that keeps it, which answers for each one as the person sees it from their floor.

When no app the person can open handles `entity.pick`, `pickEntities` rejects with an `IntentError`: keep the control that would use it in sight, disabled, saying so.

An app that shows documents can offer what a passage names with `entity.propose` (`proposeEntity`, SDK 1.5). The app that handles it decides what happens next; nothing should be added to what's known until a person has decided. Quill's `Reader`, through its ref, has `marked()`, which gives the selected words, the block they're in and its text:

```ts
import { proposeEntity } from '@augur/mfe-sdk';

const passage = reader.marked(); // { text, anchor, context } or undefined
if (passage) {
  const receipt = await proposeEntity(ctx, { source: { app: 'folio', id, version, title }, ...passage });
  say(`Sent to ${receipt.queue}.`); // { proposal: 'prp_…', queue: 'Maritime desk’s Triage' }
}
```

### Binding your things to entities

An app that lets people say "this is about HMS X" keeps those links itself, in its own schema, and tells the rest of AUGUR through its outbox, in the same transaction as the link (ADR 0025, ADR 0066, docs/domain-events.md). The topic is `<app>.<type>.entity-bound` when someone links one of your things to an entity and `<app>.<type>.entity-unbound` when they take the link away; the payload is the thing's id under its type, the entity's id, and a role. The service kit writes both:

```ts
import { bindingTopics, outboxBinding } from '@augur/service-kit';

// inside the transaction that saves the link:
await outboxBinding(tx, { app: 'expenses', type: 'claim', id: claim.id, entity: ship.id, role: 'about' }, 'bound', floorId);
// → expenses.claim.entity-bound { claim: 'c-41', entity: 'ent_…', role: 'about' }
```

Ask for `events:publish`; `bindingTopics('expenses', 'claim')` names the two topics. Send ids only: a thing another app needs more ids to open can carry them in `more` (such as a library and a level), never titles. A follower reads any app's binding events with `readBinding(event)`. In the browser, `EntityBinding` (a `Ref` and an `EntityRef`) is how a frontend passes the same link around.

A `Ref` stands for anything an app keeps when no more specific reference fits (`DocumentRef`, `UnitRef`, `EntityRef`). Check one you're given with `isRef`. An app that keeps entities follows the events to answer "what points at this entity", so binding still works while it is off. Declare `"links": { "entities": true }` and your types in `bindings` (SDK 2.1) so it subscribes to just those topics; a follower asks the registry which apps bind what with the service kit's `registryBindingApps({ registryUrl, credentials })`.

### Dates and times, the person's way

`ctx.formats` (SDK 2.0) says how the person wants dates and times written, from Account's Language and region: `language`, the `locale` to write dates in (their date format, else their language), their `timeZone` and their clock as `hourCycle`. It is read live, so it follows a change they make while your app is open. Quill's `writeDate(when, options)` and `useFormats()` use it for you; outside Quill, pass it to `Intl.DateTimeFormat`. Any part left out means the browser's, and an older shell leaves out `formats` entirely. The words AUGUR shows stay English for now (PER-183).

### Reserved: markings and working context

Two parts of the SDK are reserved now so that adding them later won't break apps (ADR 0029). Both are empty today.

- **`marking`** is optional on `Ref`, `DocumentRef`, `UnitRef` and `EntityRef`. It's a `{ scheme, label }` protective marking. Whether a deployment marks its information is still open (PER-149), so nothing sets markings or enforces them. If a ref you're handed has a marking, keep it as you found it when you store or pass that ref on.
- **`ctx.focus`** is the working context someone chose inside a floor, such as "Operation Alpha · Phase 2": a `Ref` to the thing plus a label. The shell doesn't offer working contexts yet, so it's always undefined, and undefined means the whole floor. An app that will narrow what it shows to a working context can say so with `focus: true` in its manifest. Today that changes nothing.

### Work that waits on someone

When someone has to do something (approve, review, take an assignment), put an item in their inbox or their team's with `inboxItem` from the service kit, rather than a `needs` notification that vanishes when read. Declare the kinds you use in the manifest's `inbox.kinds`, follow `platform.inbox.*` to hear when someone declined or handed one on, and close the item from your service when the work is done. See [The Inbox](inbox.md).

### Sharing

An app that lets people share things with each other asks identity two things, as itself, with the `people:read` scope.

- **Who someone stands for.** `identityPrincipals` from `@augur/service-kit` gives a person's principals: `person:<id>`, `team:<id>` for each team they're on, `tree:<id>` for each of those teams and every team above it, and `org`. Keep, with each thing, the principals who may see it (`tree:<finance>` for "Finance and the teams below it"), and a person may see it when the two lists overlap. Answers are kept for 30 seconds, so someone added to a team can see its things within that time.
- **Who to share with.** `identityDirectory` finds people and teams by name for the app's share dialog, and names the ones it has already shared with by id.
- **The share dialog itself** needs no scope: the person choosing is signed in, so the frontend asks as them. Hand `searchPrincipals` from `@augur/mfe-sdk` to Quill's `PeoplePicker`, and name who a thing is already shared with by id with `namePrincipals`:

  ```tsx
  import { namePrincipals, searchPrincipals } from '@augur/mfe-sdk';
  import { PeoplePicker } from '@augur/app-kit';

  <PeoplePicker label="Share with" multiple search={(q) => searchPrincipals(ctx, q)} value={chosen} onChange={setChosen} />;
  ```

  It finds people by name or email and teams by name, the teams a person isn't on as well (as on their map, a team names only itself and where it sits), never people whose sign-in is off. When the directory can't answer it rejects with `DirectoryUnavailable`, whose message the picker shows as it is. Keep a principal as `person:<id>` or `team:<id>`; check the share on your service before you keep it.
- **Who an audience reaches.** `identityAudience` gives the ids of everyone who stands for at least one of some principals, so the app can tell them something was sent to them (`notify` takes at most 500 people a call). A team from the directory carries its `path`, the ids of the teams it sits in and its own, so an app can tell whether one team is inside another.

The platform has a **publisher** role for people who may put things out beyond their own team, to the whole org or to any team. An app checks it in the caller's `roles`; an admin gives it in Admin, People. Identity adds the role to the sign-in service when it starts, so a server set up before it gets it too.

### Records people organise

If your app keeps things people organise, version and publish, keep them this way: levels, a lifecycle on each version, grants that reach down, tags, relationships and publishing up the floors with one owner. [App patterns](https://drive.google.com/drive/folders/1L14-L3PNjl5OVlztzZCu3TjD2D5QLs24) sets out each one and the tables to keep, and `@augur/records` holds the rules.

### Testing without AUGUR

`@augur/mfe-sdk/testing` lets an app's tests run with no shell, gateway or services. It needs [MSW](https://mswjs.io) 2 or 3 as a dev dependency, and is for tests only: never import it from the app itself.

- **`fakeContext(options?)`** is a whole `MountContext`: a person, their own floor (pass `workspace` for a team or the org), a real event bus, and a `ctx.fetch` that adds the token and `X-Workspace-Id` as the shell does and sends relative paths to `http://augur.test` (`TEST_BASE`; change it with `base`). It records what the app did in `ctx.raised`, `ctx.requested` and `ctx.notified`. `ctx.request` answers from `answers`, by intent type (a value, or a function of the intent), and rejects with an `IntentError` for a type with no answer, as the shell does when no app handles it; throw an `IntentCancelled` from an answer to act as if the person closed the picker. `reply: true` mounts the app as a picker: `ctx.reply.responses` and `ctx.reply.cancels` show what it answered. `previews` lists the previews that are on, and `ctx.moveTo(floor)` moves the fake shell to another floor.
- **`contractHandlers(document, { base?, answers? })`** turns an OpenAPI 3.x contract, such as one from `contracts/` or your own service's, into MSW handlers: one per operation, answering with the example documented for its first 2xx response. Load the YAML yourself and pass the parsed document. `base` is where the service sits behind the gateway (`http://augur.test/api/registry`), and the contract's server path (`/v1`) goes after it. `answers` overrides an operation by its `operationId`, or by `METHOD /path` as the contract writes it (`GET /me/apps`), with a JSON body, a `Response`, or a function of the request. An operation with neither an answer nor an example answers 501 with a problem body that names it, and an answer for an operation the contract doesn't have throws.

```ts
import { readFileSync } from 'node:fs';
import { setupServer } from 'msw/node';
import { parse } from 'yaml';
import { contractHandlers, fakeContext } from '@augur/mfe-sdk/testing';
import app from './entry.js';

const registry = parse(readFileSync('contracts/registry.openapi.yaml', 'utf8'));
const server = setupServer(
  ...contractHandlers(registry, { base: 'http://augur.test/api/registry', answers: { 'GET /me/apps': { workspace: 'ws-me', apps: [] } } }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

it('opens a document when one is picked', async () => {
  const ctx = fakeContext({ answers: { 'document.pick': { app: 'folio', id: 'd1', title: 'Brief' } } });
  await app.mount(document.createElement('div'), ctx);
  // … press the app's Pick button, then:
  expect(ctx.raised).toContainEqual(expect.objectContaining({ type: 'document.open' }));
});
```

## 6. Before you open a pull request

```sh
pnpm build
pnpm --filter "@apps/expenses*" test
pnpm check:manifest
pnpm check:boundaries
pnpm check:reasons
pnpm check:versions
pnpm changeset        # say what changed in @apps/expenses and @apps/expenses-frontend
```

CI runs all of these, and fails a pull request without a changeset.

## 7. Putting it on the platform

The registry lists an app once its service registers it, which it does when it starts with `REGISTRY_URL` set and a way to sign in. The gateway sends `/api/<id>/…` to the app's service: where the registry says it is (set by whatever runs the app, or an admin with `PUT /api/registry/v1/apps/<id>/upstream`: on AUGUR's own network only `app-<id>` container names are taken; elsewhere give a full host name; never loopback, link-local or an address on one of the deployment's own networks, which the app runner tells the registry), or, for the ones the server's compose file starts, where `APP_UPSTREAMS` says. `APP_UPSTREAMS` wins when both name an app. It checks the person's sign-in first and passes them on in `x-user-*` headers and in a token it signs for that service (read them with the service kit's `callerFromHeaders`, behind its `signedCallers` hook); it never passes on their own sign-in token. The names `identity`, `registry`, `events` and `gateway` belong to the platform. An app's `route` must be its own: not one another app has, and not inside or around another app's, `/admin` and `/home` included.

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

Each build of a version's frontend is kept in a folder of its own, `/apps/expenses/<version>_<digest>/`, which never changes, so browsers keep it for good. The same files again change nothing (every restart gives them). Different files for the same version are a new build of it, such as a dev build: they take the old build's place, and browsers load them from their new folder. Change the version for anything you release. The manifest's `entry` must be a file under `/apps/expenses/`, such as `/apps/expenses/entry.js`, and keep its other files beside it with relative imports, as Vite's library build does. Otherwise `infra/web.Dockerfile` can build it and copy its `dist` to `/site/apps/expenses` beside Home and Admin, served from the manifest's entry as it is. An admin can turn the app off in Admin without removing it, or choose where it's on: in Admin, Apps, open the app and set each floor to on, off or blocked. On and off carry on to the teams below; blocked means no team below can turn it back on. Everyone's own floor follows the org. The shell asks the registry for the apps on the floor the person is on, and the platform holds the app's service to its scopes only where it's on.

### How the app runner runs your parts

On app contract 3 a deployment's app runner runs each part of your release (one Score file per part, `score/<part>.score.yaml`) as a container of its own, `app-<id>-<part>-<slot>`:

- **Kind.** `augur.dev/part: service` answers on its one `service.ports` entry and `GET /healthz` with `{"version": "<release version>"}`; `worker` runs in the background; `job` runs once per install, to exit 0, before the switch (a migration). A job that fails stops the install with its last log lines, and the old version keeps serving.
- **Time.** `augur.dev/ready-seconds` is how long a service part has to answer on its version, or a job to finish; without it the deployment's `APP_READY_SECONDS` (3 minutes), never more than 10. A `readinessProbe` must name `/healthz` on the part's port.
- **What it gets.** Only what its `resources` give it ([app-storage.md](app-storage.md#what-a-part-asks-for)): no addresses of AUGUR's services, and no `.env`. It reaches AUGUR through `${resources.gateway.url}`, signing in at `${resources.gateway.token_url}` as `${resources.gateway.client_id}` with the secret in its file. Read every secret from a file (`files`); a secret in a variable, the command or the arguments is refused.
- **Limits.** `resources.limits.memory` and `cpu` are applied to the container, within the deployment's ceilings.
- **Hardening.** The image must set a user other than root, as a number (`USER 10001`): a name could be root in the image's own user list. The container's filesystem is read-only except its `augur-scratch` folders and `/tmp`; it gets no added capabilities, no new privileges, no host folders and no published ports.

### Releasing it

[Ship an app](ship-an-app.md) walks the whole loop, from a pull request's preview to servers taking the release by themselves.

You don't release an app by hand. Merging the Version packages PR that moves its version releases it on its own: a signed service image, a signed frontend and the GitHub release `app/<id>@<version>` ([Versioning](versioning.md#app-releases)). A deployment's app runner can install and update it from there, with no new AUGUR release. The app made from augur-app-template already copies its manifest into its build and gives the registry its frontend when it starts, as the release needs.

Before that, every push to a pull request that changes the app makes a preview, which a server with the app installed runs beside it for the app's developers to switch to ([app-previews.md](app-previews.md)). A preview signs in as the app but keeps its data apart, and sees `APP_PREVIEW=pr-<number>` in its settings; the service kit marks its notifications ("Preview #12: …") and audit entries (`preview: 12`) with it.

### Serving the frontend from somewhere else

An `entry` that is a path (`/apps/expenses/entry.js`) is served by the platform and always allowed. The registry resolves the entry the way the browser will and takes it as a path only if it stays on AUGUR's own address, and it refuses backslashes and control characters, which browsers read as slashes or drop (`/\evil.example/x.js` is another site). An `entry` that is a full address (`https://apps.example.org/expenses/entry.js`) is only accepted when an admin has allowed that site in Admin, **Apps**, **Where apps load from**. Otherwise registering fails with a 400 that says so, and `pnpm check:manifest` doesn't catch it, because only the real registry knows which sites are allowed. The site also has to be in the server's `APP_ORIGINS` so the shell's Content Security Policy lets the browser run it, and it has to send CORS headers, since the entry is loaded as a module from another origin. See [Deploy](deploy.md#day-to-day).

Whichever way you serve it, the shell's page doesn't allow inline scripts or `eval`. Bundle your code into files and don't build functions from strings. Inline `style` attributes are fine.
