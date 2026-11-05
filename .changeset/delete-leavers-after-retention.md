---
"@augur/identity": minor
"@augur/events": minor
"@augur/service-kit": minor
"@augur/admin": minor
---

Leavers' accounts are deleted once the organisation's leaver retention has passed (ADR 0072). Identity checks every five minutes and, in an order it can resume, has Activity remove their personal values, forgets their preferences and teams, and deletes the Keycloak account; then it records `person.deleted`, which followers hear as `platform.person.deleted` (`PLATFORM_TOPICS.personDeleted`). A deployment admin who just entered their password can delete a leaver's account at once (`DELETE /v1/admin/people/{id}`). People shows when a leaver's account goes (contract 1.29.0, migration `lifecycle_005_deletion`).
