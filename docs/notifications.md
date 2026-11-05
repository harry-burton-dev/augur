# Notifications

A notification tells a person something, in the shell. A [domain event](domain-events.md) tells other services; an [Inbox](inbox.md) item (ADR 0026) waits for someone to act. The contract is [ADR 0044](decisions/0044-notifications-contract.md).

## Floor or global

Name a floor (`workspace` in the service kit, `X-Workspace-Id` on the wire) when what you're telling people about lives on one: a document in Finance. Name none when it's about the deployment or the person: updates, their account. A global notification shows on every floor and opening it doesn't move anyone; a floor notification shows "On Finance" when you're elsewhere and opening it takes you there.

## Sending

From a service, with `notify` from the service kit:

```ts
await notify({ eventsUrl, credentials, workspace, notification: {
  app: 'folio', recipients: [personId], level: 'needs', title: 'Review the budget paper', link: '/doc/7',
  key: 'review:d7:v3', // optional: each person is told this once, read or not
}});
```

- `level` is `needs` (they have to act), `failed`, `done` or `info`. The shell decides how loud each is; you don't.
- Address it to one of: `recipients` (person ids, up to 500 a call), `toTeam: true` (everyone on the floor's team, once its lead has turned team notices on), or `audience` (principals such as `role:deployment-admin`, worked out by identity as it's sent; **platform services only**).
- Give news you might send again a `key`. Without one, every call tells everyone it names.
- An app needs `notifications:send` on the floor it names. If an admin hasn't allowed it there, the call fails with 403 and only your service's log says so: check Admin, Apps, when a notification doesn't arrive.
- `ctx.notify` in a frontend shows a notification in that browser only, gone on reload. Use it for confirmations; send anything that must last from the service.

## Reading

The shell loads the person's unread list, then follows the stream (`GET /api/events/v1/notifications/stream`) and loads the list again after a reconnect. Opening a notification, or pressing one of its two actions, marks it read. People see only their own, never who else got one.

People choose in the shell's Settings: Away, muted apps, and toasts (off by default). Muting an app quiets its pulses and toasts; its notifications stay in the list.

## Email

A notification that needs someone (`needs`) is also emailed to them (ADR 0044, D7), so they hear of it away from AUGUR. Once a minute the events service's `notice-emails` job (service-kit jobs, one run per tick across instances) takes what is due and asks identity how each person wants their notices (`GET /v1/notice-settings`, which only the events service may call). It reads them at send time, so a choice made after the notification arrived still counts. Then, for each one:

- **Skipped, saying why,** when the person has no confirmed address, turned email off, muted the app, set the notification's kind to Quiet, or read it in AUGUR first. Also when there is no mail relay, so setting one later doesn't send a backlog, and when it is over a day old by the time it could go.
- **Put off** while it is inside their quiet hours, in their time zone (else the organisation's), and sent when they end.
- **Sent** through the organisation's relay with `@augur/service-kit/mail`, from the organisation's sender (Admin, Organisation). The subject is the notification's title and the body its detail. Its link opens the notification in AUGUR (`PLATFORM_URL/?notice=<id>`), on its floor. The words around it are in the person's language, falling back to English (`EMAIL_WORDS` in the events service).
- **Tried again** in 5 minutes when the relay refuses it, and skipped after 5 tries.

Each notification keeps how its email ended (`emailed_at`, or `email_skipped` and why), for anyone looking into one that didn't arrive. The events service needs `PLATFORM_URL` and the `SMTP_*` settings (docs/deploy.md, Email); without a relay it logs that no notice is emailed. Other levels aren't emailed one by one.

## What AUGUR itself tells people

The registry tells people about updates, from the Upgrade Centre's overview, once a minute:

| When | Who | Level |
| --- | --- | --- |
| A new AUGUR or app release that Automatic will install | deployment admins | info |
| A new release that waits for someone | deployment admins | needs |
| An upgrade or install finished | deployment admins and admins | done |
| It failed, or went back by itself after the 10-minute watch | deployment admins and admins | failed |
| The publisher halted the release this server runs | deployment admins | needs |

Opening one goes to that unit's page in the Upgrade Centre. Nothing is offered while a unit is on hold or an upgrade is under way. Only people holding the `deployment-admin` role (Admin, People) hear about new releases.

The API is in [contracts/events.openapi.yaml](../contracts/events.openapi.yaml).
