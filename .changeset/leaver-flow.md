---
"@augur/identity": minor
"@augur/events": minor
"@augur/service-kit": minor
"@augur/admin": minor
---

The leaver flow and signing out everywhere (ADR 0040, part of PER-194). Turning someone's sign-in off now signs them out everywhere at once: every Keycloak session and every offline token an app holds for them. Admin → People gets "They're leaving": their sign-in goes off, they're signed out, and identity records `person.left`, which the events service publishes as `platform.person.left` `{ person, handOverTo? }` so apps hand on what the leaver owns (`PLATFORM_TOPICS.personLeft`). People marks who asked to leave in their account, and the leaver flow closes the request (`GET /admin/leave-requests`, `POST /admin/people/{id}/leave`, identity contract 1.21.0). Guide: docs/people.md.
