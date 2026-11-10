---
'@augur/permissions': minor
'@augur/events': minor
'@augur/identity': minor
'@augur/service-kit': minor
---

Shadow mode begins (ADR 0085): the events service asks the permissions service each of its admin and lead checks too, after answering as it always has, and counts and logs where the two disagree (`augur_permissions_shadow_checks_total` and `augur_permissions_shadow_disagreements_total`, docs/observability.md). Its own answer still decides. To make the comparison fair, the permissions service now copies who holds the Keycloak roles `admin`, `deployment-admin` and `publisher` from identity, with each admin as an admin persona, and answers `POST /access/v1/search/resource` (which personas someone holds) and questions about `org:this` and `deployment:this`. Service kit gains `permissionsShadow` and `shadowFromEnv` for the other services to follow.
