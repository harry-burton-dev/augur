# Decisions

The technical decisions AUGUR is built on, one record each. Read the ones that touch your work before you change it. If your change goes against an Accepted record, write a new Proposed record in the same pull request and say so (see [0001](0001-record-decisions.md)).

Product, naming and process decisions live in the AUGUR handbook on Google Drive (`04 Decisions`), and its Decision register lists these records too.

| # | Decision | Status | Date |
| --- | --- | --- | --- |
| [0001](0001-record-decisions.md) | Record decisions as ADRs in the repository | Accepted | 2026-11-01 |
| [0002](0002-platform-and-apps-separation.md) | One platform, apps on top; the platform never imports an app | Accepted | 2026-10-18 |
| [0003](0003-import-maps-not-module-federation.md) | The shell loads apps through a native import map, not Module Federation | Accepted | 2026-10-27 |
| [0004](0004-ui-kit-lit-tokens-lucide.md) | The UI kit is Lit web components, with one tokens file and Lucide icons | Superseded by 0015 | 2026-10-17 |
| [0005](0005-services-fastify-postgres.md) | Services are TypeScript on Fastify, with a Postgres schema each and OpenAPI contracts | Accepted | 2026-10-17 |
| [0006](0006-keycloak-and-identity-service.md) | Keycloak signs people in; the identity service owns people, teams and floors | Accepted | 2026-10-18 |
| [0007](0007-floors.md) | Workspaces are floors: you, nested teams, and one organisation | Accepted | 2026-10-19 |
| [0008](0008-per-app-identity-signed-caller.md) | Apps have their own identity, and services trust only the gateway's signed caller | Accepted | 2026-10-23 |
| [0009](0009-object-storage-garage.md) | Files go in S3-compatible object storage, run with Garage | Accepted | 2026-10-17 |
| [0010](0010-docker-compose-deployments.md) | Deployments run on Docker Compose; no Kubernetes for now | Accepted | 2026-11-01 |
| [0011](0011-trunk-based-main-and-tags.md) | One trunk branch and release tags, instead of environment branches | Accepted | 2026-11-01 |
| [0012](0012-apps-in-own-repositories.md) | Every app lives in its own repository, and pillar apps are default-installed apps | Accepted | 2026-11-01 |
| [0013](0013-versions-and-releases.md) | One AUGUR version for deployments, and GitHub releases only for AUGUR and apps | Accepted | 2026-11-01 |
| [0014](0014-agent-runtime.md) | Agents are apps, run by a durable runs service on DBOS | Accepted in part (jobs engine); agent runtime Proposed | 2026-11-03 |
| [0015](0015-react-kits-tailwind.md) | Frontends are React, with a shell kit and an app kit on one common base, styled with Tailwind | Accepted | 2026-11-01 |
| [0016](0016-storybook-on-chromatic.md) | The kits' Storybook is hosted on Chromatic | Accepted | 2026-11-01 |
| [0017](0017-signed-release-feed.md) | The release feed is signed, expires, and can mark a release halted | Accepted | 2026-11-01 |
| [0018](0018-rollout-gates.md) | Releases reach production through rings, a bake time and a halt switch | Accepted | 2026-11-01 |
| [0019](0019-deployment-reporting.md) | Deployments report what they run, as a signed heartbeat or an exported file | Accepted | 2026-11-01 |
| [0020](0020-upgrade-policy-windows-watch.md) | AUGUR upgrades follow a policy, a maintenance window, a semver pin and a post-upgrade watch | Accepted | 2026-11-01 |
| [0021](0021-feature-flags-openfeature-flagd.md) | Feature flags use OpenFeature with flagd | Accepted, deferred to beta (amended 3 Nov) | 2026-11-01 |
| [0022](0022-upgrade-roles-step-up.md) | Upgrades need a deployment or app admin role and a step-up sign-in | Accepted, partly built | 2026-11-01 |
| [0023](0023-air-gap-bundle-oci-layout.md) | The air-gap bundle is a standard OCI image layout | Accepted | 2026-11-01 |
| [0024](0024-apps-are-trusted-code.md) | Apps in the shell are trusted code until outside apps run sandboxed | Accepted | 2026-11-01 |
| [0025](0025-apps-own-entity-bindings.md) | Apps keep their own links to entities and publish them as events | Accepted | 2026-11-01 |
| [0026](0026-inbox-separate-from-notifications.md) | The Inbox holds work that waits on someone, apart from notifications | Accepted | 2026-11-01 |
| [0027](0027-runs-is-the-jobs-engine.md) | The runs service also runs ordinary background jobs | Accepted | 2026-11-01 |
| [0028](0028-discussion-starts-in-intent.md) | Discussion starts inside Intent behind a ref-keyed API | Accepted | 2026-11-01 |
| [0029](0029-reserve-focus-and-marking.md) | The SDK reserves a working context and a protective marking now | Accepted | 2026-11-01 |
| [0030](0030-upgrade-centre-platform-frontend.md) | The Upgrade Centre is its own platform frontend, released with AUGUR | Accepted | 2026-11-01 |
| [0031](0031-mirror-feeds-are-the-organisations-own.md) | A mirror's feed is the organisation's own, and carries the publisher's halt marks | Accepted | 2026-11-01 |
| [0032](0032-platform-apps-and-pillar-apps.md) | Apps that ship with AUGUR are platform apps or pillar apps | Accepted | 2026-11-03 |
| [0033](0033-renovate-for-dependency-updates.md) | Renovate proposes dependency updates, weekly and grouped, and never merges them | Accepted | 2026-11-01 |
| [0034](0034-opentelemetry-in-the-service-kit.md) | Services send OpenTelemetry through the service kit, off until a collector is named | Accepted | 2026-11-01 |
| [0035](0035-email-through-the-organisations-relay.md) | AUGUR sends email through the organisation's own SMTP relay | Accepted | 2026-11-01 |
| [0036](0036-account-area-in-the-shell.md) | People manage their own account in the shell, through identity, with credentials on Keycloak's screens | Accepted | 2026-11-01 |
| [0037](0037-keycloak-stays-current.md) | Keycloak moves to the current 26.x and stays current | Accepted | 2026-11-01 |
| [0038](0038-two-step-sign-in-and-password-policy.md) | Two-step sign-in is required for admin roles and offered to everyone; passwords follow NIST SP 800-63B | Accepted | 2026-11-01 |
| [0039](0039-profile-in-keycloak-preferences-in-identity.md) | Who you are lives in Keycloak's user profile; how AUGUR behaves for you lives in identity | Accepted | 2026-11-01 |
| [0040](0040-account-lifecycle-and-personal-data.md) | Accounts start with an email invite, end through the leaver flow, and idle accounts turn off on their own | Accepted | 2026-11-01 |
| [0041](0041-keycloakify-sign-in-theme.md) | Sign-in and email pages use a Keycloakify theme in AUGUR's look | Accepted | 2026-11-01 |
| [0042](0042-organisation-settings-in-identity.md) | Organisation settings live in identity and are edited in Admin | Accepted | 2026-11-01 |
| [0043](0043-ci-lint-and-scans.md) | CI lints with ESLint and scans with gitleaks, OSV-Scanner and Trivy | Accepted | 2026-11-01 |
| [0044](0044-notifications-contract.md) | One notifications contract: floor or global, sent by services, kept by events, shown by the shell | Proposed | 2026-11-02 |
| [0045](0045-promote-asks-portal-over-tailscale.md) | Promote to stable asks the portal for bake time over Tailscale | Accepted | 2026-11-02 |
| [0046](0046-ui-kit-in-its-own-repository.md) | The UI kit lives in its own repository, and the shell serves the version it pins | Accepted | 2026-11-02 |
| [0047](0047-app-repositories-in-augurs-feed.md) | Apps in their own repositories release there, and AUGUR's feed lists them | Accepted | 2026-11-02 |
| [0048](0048-kit-served-from-a-kit-url.md) | Apps load the UI kit from a kit URL that the deployment serves | Accepted | 2026-11-03 |
| [0049](0049-pillar-apps-shipped-from-their-releases.md) | AUGUR ships the pinned releases of its pillar apps, made in their own repositories | Accepted | 2026-11-03 |
| [0050](0050-alpha-proving-run.md) | Alpha is proved by a build gate and a 48-hour run on staging | Accepted | 2026-11-03 |
| [0051](0051-install-a-halted-release-on-request.md) | A deployment admin can install a halted release on request, on dev and preview servers only | Accepted | 2026-11-03 |
| [0052](0052-api-reports-publint-and-attw.md) | The SDK's surface is an API Extractor report, and packages are checked by publint and attw | Proposed | 2026-11-03 |
| [0053](0053-squawk-lints-migrations.md) | Squawk lints every new migration, and one runner in the service kit applies them | Accepted | 2026-11-03 |
| [0054](0054-app-frontend-starter-libraries.md) | App frontends use TanStack Query and Router and openapi-fetch, wrapped by the app kit | Accepted | 2026-11-03 |
| [0055](0055-schema-first-apis-with-typebox.md) | Each API has one source: TypeBox schemas on its routes, with the contract generated from them | Accepted | 2026-11-03 |
| [0056](0056-seed-through-public-apis.md) | Sample data is seeded through public APIs, only where the deployment allows it, by an admin signed in from the terminal | Proposed | 2026-11-03 |
| [0057](0057-realm-as-code-applied-by-identitys-realm-job.md) | The realm is kept as code and applied by identity's realm job, which alone holds Keycloak's admin | Proposed | 2026-11-03 |
| [0058](0058-editor-on-tiptap.md) | Quill's Editor is built on Tiptap, and keeps writing the same small Markdown | Accepted | 2026-11-04 |
| [0059](0059-grafana-alerting-and-faro.md) | A deployment watches itself with Grafana alerting as files and Faro in the shell, and Backstage watches for silence | Proposed | 2026-11-04 |
| [0060](0060-off-server-backups-with-restic.md) | Backups are copied off the server with restic, encrypted on the server, to a bucket each deployment names | Proposed | 2026-11-04 |
| [0062](0062-ontology-checks-with-shacl.md) | Data Atlas checks what it keeps against SHACL shapes, with rdf-validate-shacl | Proposed | 2026-11-05 |
| [0063](0063-accessibility-checked-by-axe.md) | Accessibility is checked by axe in CI, failing on serious findings | Proposed | 2026-11-04 |
| [0064](0064-point-in-time-restore-with-postgres-wal-archiving.md) | The database can be restored to a point in time: Postgres archives its WAL, and restic copies it off the server | Proposed | 2026-11-05 |
| [0065](0065-mail-through-nodemailer-react-email-and-mailpit.md) | AUGUR's own email is sent by Nodemailer from React Email templates, and Mailpit catches it in dev | Accepted | 2026-11-05 |
| [0066](0066-binding-events-name-the-thing.md) | Binding events name the thing: `<app>.<type>.entity-bound` | Proposed | 2026-11-05 |
| [0067](0067-update-control-stays-in-the-registry-behind-a-seam.md) | Update control stays in the registry for now, behind a checked seam, and leaves as its own service | Proposed | 2026-11-05 |
| [0070](0070-military-symbols-with-milsymbol.md) | Data Atlas draws military symbols for its kinds with milsymbol | Proposed | 2026-11-05 |

New record: copy [template.md](template.md), take the next number, add a row here, and add it to the Drive register.
