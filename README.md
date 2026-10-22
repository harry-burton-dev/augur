# Platform

An app platform for the organisation's cloud: a shell that loads independently deployed apps as micro frontends, a shared UI kit, and core services behind one gateway. "Platform" is a codename until it has a name.

Information management is the first app on the platform, not the platform itself. It lives under `apps/library` and is built after the platform's shell and core integrations.

Architecture: [Platform: MVP Architecture](https://claude.ai/code/artifact/bb16f817-a300-4085-aef0-cacbc25f3055) · for server admins: [Platform: C4 Architecture](https://claude.ai/code/artifact/0c81382b-80fd-42fc-84ea-f9a977975db7).

## Layout

| Path | What it is |
| --- | --- |
| `platform/packages/ui-kit` | Design tokens from the Claude Design system and the Lit web components rebuilt from it, Shell and Glance included |
| `platform/packages/mfe-sdk` | The contract between the shell and apps: manifest entries, mount context, event bus, and intents to open another app or ask it for an answer |
| `platform/frontends/` | The shell host, Home and Admin; see its README for how apps are mounted |
| `platform/services/gateway` | Public entry; checks the sign-in token, then forwards `/api/<service>/*` to platform services and each app's service with the caller attached |
| `platform/packages/service-kit` | What a service uses to know who is calling, to call other services with the service token, register its app, notify people and write the audit log |
| `platform/services/identity` | Who people are: answers "who am I" for the shell; later the directory of people and departments |
| `platform/services/registry` | App catalogue on Postgres: apps register themselves, and each person gets the manifest their roles allow |
| `platform/services/events` | Notifications, delivered live to the Shell's stream, and the append-only audit log, on Postgres |
| `apps/<app>/` | One product app: its `manifest.json`, `service/` and `frontend/` |
| `contracts/` | OpenAPI specs, the source of truth between services; each one's major version is its path prefix (`/v1`) |
| `infra/` | Docker Compose for local dev, the service and web Dockerfiles, and `deploy/` for running it on a server (see [docs/deploy.md](docs/deploy.md)) |

## Getting started

```sh
corepack enable
pnpm install
pnpm build && pnpm test
pnpm check:boundaries
```

Run one service with live reload: `pnpm --filter @platform/registry dev` (port 8082). Without `DATABASE_URL` the registry and events services keep their data in memory; tests for their Postgres stores run when `DATABASE_URL` is set, as in CI.

Build an app: `pnpm create-app <id>`, then `pnpm dev:app <id>` runs it in a stand-in shell with no other setup. See [Build an app](docs/build-an-app.md).

Full local stack (Postgres, MinIO, Keycloak, the platform and the apps): `docker compose -f infra/docker-compose.yml up --build`, then `pnpm --filter @platform/shell dev` and open http://localhost:5173. Sign in as `alex` or `sam`; see [infra/keycloak](infra/keycloak/README.md).

## Versions and releases

Each package, service and app has its own semver version and releases on its own, with [Changesets](https://github.com/changesets/changesets). Add a changeset to every pull request with `pnpm changeset`; merging the **Version packages** pull request the Release workflow keeps open is how a release is cut. Service APIs live under their major version (`/api/registry/v1/...`), `/healthz` reports what is deployed, and each app's manifest says which SDK releases it works with. See [Versioning](docs/versioning.md).

## Design tokens

`platform/packages/ui-kit/tokens/tokens.json` is exported from the Claude Design system and is the source of truth. `pnpm --filter @platform/ui-kit tokens` regenerates `dist/tokens.css` (CSS custom properties) and a typed token map. Never edit the generated files.

## Build order

The platform comes first; apps come after its core integrations work.

1. UI kit: tokens, core components, Shell and Glance (done)
2. Split into `platform/` and `apps/` with the boundary check (done)
3. Shell host: wraps `ui-shell`, loads apps from the registry, mounts them, routes intents (done)
4. Identity and gateway sign-in (Keycloak locally) (done)
5. Registry on Postgres, with apps registering themselves (done)
6. Notifications feeding the Shell's stream, plus the audit log (done)
7. Inter-app requests (intents) through the SDK, proven with two sample apps (since removed; the shell's tests keep the coverage)
8. The Library app
9. Deploy to the org cloud

## Rules between parts

- Nothing under `platform/` depends on an app, and no app depends on another app. `pnpm check:boundaries` fails the build otherwise.
- An app reaches the platform only through `@platform/*` packages, the gateway, the registry manifest and events.
- Services call each other only on the internal network, with the service token (`SERVICE_TOKEN`); the gateway strips it from outside requests.
- Only the gateway reads sign-in tokens. Services behind it read the caller with `@platform/service-kit` and trust nothing else a client sends about who it is.
- Services talk only through their OpenAPI contracts or events, never another service's tables.
- Micro frontends never import each other; they raise intents to the shell or use the event bus.
- Every visual comes from `@platform/ui-kit`.
