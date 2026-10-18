# Platform

An app platform for the organisation's cloud: a shell that loads independently deployed apps as micro frontends, a shared UI kit, and core services behind one gateway. "Platform" is a codename until it has a name.

Information management is the first app on the platform, not the platform itself. It lives under `apps/library` and is built after the platform's shell and core integrations.

Architecture: [Platform: MVP Architecture](https://claude.ai/code/artifact/bb16f817-a300-4085-aef0-cacbc25f3055) · for server admins: [Platform: C4 Architecture](https://claude.ai/code/artifact/0c81382b-80fd-42fc-84ea-f9a977975db7).

## Layout

| Path | What it is |
| --- | --- |
| `platform/packages/ui-kit` | Design tokens from the Claude Design system and the Lit web components rebuilt from it, Shell and Glance included |
| `platform/packages/mfe-sdk` | The contract between the shell and apps: manifest entries, mount context, event bus, intents |
| `platform/frontends/` | The shell host, Home and Admin |
| `platform/services/gateway` | Public entry; forwards `/api/<service>/*` to platform services and to each app's service |
| `platform/services/identity` | OIDC sign-in, users, departments, roles |
| `platform/services/registry` | App catalogue; serves the role-filtered manifest |
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

Run one service with live reload: `pnpm --filter @platform/registry dev` (port 8082).

Full local stack (Postgres, MinIO, Keycloak, the platform and the apps): `docker compose -f infra/docker-compose.yml up --build`.

## Design tokens

`platform/packages/ui-kit/tokens/tokens.json` is exported from the Claude Design system and is the source of truth. `pnpm --filter @platform/ui-kit tokens` regenerates `dist/tokens.css` (CSS custom properties) and a typed token map. Never edit the generated files.

## Build order

The platform comes first; apps come after its core integrations work.

1. UI kit: tokens, core components, Shell and Glance (done)
2. Split into `platform/` and `apps/` with the boundary check (this step)
3. Shell host: wraps `ui-shell`, loads apps from the registry
4. Identity and gateway sign-in (Keycloak locally)
5. Registry on Postgres, with apps registering themselves
6. Notifications feeding the Shell's stream, plus the audit log
7. Inter-app requests (intents) through the SDK, proven with a sample app
8. The Library app
9. Deploy to the org cloud

## Rules between parts

- Nothing under `platform/` depends on an app, and no app depends on another app. `pnpm check:boundaries` fails the build otherwise.
- An app reaches the platform only through `@platform/*` packages, the gateway, the registry manifest and events.
- Services talk only through their OpenAPI contracts or events, never another service's tables.
- Micro frontends never import each other; they raise intents to the shell or use the event bus.
- Every visual comes from `@platform/ui-kit`.
