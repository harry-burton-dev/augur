# Platform

An app platform for the organisation's cloud: a shell that loads independently deployed apps as micro frontends, a shared UI kit, and core services behind one gateway. "Platform" is a codename until it has a name.

Information management is the first app on the platform, not the platform itself. It lives under `apps/library` and is built after the platform's shell and core integrations.

Architecture: [Platform: MVP Architecture](https://claude.ai/code/artifact/bb16f817-a300-4085-aef0-cacbc25f3055) · for server admins: [Platform: C4 Architecture](https://claude.ai/code/artifact/0c81382b-80fd-42fc-84ea-f9a977975db7).

## Layout

| Path | What it is |
| --- | --- |
| `platform/packages/ui-kit` | Design tokens from the Claude Design system and the Lit web components rebuilt from it, Shell and Glance included |
| `platform/packages/mfe-sdk` | The contract between the shell and apps: manifest entries, mount context, event bus, intents |
| `platform/frontends/` | The shell host, Home and Admin; see its README for how apps are mounted |
| `platform/services/gateway` | Public entry; checks the sign-in token, then forwards `/api/<service>/*` to platform services and each app's service with the caller attached |
| `platform/packages/service-kit` | What a service uses to know who is calling (the caller the gateway verified) and to register its app |
| `platform/services/identity` | Who people are: answers "who am I" for the shell; later the directory of people and departments |
| `platform/services/registry` | App catalogue on Postgres: apps register themselves, and each person gets the manifest their roles allow |
| `platform/services/events` | Notifications for the Shell's stream, and the audit log |
| `apps/<app>/` | One product app: its `manifest.json`, `service/` and `frontend/` |
| `contracts/` | OpenAPI specs, the source of truth between services |
| `infra/` | Docker Compose for local dev, the service Dockerfile, later Terraform |

## Getting started

```sh
corepack enable
pnpm install
pnpm build && pnpm test
pnpm check:boundaries
```

Run one service with live reload: `pnpm --filter @platform/registry dev` (port 8082). Without `DATABASE_URL` the registry keeps registered apps in memory; tests for its Postgres store run when `DATABASE_URL` is set, as in CI.

Full local stack (Postgres, MinIO, Keycloak, the platform and the apps): `docker compose -f infra/docker-compose.yml up --build`, then `pnpm --filter @platform/shell dev` and open http://localhost:5173. Sign in as `alex` or `sam`; see [infra/keycloak](infra/keycloak/README.md).

## Design tokens

`platform/packages/ui-kit/tokens/tokens.json` is exported from the Claude Design system and is the source of truth. `pnpm --filter @platform/ui-kit tokens` regenerates `dist/tokens.css` (CSS custom properties) and a typed token map. Never edit the generated files.

## Build order

The platform comes first; apps come after its core integrations work.

1. UI kit: tokens, core components, Shell and Glance (done)
2. Split into `platform/` and `apps/` with the boundary check (done)
3. Shell host: wraps `ui-shell`, loads apps from the registry, mounts them, routes intents (done)
4. Identity and gateway sign-in (Keycloak locally) (done)
5. Registry on Postgres, with apps registering themselves (this step)
6. Notifications feeding the Shell's stream, plus the audit log
7. Inter-app requests (intents) through the SDK, proven with a sample app
8. The Library app
9. Deploy to the org cloud

## Rules between parts

- Nothing under `platform/` depends on an app, and no app depends on another app. `pnpm check:boundaries` fails the build otherwise.
- An app reaches the platform only through `@platform/*` packages, the gateway, the registry manifest and events.
- Only the gateway reads sign-in tokens. Services behind it read the caller with `@platform/service-kit` and trust nothing else a client sends about who it is.
- Services talk only through their OpenAPI contracts or events, never another service's tables.
- Micro frontends never import each other; they raise intents to the shell or use the event bus.
- Every visual comes from `@platform/ui-kit`.
