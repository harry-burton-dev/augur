# Domain events

Services tell each other what happened through **domain events**: "folio.document.published", "platform.team.member-added". A notification is for a person ([Notifications](notifications.md)); a domain event is for other services, so they can keep up without calling each other. The events service keeps them and hands them out in one order to whoever follows their topics.

## Topics

A topic is the publisher's id, then what happened, dotted and lowercase: `folio.document.published`. An app publishes only on its own topics (`<its id>.*`); `platform.*` belongs to the platform. Followers ask for exact topics or families: `folio.*`.

An event carries **ids and a little context, never content**: `{ "document": "d7", "version": 3 }`, at most 16 KB. An app reads only the events on floors where it holds `events:subscribe`, and those on no floor (the organisation's); AUGUR's own services read every floor's (ADR 0104). Even so, a follower that needs the document asks its owner's API, which checks who may see it.

## Declaring them

On the app contract, the manifest says which events the app reads and each type it publishes (ADR 0104), under `contributes.events`:

```json
"events": {
  "reads": ["platform.person.deleted", "folio.*"],
  "publishes": [
    { "topic": "notes.note.added", "version": 1, "description": "A note was added.",
      "schema": { "type": "object", "required": ["note"], "properties": { "note": { "type": "string" } } } }
  ]
}
```

Reading needs `events:subscribe` and publishing `events:publish`. Each type is under the app's own id, once per version, with its payload's JSON Schema (an object, at most 16 KB). Within a version a type only gains optional fields; anything else is a new version, declared beside the old one, and a release may stop declaring an old version once it no longer publishes it. The registry refuses a release that breaks these rules, before it installs, and AUGUR's services read what an app declares from the registry (`GET /v1/apps/<id>/events`). Leaving out `reads` says nothing about what the app reads; `"reads": []` says it reads nothing.

The events service holds an app that declares them to what it says. One that says what it `reads` is given only those topics and AUGUR's own (`platform.*`), pulled or pushed, and asking only for others answers 403 with what it does read. One that declares what it `publishes` can publish only those types: each event names its `version`, or, without one (as for every event sent through the outbox), goes at the newest declared version its payload fits; its payload must fit that version's schema, or the call answers 400 and the outbox sets the row aside. Followers see each event's `version`. An app on contract 2 that declares nothing is held only to its scopes and floors, as before. An app on contract 3 must declare both: for this release one that leaves out `reads`, or declares no types it `publishes`, is still served, and each publish or read answers with a `warning` saying so (the kit's clients don't surface it yet), and the events service logs it at most once every 10 minutes for each app and side, pushed deliveries included. From the next release it is refused.

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

Each outbox row has its own event id, so if a send is repeated the events service keeps one. A row the events service refuses for what it is (400 or 413) is set aside: left in the table marked sent, with `refused_at` and `refused_why` so it can be told from one delivered, and reported through `onError`, so pass one. The rows behind it carry on. A refusal can be for the moment, such as an app blocked on a floor for a few minutes: to send such rows again, `update outbox set sent_at = null, refused_at = null, refused_why = null where refused_at is not null`. An outbox made before these columns gets them the first time a row is set aside. Without a database change to go with it, `publishEvents({ eventsUrl, credentials, events })` sends at once.

## Following

Add `events:subscribe` to `scopes`. Keep your place (the last `seq` you handled, or `next` from the read, which `followEvents` saves for you so a rare topic doesn't read the same stretch each time) in your own database, and handle each event so that doing it twice does no harm: if your handler throws, the same event comes again on the next poll.

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

Events come in the order they were committed, never with a gap: publishers take turns, so nothing gets a `seq` until the one before it has committed, and a follower can't pass a `seq` that is still to appear. They're kept for 30 days (`DOMAIN_EVENTS_KEEP_DAYS` in `.env` changes it). A follower that's been off for longer is told, never left to skip them silently: a read whose `after` is behind what was pruned answers **410** with `after`, how far events were pruned (ADR 0104). It must rebuild what it keeps from events (from its owner's API, as at the start), then read on with that `after`; `followEvents` calls its `onGap(after)` to do that, and without one each read fails saying so. A read with no `after` at all starts afresh from the oldest kept.

### When someone leaves

Every app that keeps anything about people follows two topics, with the `events:subscribe` scope. `followLeavers` does the reading; `EVENT_CURSOR_TABLE_SQL` and `eventCursor` keep your place in a table of your own:

```ts
import { EVENT_CURSOR_TABLE_SQL, eventCursor, followLeavers } from '@augur/service-kit';

await db.query(EVENT_CURSOR_TABLE_SQL); // in your migrations

followLeavers({
  eventsUrl: EVENTS_URL,
  credentials,
  cursor: eventCursor(db),
  left: async ({ person, handOverTo }) => { /* move what they own to handOverTo, or keep it for someone to hand on */ },
  deleted: async ({ person }) => { /* remove their names and details; their id may stay */ },
  onError: (e) => log.error(e),
}).start();
```

As with `followEvents`, a handler that throws gets the same event again, so doing it twice must do no harm. Read one yourself with `readPersonLeft(event)` and `readPersonDeleted(event)`, which answer undefined for any other event. `handOverTo` is left out when nobody was named, or when the person named can't sign in by the time the leaver flow runs.

## Pushed to your part

An app built under the app contract doesn't poll. With `events:subscribe` granted, AUGUR pushes every event your app may see to your inbound part, as `POST /augur/events` through the gateway: the body is the event (`seq`, `topic`, `payload`, `workspace`, `publisher`, `at`), the caller the gateway signed is AUGUR's events service, and `Idempotency-Key` is `events-<seq>`. Answer any 2xx once you have kept the event; AUGUR takes anything else, or no answer in time (the shorter of the events service's own call timeout, `SERVICE_CALL_TIMEOUT_SECONDS`, and the gateway's app-route timeout), as not delivered and tries again. Events come one app at a time, in order of `seq`, and what happens when one doesn't get through depends on why:

| The part… | What waits | Then |
| --- | --- | --- |
| is down: no answer in time, can't be reached, isn't there for AUGUR (401, 403, 404) or asks to wait (408, 429, 502, 503, 504); or a second event fails with a server error (500, say) before any gets through, so the fault isn't one event's | every event for the app, with a second's wait doubling to ten minutes | after a day, the event at the head is set aside and the next gets a day of its own |
| answers anything else but 2xx (answer 400, 409 or 422 for an event you will never take): it can't take this event | that event, and the later events **on its topic**, which wait behind it so a topic keeps its order. Events on other topics go on | it is tried `DOMAIN_EVENTS_DELIVERY_ATTEMPTS` times (5), the first wait `DOMAIN_EVENTS_RETRY_SECONDS` (30) and doubling to ten minutes (about 7½ minutes in all by default), then set aside, and the events behind it on its topic go |

An event set aside is never lost silently: it is kept, with its app, `seq`, id, topic, how often it was tried, what the last try said, and when; it is recorded in the audit log (`delivery.set-aside`); and admins list it with `GET /v1/deliveries/set-aside` (`?app=` for one app's), as long as domain events are kept. `GET /v1/deliveries` counts, for each app, the events being tried again (`retrying`) and those set aside (`setAside`), and its `words` say so. Admin → Apps and Deployment's health page don't flag an app for events set aside yet: one whose part is otherwise taking events still shows as without trouble there, so check the list. An event set aside is behind ones on its topic that came after it, so a part that later wants it must take it out of order: read it with `GET /v1/domain-events`, or have whoever runs the deployment make it due again (`update events.delivery_held set set_aside_at = null, attempts = 0, next_at = null where app = '<id>' and seq = <seq>`). An app that has taken nothing for an hour is shown as stalled, with the reason, in Admin → Apps. Earlier releases held every event behind a failing one for up to a day, then passed it over (`delivery.dropped`); `dropped` still counts those.

```ts
import { callerFromHeaders, IDEMPOTENCY_KEY_HEADER, isServiceCaller, PART_EVENTS_PATH, serviceOfCaller } from '@augur/service-kit';

app.post(PART_EVENTS_PATH, async (req, reply) => {
  const caller = callerFromHeaders(req.headers);
  if (!isServiceCaller(caller) || serviceOfCaller(caller) !== 'events') return reply.code(403).send({ error: 'forbidden', message: 'Only AUGUR delivers events here.' });
  await keep(req.body, req.headers[IDEMPOTENCY_KEY_HEADER]); // the same key may come twice: keep it once
  return reply.code(204).send();
});
```

You don't get your own events, nor events on floors where your app isn't on or lacks `events:subscribe`; an event on no floor counts as the organisation's. An app an admin turns off keeps its place and catches up when turned on again, unless events it hadn't taken were pruned meanwhile: then it gets what is left, and the gap is recorded once in the audit log (`delivery.gap`, with the place it was at and how far events were pruned), so its data can be rebuilt; one whose grant is withdrawn loses its place (recorded as `delivery.forgotten`). A newly granted app starts from the events after the grant, not from the beginning; `GET /v1/domain-events?after=` is still there for catching up on what came before.

## In the browser

People's screens hear domain events too, so what an app shows can refresh when it changes instead of polling. The events service serves `GET /v1/domain-events/stream?topics=…` to signed-in people: server-sent events named `domain-event`, each one a domain event on the topics asked for, **on the floor the person stands on** (`X-Workspace-Id`, which the gateway checks they're on). Events on another floor never reach it, nor do events on no floor except `platform.app.*`, which are about the whole deployment and carry only the app's id. Nothing else is added: the browser hears what services hear, ids and a little context.

The shell follows it once per page, for the floor the person is on and the topics of the apps they have there (`<app id>.*` for each, and `platform.*`), and puts each event on `ctx.bus` under its topic. So an app hears another app's events only when the person has that app here too. In an app, `useData(key, load, { refreshOn: ['folio.document.published'] })` from the app kit reloads when one arrives, or listen yourself with `ctx.bus.on(topic, (event) => …)`; the event is `{ seq, topic, id, publisher, at, workspace, payload }`. A handler that throws, or whose promise rejects, doesn't stop the others or the stream: the shell logs it with the topic once the rest have run. In tests, `fakeContext`'s bus throws it from `emit` instead, so a failing check in a handler fails the test. Under `pnpm dev:app` the stand-in stream carries what you send from the console ([build-an-app.md](build-an-app.md#2-run-it)).

It's a hint, not a record. There's no `after` and no catching up: a screen that was away loads fresh. Across instances it rides Postgres `LISTEN/NOTIFY` (channel `events_domain_event`), like notifications. Every login on the database can listen and send on any channel, apps' included, so these channels carry only an id, the events service reads the row back, and it ignores anything else it hears.

## The platform's topics

The events service publishes these as identity and the registry record the change in the audit log, so the two always agree, and the Inbox's as people act on items:

| Topic | Payload | When |
| --- | --- | --- |
| `platform.person.joined` | `{ person }` | An admin adds someone. Each team they start in follows as `platform.team.member-added` |
| `platform.person.changed` | `{ person, changed }` | An admin changes someone's details. `changed` lists which, of `name`, `email`, `roles` and `teams`, never the values: ask identity for those |
| `platform.person.disabled`, `platform.person.enabled` | `{ person }` | An admin turns someone's sign-in off or on. Turning it off also signs them out everywhere |
| `platform.person.left` | `{ person, handOverTo? }` | An admin runs the leaver flow (ADR 0040): their sign-in is off (a `disabled` comes first if it was on) and they're signed out everywhere. Hand on or archive what they own, to `handOverTo` when it's there; keep it until then otherwise. `handOverTo` is always someone who can sign in as the flow runs |
| `platform.person.deleted` | `{ person }` | A leaver's account is deleted (ADR 0072), after the organisation's leaver retention or when a deployment admin deletes it at once. Activity no longer holds their personal values and identity has forgotten them. Delete or anonymise anything personal you still keep about them; their id is all that's left |
| `platform.team.created`, `platform.team.renamed` | `{ team, name }` | A team is made or renamed |
| `platform.team.member-added`, `platform.team.member-removed` | `{ team, person }` | Someone joins or leaves a team, however an admin did it, on that team's floor |
| `platform.position.created` | `{ position, team }` | An admin adds a position, a job such as Harbour master, to a team (ADR 0089) |
| `platform.position.changed`, `platform.position.retired` | `{ position }` | A position is renamed, made lead or member, or taken away; whoever held one taken away stops holding it |
| `platform.position.handed-over` | `{ position, from?, to? }` | A position changes holder. The next holder has what the position has at once; `from` or `to` is missing when it was or is now vacant |
| `platform.app.added`, `platform.app.updated` | `{ app }` | An app's service registers it for the first time, or registers a new version. On no floor: it is about the whole deployment, and every shell hears it and loads its app list again |
| `platform.app.turned-off`, `platform.app.turned-on`, `platform.app.removed` | `{ app }` | An admin turns an app off or on, everywhere or on one floor (the event's floor), or removes it |
| `platform.app.blocked`, `platform.app.rule-cleared` | `{ app }` | An admin blocks an app on a floor and every floor below it, or clears a floor's rule so it follows the floor above |
| `platform.inbox.taken`, `.released`, `.declined`, `.done` | `{ item, app, key, by }` | Someone takes a team's inbox item, gives it back, declines it or marks it done ([The Inbox](inbox.md)) |
| `platform.inbox.handed-on` | `{ item, app, key, by, to }` | Someone hands an item on; `to` is `person:<id>` or `team:<id>` |

The knowledge graph service publishes its own as each action commits, from its outbox. Each carries ids only, on the floor it happened on; one on a personal floor carries that floor and nothing else. Ask the service for the rest, as the person:

| Topic | Payload | When |
| --- | --- | --- |
| `platform.knowledge.entity.created` | `{ entity, floor }` | An entity is first named, on that floor |
| `platform.knowledge.observation.retained` | `{ observation, floor }` | A claim read in a source is kept |
| `platform.knowledge.ontology.changed` | `{ version }` | An ontology admin adopts a new class or predicate. The ontology is the deployment's, so it is on no floor |

Person events are on no floor, so they reach services, not browsers; team and membership events are on the team's floor, so its screens hear them too. Changes a person makes to their own profile in their account (`PATCH /v1/me/profile`, docs/account.md) aren't sent yet.

An audit entry and the event it stands for are one transaction: both are kept or neither is. `recordAudit` sends an `Idempotency-Key`, one for all of a call's tries, so a retry keeps one entry and one event. Give an entry your own `key` when a later run may say it again, as identity does for `person.left`.

Identity and the registry don't call `recordAudit` themselves: each keeps its entries in its own database first (`audit_outbox`, the service kit's `auditOutbox`) and sends them from there, oldest first, each under its key, one instance at a time. So an admin's change is audited, and its event published, even if the events service was down when it was made or the service restarted before it was sent. The entry is written just after the change, not with it: most of these changes are in Keycloak. A sent entry is deleted. One the events service refuses (400, 404, 409, 410, 413 or 422: an unknown floor, say) is set aside with `refused_at` and `refused_why`, logged, and kept 30 days; to send it again, clear its `sent_at` and `refused_at`. Any other failure (403 for a missing grant, say) holds the entries until it's put right. Deleting a leaver first sends every entry waiting, so none lands after the redaction, and forgets those set aside about them.

`PLATFORM_TOPICS` in the service kit names them. The API is in [contracts/events.openapi.yaml](../contracts/events.openapi.yaml).
