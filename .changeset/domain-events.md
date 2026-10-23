---
"@augur/events": minor
"@augur/service-kit": minor
"@augur/registry": minor
"@augur/admin": patch
---

Domain events: services tell each other what happened. The events service keeps events on topics (`folio.document.published`), which an app publishes on its own topics with the new `events:publish` scope, and hands them out in one order, never with a gap, to services with `events:subscribe`. It publishes the platform's own (`platform.person.disabled`, `platform.team.member-added`, `platform.app.turned-off` and more) as identity and the registry record those changes. The service kit adds an outbox (`OUTBOX_TABLE_SQL`, `addToOutbox`, `outboxRelay`) so an event is sent if and only if its change commits, `followEvents` for followers, `publishEvents` and `PLATFORM_TOPICS`. Admin names the two new scopes. Events are kept 30 days. See docs/domain-events.md.
