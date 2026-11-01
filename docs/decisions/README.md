# Decisions

The technical decisions AUGUR is built on, one record each. Read the ones that touch your work before you change it. If your change goes against an Accepted record, write a new Proposed record in the same pull request and say so (see [0001](0001-record-decisions.md)).

Product, naming and process decisions live in the AUGUR handbook on Google Drive (`04 Decisions`), and its Decision register lists these records too.

| # | Decision | Status | Date |
| --- | --- | --- | --- |
| [0001](0001-record-decisions.md) | Record decisions as ADRs in the repository | Accepted | 2026-11-01 |
| [0002](0002-platform-and-apps-separation.md) | One platform, apps on top; the platform never imports an app | Accepted | 2026-10-18 |
| [0003](0003-import-maps-not-module-federation.md) | The shell loads apps through a native import map, not Module Federation | Accepted | 2026-10-27 |
| [0004](0004-ui-kit-lit-tokens-lucide.md) | The UI kit is Lit web components, with one tokens file and Lucide icons | Accepted | 2026-10-17 |
| [0005](0005-services-fastify-postgres.md) | Services are TypeScript on Fastify, with a Postgres schema each and OpenAPI contracts | Accepted | 2026-10-17 |
| [0006](0006-keycloak-and-identity-service.md) | Keycloak signs people in; the identity service owns people, teams and floors | Accepted | 2026-10-18 |
| [0007](0007-floors.md) | Workspaces are floors: you, nested teams, and one organisation | Accepted | 2026-10-19 |
| [0008](0008-per-app-identity-signed-caller.md) | Apps have their own identity, and services trust only the gateway's signed caller | Accepted | 2026-10-23 |
| [0009](0009-object-storage-garage.md) | Files go in S3-compatible object storage, run with Garage | Accepted | 2026-10-17 |
| [0010](0010-docker-compose-deployments.md) | Deployments run on Docker Compose; no Kubernetes for now | Accepted | 2026-11-01 |
| [0011](0011-trunk-based-main-and-tags.md) | One trunk branch and release tags, instead of environment branches | Accepted | 2026-11-01 |
| [0012](0012-apps-in-own-repositories.md) | Every app lives in its own repository, and pillar apps are default-installed apps | Accepted | 2026-11-01 |
| [0013](0013-versions-and-releases.md) | One AUGUR version for deployments, and GitHub releases only for AUGUR and apps | Accepted | 2026-11-01 |
| [0014](0014-agent-runtime.md) | Agents are apps, run by a durable runs service on DBOS | Proposed | 2026-10-24 |
| [0015](0015-react-kits-tailwind.md) | Frontends are React, with a shell kit and an app kit on one common base, styled with Tailwind | Proposed | 2026-11-01 |
| [0016](0016-storybook-on-chromatic.md) | The kits' Storybook is hosted on Chromatic | Proposed | 2026-11-01 |
| [0017](0017-signed-release-feed.md) | The release feed is signed, expires, and can mark a release halted | Accepted | 2026-11-01 |
| [0018](0018-rollout-gates.md) | Releases reach production through rings, a bake time and a halt switch | Accepted | 2026-11-01 |
| [0019](0019-deployment-reporting.md) | Deployments report what they run, as a signed heartbeat or an exported file | Accepted | 2026-11-01 |
| [0020](0020-upgrade-policy-windows-watch.md) | AUGUR upgrades follow a policy, a maintenance window, a semver pin and a post-upgrade watch | Accepted | 2026-11-01 |
| [0021](0021-feature-flags-openfeature-flagd.md) | Feature flags use OpenFeature with flagd | Accepted | 2026-11-01 |
| [0022](0022-upgrade-roles-step-up.md) | Upgrades need a deployment or app admin role and a step-up sign-in | Accepted | 2026-11-01 |
| [0023](0023-air-gap-bundle-oci-layout.md) | The air-gap bundle is a standard OCI image layout | Accepted | 2026-11-01 |
| [0024](0024-apps-are-trusted-code.md) | Apps in the shell are trusted code until outside apps run sandboxed | Accepted | 2026-11-01 |
| [0025](0025-apps-own-entity-bindings.md) | Apps keep their own links to entities and publish them as events | Accepted | 2026-11-01 |
| [0026](0026-inbox-separate-from-notifications.md) | The Inbox holds work that waits on someone, apart from notifications | Accepted | 2026-11-01 |
| [0027](0027-runs-is-the-jobs-engine.md) | The runs service also runs ordinary background jobs | Accepted | 2026-11-01 |
| [0028](0028-discussion-starts-in-intent.md) | Discussion starts inside Intent behind a ref-keyed API | Accepted | 2026-11-01 |
| [0029](0029-reserve-focus-and-marking.md) | The SDK reserves a working context and a protective marking now | Accepted | 2026-11-01 |
| [0030](0030-upgrade-centre-platform-frontend.md) | The Upgrade Centre is its own platform frontend, released with AUGUR | Accepted | 2026-11-01 |

New record: copy [template.md](template.md), take the next number, add a row here, and add it to the Drive register.
