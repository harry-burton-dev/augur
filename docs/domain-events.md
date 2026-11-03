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

Each outbox row has its own event id, so if a send is repeated the events service keeps one. Without a database change to go with it, `publishEvents({ eventsUrl, credentials, events })` sends at once.

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

## The platform's topics

The events service publishes these as identity and the registry record the change in the audit log, so the two always agree:

| Topic | Payload | When |
| --- | --- | --- |
| `platform.person.disabled`, `platform.person.enabled` | `{ person }` | An admin turns someone's sign-in off or on |
| `platform.team.created`, `platform.team.renamed` | `{ team, name }` | A team is made or renamed |
| `platform.team.member-added`, `platform.team.member-removed` | `{ team, person }` | Someone joins or leaves a team |
| `platform.app.turned-off`, `platform.app.turned-on`, `platform.app.removed` | `{ app }` | An admin turns an app off or on, everywhere or on one floor (the event's floor), or removes it |
| `platform.app.blocked`, `platform.app.rule-cleared` | `{ app }` | An admin blocks an app on a floor and every floor below it, or clears a floor's rule so it follows the floor above |

`PLATFORM_TOPICS` in the service kit names them. The API is in [contracts/events.openapi.yaml](../contracts/events.openapi.yaml).
