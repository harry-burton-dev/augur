# The Inbox

The Inbox is one place in the shell for everything that **waits on someone**: an assignment, an approval, a review, a publish or share request, an agent's checkpoint. It is a shell feature like Find, not an app (ADR 0026).

A [notification](notifications.md) tells someone something and can be dismissed. An inbox item has an **owner** (a person or a team), a **state**, and a **reference back to the thing in the app** it is about. It stays until it is dealt with. If nobody has to do anything, send a notification; if someone does, put an item in their inbox. An app can do both, but AUGUR never sends a notification for an item by itself.

## The item

| Field | What it is |
| --- | --- |
| `app`, `key` | The app that made it and its own id for the work. Putting the same key again changes the one item. |
| `kind` | One of the kinds the app declares in its manifest (below), so the words come from the app. |
| `owner` | `{ kind: 'person', id }`, or `{ kind: 'team', id }`: anyone on the team takes it. `role: 'lead'` makes a team item for its leads only. |
| `title`, `detail` | In the app's words: up to 200 and 1000 characters. |
| `subject`, `refs` | What it's about (an SDK `Ref`, `DocumentRef`, `EntityRef` or `UnitRef`), and up to five related things. |
| `open` or `path` | The intent the shell raises when the person opens it (payload at most 1 KB), or where in the app to open. |
| `due` | When it's due. The Inbox shows overdue items first; nothing is sent when they're late. |
| `allow` | `decline` and `handOn` (both allowed unless turned off), `selfComplete` (whether the person may mark it done in the shell; off unless turned on). |
| `from` | The person on whose behalf the app made it, if any. |

States are `open`, `done`, `declined` and `withdrawn` (the app took it back: the work was superseded or cancelled). Handing on keeps the item open with a new owner and a line in its history, so `handed-on` is never set; it stays in the list so ADR 0026's four states exist.

The item is on the floor the app's call names (`X-Workspace-Id`); the app's `inbox:write` grant is checked there.

## From an app's service

Ask for `inbox:write` in the manifest's `scopes` (Admin shows it as "Put work in people's inboxes"), and declare your kinds:

```jsonc
"scopes": ["inbox:write", "events:subscribe"],
"inbox": {
  "kinds": [
    { "id": "assignment", "label": "Assigned to you", "icon": "compass" },
    { "id": "back-brief", "label": "Back-brief to read", "icon": "document" }
  ]
}
```

Each kind has an `id` (lowercase, as your service names it), a `label` of up to 40 characters and an optional kit icon; up to 10. Admin lists the labels under the app's "Inbox work", and says so when the app declares kinds but isn't allowed `inbox:write` yet. The events service refuses an item of a kind your manifest doesn't declare. `InboxItem`, `InboxKind` and `INBOX_TOPICS` are in `@augur/mfe-sdk` (1.12) for frontends that show items.

Then, from the service kit:

```ts
import { inboxItem, updateInboxItem, getInboxItem } from '@augur/service-kit';

await inboxItem({
  eventsUrl: EVENTS_URL, credentials, workspace: floorId, app: 'mandate', key: `intent/${intent.id}`,
  item: {
    kind: 'assignment',
    owner: { kind: 'team', id: floorId },
    title: intent.title,
    subject: { kind: 'ref', app: 'mandate', type: 'intent', id: intent.id, label: intent.title },
    open: { type: 'intent.open', payload: { id: intent.id } },
    due: intent.due,
  },
});

// When the work is done in the app, or the app takes it back:
await updateInboxItem({ eventsUrl: EVENTS_URL, credentials, app: 'mandate', key: `intent/${intent.id}`, change: { state: 'done' } });
```

Calls retry while the events service can't be reached. Because items are kept by key, calling `inboxItem` again after any failure, or on start to reconcile, is safe. A closed item stays closed (`409`) unless you send `reopen: true`. An owner must be someone who can sign in, or a team that isn't archived (`400` otherwise, saying which). `getInboxItem` returns the item with its history, notes included: that's where a decline's reason is read.

The API is `PUT`, `PATCH` and `GET /v1/inbox/items/{app}/{key}` in [contracts/events.openapi.yaml](../contracts/events.openapi.yaml).

### Trying it with `pnpm dev:app`

The stand-in shell keeps an inbox of its own, so you can see your items as people will without the events service. Put one in from the browser console:

```js
dispatchEvent(new CustomEvent('augur:dev-inbox-item', { detail: { title: 'Check claim 42', open: { type: 'claim.open', payload: { id: 42 } } } }))
```

Left out, `app` is your app, `kind` your first declared kind and the owner the stand-in person. Take, give back, decline, hand on and mark done work on it until the page reloads. The contract tests (`platform/contract/tests/inbox.spec.ts`) use it to check that an item shows in the app's words and that Open raises its intent.

## What people do

The Inbox is a function beside Find; its label carries the count ("Inbox 3", "Inbox 99+") of items on the person and untaken items for their teams. It has three tabs: **For you** (overdue first, then newest), **Your teams** and **Done** (the last 30 days). Home lists up to five open items for its floor above the notifications that need you, then "{n} more in your Inbox". In the shell's Inbox people take a team item (it becomes theirs, and the team sees who took it), give it back, decline it (saying why), hand it on to someone else or another team, mark it done where the app lets them, or open it. Opening raises the item's `open` intent or opens the app at its `path`, exactly as a notification's action does: the work happens in the app, and the app's service closes the item.

A team item is for everyone on the team until one of them takes it. Someone who leaves the team, or whose sign-in is turned off, gives back what they took: it is open to the team again, the audit log says why, and the app hears `platform.inbox.released` with `left: true`. Items owned by the person themselves stay theirs until an admin hands them over. Of two people taking it at once, one gets it and the other is told who did. A leads-only item is shown whole to a lead standing on the team; anyone else on the team sees that it's there and that it's for the leads, but not what it is.

The person API is under `/api/events/v1/inbox` through the gateway: `GET /inbox?tab=you|teams|done`, `GET /inbox/counts`, `GET /inbox/{id}`, and `POST /inbox/{id}/take|release|decline|hand-on|done`.

## Following what people did

The events service publishes a [domain event](domain-events.md) for each of those steps, with ids only:

| Topic | Payload |
| --- | --- |
| `platform.inbox.taken`, `platform.inbox.released` | `{ item, app, key, by }` |
| `platform.inbox.declined` | `{ item, app, key, by }`: read the note with `getInboxItem` |
| `platform.inbox.handed-on` | `{ item, app, key, by, to }`, `to` being `person:<id>` or `team:<id>` |
| `platform.inbox.done` | `{ item, app, key, by }` |

Follow `platform.inbox.*` with `events:subscribe` and skip other apps' items by `app`. `INBOX_TOPICS` in the service kit names them. Every step, the app's included, is also written to the audit log as `inbox.<action>` on the item's floor, without the note.

## Live in the shell

The shell's notification stream (`/v1/notifications/stream`) also carries events named `inbox`, `{ id, change }` with `change` being `added`, `changed` or `closed`, to everyone who can see the item, before and after the change. The shell reloads its count, and the list if it's showing. Across instances it rides Postgres `LISTEN/NOTIFY` on `events_inbox`.

## How long items are kept

Closed items are kept for 90 days (`INBOX_KEEP_DAYS` in `.env` changes it), then removed with their history by the events service's hourly prune. The audit log keeps every step. The Done tab shows the last 30 days.
