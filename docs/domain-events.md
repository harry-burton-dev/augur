# Domain events

Services tell each other what happened through **domain events**: "folio.document.published", "platform.team.member-added". A notification is for a person ([Notifications](notifications.md)); a domain event is for other services, so they can keep up without calling each other. The events service keeps them and hands them out in one order to whoever follows their topics.

## Topics

A topic is the publisher's id, then what happened, dotted and lowercase: `folio.document.published`. An app publishes only on its own topics (`<its id>.*`); `platform.*` belongs to the platform. Followers ask for exact topics or families: `folio.*`.

An event carries **ids and a little context, never content**: `{ "document": "d7", "version": 3 }`, at most 16 KB. Any service with `events:subscribe` can read any topic, so a follower that needs the document asks its owner's API, which checks who may see it.

## Publishing

Add `events:publish` to the manifest's `scopes` (an admin allows it in Admin, Apps). When an event goes with a change to your database, write it to your **outbox** in the same transaction, so it's sent if and only if the change commits:

```ts
import { addToOutbox, OUTBOX_TABLE_SQL, outboxRelay, appCredentialsFromEnv } from '@augur/service-kit';

await db.query(OUTBOX_TABLE_SQL); // in your migrations: an `outbox` table in your schema

await client.query('begin');
await client.query('update documents set state = $2 where id = $1', [id, 'published']);
await addToOutbox(client, { topic: 'folio.document.published', payload: { document: id }, workspace });
await client.query('commit');

// Once, when the service starts: sends what's waiting, oldest first, every second.
outboxRelay({ pool: db, eventsUrl: EVENTS_URL, credentials: appCredentialsFromEnv('folio')!, onError: (e) => log.error(e) }).start();
```

Each outbox row has its own event id, so if a send is repeated the events service keeps one. A row the events service refuses for what it is (400 or 413) is set aside: marked sent, left in the table, and reported through `onError`, so pass one. The rows behind it carry on. Without a database change to go with it, `publishEvents({ eventsUrl, credentials, events })` sends at once.

### Entity bindings

When people link one of an app's things to an entity in Data Atlas, the app keeps the link and publishes it in one shape, so Atlas reads every app's the same way (ADR 0025, ADR 0066):

| Topic | Payload |
| --- | --- |
| `<app>.<type>.entity-bound`, `<app>.<type>.entity-unbound` | `{ <type>: id, entity, role?, ...more ids }` |

`mandate.intent.entity-bound { intent, entity, role }` and `folio.record.entity-bound { record, library, level, link, entity, role }` are two. `outboxBinding(client, binding, 'bound' | 'unbound', workspace)` in the service kit writes one to the outbox, and `readBinding(event)` reads any app's back, or answers undefined for an event that isn't one.

## Following

Add `events:subscribe` to `scopes`. Keep your place (the last `seq` you handled) in your own database, and handle each event so that doing it twice does no harm: if your handler throws, the same event comes again on the next poll.

```ts
import { followEvents, PLATFORM_TOPICS } from '@augur/service-kit';

followEvents({
  eventsUrl: EVENTS_URL,
  credentials,
  topics: [PLATFORM_TOPICS.memberRemoved, PLATFORM_TOPICS.personDisabled],
  cursor: {
    load: async () => (await db.query('select seq from event_cursor')).rows[0]?.seq,
    save: (seq) => db.query('insert into event_cursor (id, seq) values (1, $1) on conflict (id) do update set seq = $1', [seq]).then(() => {}),
  },
  handle: async (event) => { /* event.topic, event.payload, event.workspace */ },
  onError: (e) => log.error(e),
}).start();
```

Events come in the order they were committed, never with a gap: an event is only handed out once every transaction that started before it has finished. They're kept for 30 days (`DOMAIN_EVENTS_KEEP_DAYS` in `.env` changes it), so a follower that's been off for longer starts from what's left.

## In the browser

People's screens hear domain events too, so what an app shows can refresh when it changes instead of polling. The events service serves `GET /v1/domain-events/stream?topics=…` to signed-in people: server-sent events named `domain-event`, each one a domain event on the topics asked for, **on the floor the person stands on** (`X-Workspace-Id`, which the gateway checks they're on). Events on no floor, or on another floor, never reach it, and nothing else is added: the browser hears what services hear, ids and a little context.

The shell follows it once per page, for the floor the person is on and the topics of the apps they have there (`<app id>.*` for each, and `platform.*`), and puts each event on `ctx.bus` under its topic. So an app hears another app's events only when the person has that app here too. In an app, `useData(key, load, { refreshOn: ['folio.document.published'] })` from the app kit reloads when one arrives, or listen yourself with `ctx.bus.on(topic, (event) => …)`; the event is `{ seq, topic, id, publisher, at, workspace, payload }`. Under `pnpm dev:app` the stand-in stream carries what you send from the console ([build-an-app.md](build-an-app.md#2-run-it)).

It's a hint, not a record. There's no `after` and no catching up: a screen that was away loads fresh. Across instances it rides Postgres `LISTEN/NOTIFY` (channel `events_domain_event`), like notifications.

## The platform's topics

The events service publishes these as identity and the registry record the change in the audit log, so the two always agree, and the Inbox's as people act on items:

| Topic | Payload | When |
| --- | --- | --- |
| `platform.person.joined` | `{ person }` | An admin adds someone. Each team they start in follows as `platform.team.member-added` |
| `platform.person.changed` | `{ person, changed }` | An admin changes someone's details. `changed` lists which, of `name`, `email`, `roles` and `teams`, never the values: ask identity for those |
| `platform.person.disabled`, `platform.person.enabled` | `{ person }` | An admin turns someone's sign-in off or on. Turning it off also signs them out everywhere |
| `platform.person.left` | `{ person, handOverTo? }` | An admin runs the leaver flow (ADR 0040): their sign-in is off (a `disabled` comes first if it was on) and they're signed out everywhere. Hand on or archive what they own, to `handOverTo` when it's there; keep it until then otherwise |
| `platform.person.deleted` | `{ person }` | A leaver's account is deleted (ADR 0072), after the organisation's leaver retention or when a deployment admin deletes it at once. Activity no longer holds their personal values and identity has forgotten them. Delete or anonymise anything personal you still keep about them; their id is all that's left |
| `platform.team.created`, `platform.team.renamed` | `{ team, name }` | A team is made or renamed |
| `platform.team.member-added`, `platform.team.member-removed` | `{ team, person }` | Someone joins or leaves a team, however an admin did it, on that team's floor |
| `platform.app.turned-off`, `platform.app.turned-on`, `platform.app.removed` | `{ app }` | An admin turns an app off or on, everywhere or on one floor (the event's floor), or removes it |
| `platform.app.blocked`, `platform.app.rule-cleared` | `{ app }` | An admin blocks an app on a floor and every floor below it, or clears a floor's rule so it follows the floor above |
| `platform.inbox.taken`, `.released`, `.declined`, `.done` | `{ item, app, key, by }` | Someone takes a team's inbox item, gives it back, declines it or marks it done ([The Inbox](inbox.md)) |
| `platform.inbox.handed-on` | `{ item, app, key, by, to }` | Someone hands an item on; `to` is `person:<id>` or `team:<id>` |

Person events are on no floor, so they reach services, not browsers; team and membership events are on the team's floor, so its screens hear them too. Changes a person makes to their own profile in their account (`PATCH /v1/me/profile`, docs/account.md) and `deleted` (ADR 0040, after the retention period) aren't sent yet.

`PLATFORM_TOPICS` in the service kit names them. The API is in [contracts/events.openapi.yaml](../contracts/events.openapi.yaml).
