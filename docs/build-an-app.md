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
- `pnpm dev:app expenses --kit` also rebuilds the UI kit and its tokens as you change them and reloads the page; `DEV_PREVIEWS=all` turns your feature previews on; `DEV_HOST=0.0.0.0` opens it to your other machines on the tailnet ([release-channels.md](release-channels.md#the-live-dev-loop)).
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
| `ctx.workspace`, `ctx.getWorkspace()` | The floor the person is on: their own (`personal`), a `team` or the `org`, with its `name`, `slug`, `path` from the org down and their `role`. A team also has its `level`, what its level is called ("Department" right below the org, "Team" below that, unless an admin renamed them, SDK 1.9): say it where you'd say "team". The `kind` stays `team` at every level. SDK 1.1 |
| `ctx.fetch(path, init?)` | `fetch` with the token and the floor (`X-Workspace-Id`) added; the gateway refuses a floor the person isn't on, and a call to your app on a floor where it's off for them (a call naming no floor is checked on the organisation's). Only a request to AUGUR's own origin carries them: since SDK 1.11 a URL on another site is fetched without the token or the floor, so fetching a public resource never hands it the person's sign-in. SDK 1.1 |
| `ctx.notify({ title, body?, needsYou?, actions? })` | A notification on the shell's stream. `actions` (SDK 1.2) is up to two `{ label, intent }` buttons on it; pressing one raises the intent through the shell, as `ctx.raise` does |
| `ctx.raise(intent)` | Open whichever app handles an intent, such as `{ type: 'document.open', payload: { id } }` |
| `ctx.request(intent)` | Ask whichever app handles an intent for an answer; it opens over yours. Rejects with `isIntentCancelled(err)` when the person closes it |
| `ctx.intent`, `ctx.reply` | Present when your app was opened to handle an intent, or to answer a request (`reply.respond(result)`) |
| `ctx.bus` | Events within the page |

**What your app can reach.** Your app runs in the shell's own window with the signed-in person's session, so it can call anything that person can, admin routes included. That's why only apps the deployment's own team wrote or reviewed are installed this way ([ADR 0024](decisions/0024-apps-are-trusted-code.md)). Apps from anyone else will run sandboxed, with a token limited to their own upstreams. Your service still only gets the scopes the registry granted it, and the gateway still applies floor rules on every call.

Build screens from the kit's components (run `pnpm --filter @augur/ui-kit storybook` to see them) and its tokens (`var(--space-6)`, `var(--ink)`). Don't bundle your own copy of the kit or Lit: the shell serves one copy to every app, and `vite.config.ts` keeps `lit`, `lit/*` and `@augur/ui-kit` out of your bundle. Anything else you import, you bundle.

### The app kit

Apps show more than the shell does, but each thing in them still says little: **show the shape, say one line, open the rest.** The kit's App group in Storybook holds the parts for it, and they keep these rules for you:

- **One line per thing.** A title and one line of meta; a second line only when it changes what you'd do.
- **Marks before words, words before sentences.** A colour never stands alone.
- **Counts until asked.** Show five, then "8 more".
- **Things open; text doesn't link.** A row has at most two actions, as words.
- **Explain on demand.** The reason sits behind the line (`ui-note why="…"`), not in a paragraph above the form.
- **Nothing is obtuse.** A control you can't use now stays, dimmed, and says why: give every `ui-button` and `ui-icon-button` that can be disabled a `reason` ("Only its leads can pass it down."), and list rows, list actions and menu entries a `reason` too. It stays focusable and shows on hover and focus. If it's only waiting for a request, use `busy` instead. `pnpm check:reasons` fails a platform screen that disables a control without one, and the kit warns on localhost.
- **One heading, one primary.**

| Part | For |
| --- | --- |
| `ui-notice` | One sentence in a page that needs attention, with one action: `tone` needs, warning, refused or info |
| `ui-note` | A quiet line that explains; `why` keeps the longer reason one press away; `live` for an action's result ("Saved.") |
| `ui-can` | What you can do from here (up to two actions), and who can do the rest |
| `ui-app-frame` | The page: the slate ground, an optional `rail` slot (folds to icons), the main column, an optional `aside` slot and an optional `drawer` slot at the right edge (folds away; says more about what's on screen). `measure` is `wide`, `read` or `full`; set `screen` to the screen's id and the main column and drawer change together |
| `ui-tile` in `ui-tiles` | One thing you walk into, by its icon or picture and name alone. Its actions open in a `ui-radial-menu` on right-click, never on the tile. `add` makes the dashed tile that makes another; `rank` (`high`, `mid`, `low`) says how high it is, which sets its hover |
| `ui-toolbar` | Above a grid: a search (`ui-search`), filters in its slot, and one `add` (`ui-add`) |
| `ui-radial-menu` | An object's actions in a ring around it: `show(target)`, then `ui-select` with the action or `ui-close` |
| `ui-page-head` | The trail of what it's inside, eyebrow, title, one line of summary, and its `.actions`: two show (one primary at most), the rest go in ⋯ |
| `ui-section` | A labelled part with its count, one quiet `action` and a `why`; shows five children and folds the rest behind "3 more" |
| `ui-card` in `ui-cards` | One thing in a grid. Its floor is a dot in the floor's colour with the floor's name (never a coloured edge), `.meta` takes up to three facts, `note` is the one line that changes what you'd do. A `ui-tally` goes in its `tally` slot. `unavailable` with a `reason` keeps it in the grid, locked, saying why |
| `ui-tally` | Counts drawn as segments, one per thing. Mark the counts that need attention `loud`; only those, and the total, are said in words |
| `ui-details` | The properties of the thing that's open. Empty values say "Not known"; `explained` marks the one someone asked about |
| `ui-timeline` | History as `{ at, who, what }`, grouped Today, Yesterday, Tue 27 Oct |
| `ui-path` | Line of sight: steps from the top floor down to `here`, each opening on `ui-open` |
| `ui-ref`, `ui-refs` | Things from other apps (an `EntityRef`, `DocumentRef`, intent, person or team) as chips: the kind's icon, the name, a floor dot when it's kept elsewhere. On `ui-open`, raise the matching intent (`openEntity`, `openDocument`); `removable` fires `ui-remove`. Give `closed-count` and `closed-reason` for the ones the person can't open |
| `ui-date` | A day, value YYYY-MM-DD. It shows "Fri 13 Nov · in 15 days", reads "13 nov", "friday", "end of month" or "+2w", and `empty` says what no day means ("Today", "Still holds"). `.quick` takes up to four choices. Works in `ui-dialog` like a text field |
| `ui-people-picker` | Give it `.search` (people and teams by name, through the SDK) and, if some can't be chosen, `.check` returning why. Fires `ui-pick`; with `multiple`, chosen ones gather as chips in `.value` |
| `ui-editor` | For writing more than a line. Its value is Markdown with mentions as `[@Name](person:id)` links, and `.refs` lists them. Give `.mentionSource` to turn on `@` and `#`. `guide="2 sentences"` counts and never blocks. Show what it writes with `ui-prose` |

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

- `version` is copied from the frontend's `package.json` on release; don't edit it.
- `sdk` is the range of SDK releases the app works with. The shell refuses an app outside it.
- `icon` and menu `icon`s are the kit's icon names (see Storybook's Icons).
- `requiredRole` hides the app from anyone without that role. `handles` lists the intent types it answers. `menu` gives the app an Orbit, and `areas` (SDK 1.5) names the broad parts of the app Title lists under it, each menu group naming its `area`; an app that draws its own menu inside it sets `"orbit": false` (SDK 1.4) to open straight away; an app that shows the same on every floor, as Admin does, sets `"sameOnEveryFloor": true` (SDK 1.6), and the shell's floor gauge rests while it's open, saying why; see [platform/frontends](../platform/frontends/README.md#title-and-orbit). How the shell draws menus follows the [shell principles](shell-principles.md).
- `previews` (SDK 1.7) lists features the app is trying before they're everyone's: `[{ "id": "board-view", "name": "Board view", "detail": "Tasks as columns.", "until": "2027-01-31" }]`. Ask `ctx.previewOn('board-view')` and keep working when it's false; admins decide who gets each, and people turn opt-in ones on in the shell's Previews ([release-channels.md](release-channels.md#feature-previews)).
- `scopes` is what the app's service asks to do on the platform: `notifications:send` to notify people from the service (`notify` in the service kit), `audit:write` to add to the audit log (`recordAudit`), `models:use` to ask an AI model through the model gateway (`askModel`, see [Agents and models](agents.md)), `events:publish` and `events:subscribe` to tell other services what happened and hear what they did (see [Domain events](domain-events.md)), `people:read` to ask who someone stands for and find people and teams to share with (see [Sharing](#sharing)). Scopes are checked on the floor your service names (`X-Workspace-Id`, which the service kit's calls take as `workspace`); a call that names none is checked on the organisation's floor, as the gateway does. So if your app is off for the organisation and on only for some teams, name the team's floor when you notify or audit for it. An app may always register itself, and may only send for itself. Without the scope, the call is refused with a 403. `ctx.notify` in the frontend needs no scope. A new version that asks for more scopes is still served, but gets the new ones only once an admin allows them in Admin, Apps.
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

`unit.open` (SDK 1.8) opens one place in a floor's library at any level of its shape: a collection, subcollection, series or subseries, or a file. Pass a `UnitRef`, `openUnit(ctx, { kind: 'unit', app: 'folio', id: 'l-7/f-reports', level: 'series', name: 'Reports' })`; the handling app checks it with `isUnitRef`. Artifacts' unit ids are `<library>/<unit>`, or the library's own id for the collection at its top. `UNIT_LEVELS` lists the levels, top down.

An app that handles `document.open` finds a `DocumentRef` in `ctx.intent.payload`. One that handles `document.pick` gets a `DocumentPick` there and answers with `ctx.reply.respond(ref)`; `pickDocument` checks the answer is a `DocumentRef`.

### Entities from other apps

`entity.open`, `entity.pick` and `entity.explain` are the standard entity intents (SDK 1.5): the real things an organisation knows about, such as a ship, a port or a person. Data Atlas (`atlas`) handles all three. An app that points at things keeps an `EntityRef` and doesn't need to know which app keeps them:

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

`types` takes kinds from the ontology, each with the kinds below it (`vehicle` brings vessels and aircraft). The `label` in a ref is what it was called when kept, so show it, but refresh it with Data Atlas's `POST /api/atlas/v1/entities/resolve` (`{ refs }`), which answers for each one as the person sees it from their floor: its current ref, or `hidden` with the reason and what to do, or `missing`. Data Atlas tells followers `atlas.entity.created`, `.changed` and `.retired`, ids only.

When no app the person can open handles `entity.pick`, `pickEntities` rejects with an `IntentError`: keep the control that would use it in sight, disabled, saying so.

An app that shows documents can offer what a passage names with `entity.propose` (`proposeEntity`, SDK 1.5). Data Atlas asks the person what kind of thing it is and files it in the floor's Triage, where a lead decides; nothing is added to what's known until then. `ui-reader`'s `marked()` gives the selected words, the block they're in and its text:

```ts
import { proposeEntity } from '@augur/mfe-sdk';

const passage = reader.marked(); // { text, anchor, context } or undefined
if (passage) {
  const receipt = await proposeEntity(ctx, { source: { app: 'folio', id, version, title }, ...passage });
  say(`Sent to ${receipt.queue}.`); // { proposal: 'prp_…', queue: 'Maritime desk’s Triage' }
}
```

### Binding your things to entities

An app that lets people say "this is about HMS X" keeps those links itself, in its own schema, and tells the rest of AUGUR through its outbox (ADR 0025, docs/domain-events.md). Publish `<app>.bound` when someone links one of your things to an entity and `<app>.unbound` when they take the link away. The payload is an `EntityBinding` (SDK 1.10): your thing as a `Ref`, plus the `EntityRef`.

```ts
import type { EntityBinding, Ref } from '@augur/mfe-sdk';

const task: Ref = { kind: 'ref', app: 'intent', type: 'task', id: 't-41', label: 'Brief the desk' };
const binding: EntityBinding = { subject: task, entity: ship };
// in the same transaction as the link: outbox.add('intent.bound', binding)
```

A `Ref` stands for anything an app keeps when no more specific reference fits (`DocumentRef`, `UnitRef`, `EntityRef`). Check one you're given with `isRef`. Data Atlas follows the events to answer "what points at this entity", so binding still works while Atlas is off.

### Reserved: markings and working context

Two parts of the SDK are reserved now so that adding them later won't break apps (ADR 0029). Both are empty today.

- **`marking`** is optional on `Ref`, `DocumentRef`, `UnitRef` and `EntityRef`. It's a `{ scheme, label }` protective marking. Whether a deployment marks its information is still open (PER-149), so nothing sets markings or enforces them. If a ref you're handed has a marking, keep it as you found it when you store or pass that ref on.
- **`ctx.focus`** is the working context someone chose inside a floor, such as "Operation Alpha · Phase 2": a `Ref` to the thing plus a label. The shell doesn't offer working contexts yet, so it's always undefined, and undefined means the whole floor. An app that will narrow what it shows to a working context can say so with `focus: true` in its manifest. Today that changes nothing.

### Sharing

An app that lets people share things with each other asks identity two things, as itself, with the `people:read` scope.

- **Who someone stands for.** `identityPrincipals` from `@augur/service-kit` gives a person's principals: `person:<id>`, `team:<id>` for each team they're on, `tree:<id>` for each of those teams and every team above it, and `org`. Keep, with each thing, the principals who may see it (`tree:<finance>` for "Finance and the teams below it"), and a person may see it when the two lists overlap. Answers are kept for 30 seconds, so someone added to a team can see its things within that time.
- **Who to share with.** `identityDirectory` finds people and teams by name for the app's share dialog, and names the ones it has already shared with by id.
- **Who an audience reaches.** `identityAudience` gives the ids of everyone who stands for at least one of some principals, so the app can tell them something was sent to them (`notify` takes at most 500 people a call). A team from the directory carries its `path`, the ids of the teams it sits in and its own, so an app can tell whether one team is inside another.

The platform has a **publisher** role for people who may put things out beyond their own team, to the whole org or to any team. An app checks it in the caller's `roles`; an admin gives it in Admin, People. Identity adds the role to the sign-in service when it starts, so a server set up before it gets it too.

### Records like Artifacts'

If your app keeps things people organise, version and publish, keep them the way Artifacts does: levels, a lifecycle on each version, grants that reach down, tags, relationships and publishing up the floors with one owner. [App patterns](app-patterns.md) sets out each one and the tables to keep, and `@augur/records` holds the rules.

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

Each build of a version's frontend is kept in a folder of its own, `/apps/expenses/<version>_<digest>/`, which never changes, so browsers keep it for good. The same files again change nothing (every restart gives them). Different files for the same version are a new build of it, such as a dev build: they take the old build's place, and browsers load them from their new folder. Change the version for anything you release. The manifest's `entry` must be a file under `/apps/expenses/`, such as `/apps/expenses/entry.js`, and keep its other files beside it with relative imports, as Vite's library build does. Otherwise `infra/web.Dockerfile` can build it and copy its `dist` to `/site/apps/expenses` beside Home and Admin, served from the manifest's entry as it is. An admin can turn the app off in Admin without removing it, or choose where it's on: in Admin, Apps, open the app and set each floor to on, off or blocked. On and off carry on to the teams below; blocked means no team below can turn it back on. Everyone's own floor follows the org. The shell asks the registry for the apps on the floor the person is on, and the platform holds the app's service to its scopes only where it's on.

### Releasing it

[Ship an app](ship-an-app.md) walks the whole loop, from a pull request's preview to servers taking the release by themselves.

You don't release an app by hand. Merging the Version packages PR that moves its version releases it on its own: a signed service image, a signed frontend and the GitHub release `app/<id>@<version>` ([Versioning](versioning.md#app-releases)). A deployment's app runner can install and update it from there, with no new AUGUR release. The app made by `pnpm create-app` already copies its manifest into its build and gives the registry its frontend when it starts, as the release needs.

Before that, every push to a pull request that changes the app makes a preview, which a server with the app installed runs beside it for the app's developers to switch to ([app-previews.md](app-previews.md)). A preview signs in as the app but keeps its data apart, and sees `APP_PREVIEW=pr-<number>` in its settings; the service kit marks its notifications ("Preview #12: …") and audit entries (`preview: 12`) with it.

### Serving the frontend from somewhere else

An `entry` that is a path (`/apps/expenses/entry.js`) is served by the platform and always allowed. An `entry` that is a full address (`https://apps.example.org/expenses/entry.js`) is only accepted when an admin has allowed that site in Admin, **Apps**, **Where apps load from**. Otherwise registering fails with a 400 that says so, and `pnpm check:manifest` doesn't catch it, because only the real registry knows which sites are allowed. The site also has to be in the server's `APP_ORIGINS` so the shell's Content Security Policy lets the browser run it, and it has to send CORS headers, since the entry is loaded as a module from another origin. See [Deploy](deploy.md#day-to-day).

Whichever way you serve it, the shell's page doesn't allow inline scripts or `eval`. Bundle your code into files and don't build functions from strings. Inline `style` attributes are fine.
