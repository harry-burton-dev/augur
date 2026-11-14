# @augur/permissions

## 0.3.0

### Minor Changes

- 3f93b58: AUGUR's services stop cleanly and say when they are ready. The service kit's `serve()` runs each one: `GET /readyz` answers only once its database (and, for permissions, OpenFGA) answers, and on SIGTERM a service stops taking new calls, ends its open event streams, lets the calls in flight finish for up to `SHUTDOWN_GRACE_SECONDS` (20), closes its pools, then sends its telemetry. Compose's healthchecks ask `/readyz`, and Docker waits 30 seconds for a service to stop.

### Patch Changes

- Updated dependencies [3f93b58]
  - @augur/service-kit@0.21.0

## 0.2.0

### Minor Changes

- 2c03d1e: Admin has a Roles place: the roles made in AUGUR for the org and each department, each on a page of its own. An admin makes a role, gives it to people (until a day if they like) or to everyone in a department, says what it gives on a department or the org, and takes any of it back with a reason. The permissions service's role answer now says what a role can give on a floor and on the org.
- 4f3f46a: The permissions service keeps persona sessions (ADR 0086, 0089). Someone who holds an admin persona can act as it after a sign-in from the last 5 minutes, with a reason, for at most an hour as a deployment admin or a working day as an org admin (`PERSONA_DEPLOYMENT_ADMIN_MINUTES`, `PERSONA_ORG_ADMIN_MINUTES`). Starting and ending a session goes in the audit log. The gateway can ask whether a session is live. Nothing acts as a persona yet: the gateway and the shell's "Act as" come next.
- 19b29db: Roles made in AUGUR, and the grants that give them (ADR 0085, spec section 5).

  - Whoever manages a floor, or an org admin acting as one, can make a role for it.
  - They can put people, positions' holders or a floor's members in a role, and a person or a position can be given it until a time.
  - They can give a role's holders lead, member, settler or raiser on a floor they manage, or publisher or audit reader on the org.
  - Every grant is kept in a ledger with who gave it, why and until when. Whoever gave it, or anyone who could give it now, can take it back.
  - When a giver loses the right to give, what they gave is taken back. That is checked after each copy from identity.
  - Everything is recorded in the audit log.
  - Admin's screens for this come next.

### Patch Changes

- Updated dependencies [5243f84]
- Updated dependencies [e5a1e2b]
- Updated dependencies [eb53688]
- Updated dependencies [4442766]
  - @augur/service-kit@0.20.0

## 0.1.0

### Minor Changes

- 5010f17: The permissions service copies identity's floors, the positions on them and who holds each into OpenFGA (ADR 0085, ADR 0089), every `PERMISSIONS_COPY_SECONDS` (30), writing only what changed and never touching what others wrote there. A handover counts within that time. A copy that would take away more than half of what it holds at once is held back and logged. Its health shows how the last copy went. Identity gives platform services the whole picture at `GET /v1/relationships`. The permissions service signs in as itself, with the new `PERMISSIONS_CLIENT_SECRET`.
- caf80db: The permissions service copies from identity as soon as something changes, not only on a timer: it follows `platform.position.*`, `platform.team.*` and `platform.person.*`, so a handover or a new lead counts within a couple of seconds. The whole copy still runs every `PERMISSIONS_COPY_SECONDS`, now 300 by default, to put right anything an event missed. The events service publishes identity's position changes as `platform.position.created`, `.changed`, `.handed-over` and `.retired` (docs/domain-events.md).
- 6553017: Deployments run the permissions service and OpenFGA (ADR 0085). OpenFGA keeps its tables in a `permissions` schema on AUGUR's Postgres, under the permissions service's own login, and AUGUR ships its own OpenFGA image, which brings those tables up to date before it serves. The updater restarts both. Nothing asks the service yet.
- 95926c2: Floors take the knowledge graph's two roles (ADR 0079, amended by 0095): `settler` and `raiser`, each held by a person, a position's holder or a role's assignees, with `can_settle` and `can_raise` refused to someone blocked on the floor. Leading a floor gives neither. Questions Q56 to Q62.
- 27af7a9: Floors are joined by positions, not people (ADR 0089). A persona is now a position: what it is given stays with it when its holder changes, and whoever holds it has it at once. A person is on their own floor directly; team and department floors list positions. Deployment and org admin still go only to the persona itself, behind a persona session.
- 7e6b12b: The permissions service (ADR 0085), not yet run by deployments. It answers "may this subject do this to
  that?" from the relationships OpenFGA holds, at `/access/v1/evaluation` and `/access/v1/evaluations` in the
  shape of the AuthZEN Authorization API, for the gateway and AUGUR's own services only. Its model
  (`model/core.fga`) covers the deployment, the org, floors, personas (ADR 0086) and roles made inside
  AUGUR, and `model/questions.fga.yaml` holds the questions it must answer. A check it can't answer is
  refused with the reason, never allowed. The service kit reserves `permissions` and `openfga` as app ids.
- 12064f5: Shadow mode begins (ADR 0085): the events service asks the permissions service each of its admin and lead checks too, after answering as it always has, and counts and logs where the two disagree (`augur_permissions_shadow_checks_total` and `augur_permissions_shadow_disagreements_total`, docs/observability.md). Its own answer still decides. To make the comparison fair, the permissions service now copies who holds the Keycloak roles `admin`, `deployment-admin` and `publisher` from identity, with each admin as an admin persona, and answers `POST /access/v1/search/resource` (which personas someone holds) and questions about `org:this` and `deployment:this`. Service kit gains `permissionsShadow` and `shadowFromEnv` for the other services to follow.

### Patch Changes

- Updated dependencies [d2ce7c9]
- Updated dependencies [7e6b12b]
- Updated dependencies [12064f5]
- Updated dependencies [cc7aa74]
  - @augur/service-kit@0.19.0
