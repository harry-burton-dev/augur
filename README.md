# im-platform

An app platform for the organisation's cloud: a shell that loads independently deployed micro frontends, a shared UI kit, and small services behind one gateway. The first app is an information management platform where users and departments keep document libraries and publish them for internal distribution.

Architecture: [Information Platform: MVP Architecture](https://claude.ai/code/artifact/bb16f817-a300-4085-aef0-cacbc25f3055).

## Layout

| Path | What it is |
| --- | --- |
| `packages/ui-kit` | Design tokens generated from the Claude Design system's `tokens.json`, base CSS, and Lit web components rebuilt from the design |
| `packages/mfe-sdk` | The shell/micro-frontend contract: manifest entries, mount context, event bus, intents |
| `frontends/` | Shell and micro frontends (home, library, admin) |
| `services/gateway` | Public entry; forwards `/api/<service>/*` |
| `services/identity` | OIDC login, users, departments, roles |
| `services/registry` | App catalogue; serves the role-filtered manifest |
| `services/library` | Libraries, documents, versions, publishing |
| `services/events` | Audit log and `document.published` style events |
| `contracts/` | OpenAPI specs, the source of truth between services |
| `infra/` | Docker Compose for local dev, service Dockerfile, later Terraform |

## Getting started

```sh
corepack enable
pnpm install
pnpm build && pnpm test
```

Run one service with live reload: `pnpm --filter @im/registry dev` (port 8082).

Full local stack (Postgres, MinIO, Keycloak and all services): `docker compose -f infra/docker-compose.yml up --build`.

## Design tokens

`packages/ui-kit/tokens/tokens.json` is exported from the Claude Design system and is the source of truth. `pnpm --filter @im/ui-kit tokens` regenerates `dist/tokens.css` (CSS custom properties) and a typed token map. Never edit the generated files.

## Build order

1. UI kit: tokens, then components the Library app needs (Shell, Button, inputs, Table, Glance, Dialog)
2. Shell + mfe-sdk
3. Registry backed by Postgres
4. Gateway token checks + Identity
5. Library service
6. Home and Library micro frontends
7. Admin micro frontend + Events
8. Deploy to the org cloud

## Rules between services

- Services talk only through their OpenAPI contracts or events, never another service's tables.
- Micro frontends never import each other; they raise intents to the shell or use the event bus.
- Every visual comes from `@im/ui-kit`.
