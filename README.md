# AUGUR

AUGUR is an app platform for the organisation's cloud. A **shell** in the browser loads independently built **apps** as micro frontends. Behind one **gateway** sit a few **core services** (who people are, which apps exist, notifications and audit). Apps live in `apps/` and only reach AUGUR through its published `@augur/*` packages and APIs. The Library app is the first one, and it is paused while the shell is finished.

## How a request flows

```
browser ── shell (frontends/shell) ── mounts an app's entry.js from the registry manifest
   │
   └── /api/<service>/v1/...  ──►  gateway ──►  identity · registry · events · models · <app services>
                                     │                    │
                                  checks sign-in       Postgres (one schema per service)
                                  (Keycloak) and the
                                  floor in X-Workspace-Id
```

A **floor** is a workspace: your own (`@me`), a team (`@finance`), or the org (`@org`). Every URL starts with one, and every API call says which floor it is for.

## Folder structure

```
platform/                 everything the platform owns; never imports from apps/
  frontends/
    shell/                the host app in the browser
    home/                 Home, the landing app
    admin/                Admin screens
  packages/
    ui-kit/               design tokens + Lit web components (and Storybook)
    mfe-sdk/              the contract between shell and apps
    service-kit/          helpers every backend service uses
  services/
    gateway/              the only public entry for APIs
    identity/             people, teams, floors, preferences
    registry/             the app catalogue
    events/               notifications + audit log
    models/               the model gateway: the only holder of an AI provider's key
  contract/               browser tests proving old app builds still work in today's shell
apps/
  library/                the Library app (manifest + service stub; frontend to come)
contracts/                OpenAPI spec for each service (the source of truth for its API)
infra/
  docker-compose.yml      full local stack
  service.Dockerfile      builds any service; web.Dockerfile builds the frontends
  keycloak/               local sign-in realm and test users
  deploy/                 the server stack: compose, nginx, Tailscale, backups, Postgres init
scripts/                  repo tooling: create-app, dev-app, register-app, boundary/manifest/version checks
docs/                     how-to guides (below)
.changeset/               pending release notes; one per PR
.github/workflows/        ci.yml (build, test, checks, contract tests) and release.yml
```

## What each part is for

### Frontends

| Package | Purpose |
| --- | --- |
| `@augur/shell` | The host. Signs you in, loads your floors and the app list, draws Title and Orbit menus, mounts the app the URL points at, routes intents between apps, shows the notification stream and runs Find across apps. More in [platform/frontends](platform/frontends/README.md). |
| `@augur/home` | Home at `/home`: what needs you and apps' glance cards. |
| `@augur/admin` | Admin at `/admin` (admins only): people, departments, apps, activity (the audit log) and server status. Talks only to identity and registry through the gateway, never to Keycloak. |

Home and Admin are built like any app: one ES module the shell imports.

### Packages

| Package | Purpose |
| --- | --- |
| `@augur/ui-kit` | Every visual. Tokens come from `tokens/tokens.json` (the only file to edit; `pnpm --filter @augur/ui-kit tokens` regenerates the rest). Storybook: `pnpm --filter @augur/ui-kit storybook`. |
| `@augur/mfe-sdk` | What an app gets from the shell: `defineMicroFrontend`, the mount context (`ctx.person`, `ctx.workspace`, `ctx.fetch`, `notify`, `raise`/`request` intents, event bus), and the manifest types. Breaking it breaks apps, so it is versioned carefully. |
| `@augur/service-kit` | For backend services: read the caller the gateway verified, sign in as the service itself, register an app, send notifications and audit entries, check floors and grants, logging. |

### Services

| Service | Port | Purpose |
| --- | --- | --- |
| `gateway` | 8080 | The single public API entry. Verifies the sign-in token, checks the caller is on the floor named in `X-Workspace-Id`, then forwards `/api/<service>/*` with the caller attached. Also reports status for Admin. |
| `identity` | 8081 | Who you are (`/me`), your floors, your preferences, and the admin side of people, roles and departments (stored in Keycloak behind its own layer). |
| `registry` | 8082 | The app catalogue on Postgres. Apps register themselves on start; each person gets the manifest their roles allow; admins can turn apps off and allow app origins. |
| `events` | 8084 | Notifications (streamed live to the shell) and the append-only audit log, on Postgres. Only services can write; people read their own notifications. |
| `models` | 8085 | The model gateway. Holds the AI provider's key (any OpenAI-style API: OpenRouter, LiteLLM, or the stand-in model), records every call in the audit log before making it, and gives each app a number of calls a day. Off until an admin turns it on. |
| `@apps/folio` | 8083 | The service behind Artifacts (Folio in code): document libraries on each floor, with their folders, in its own schema. |

Keycloak handles sign-in. The gateway passes each service the person calling, signed for that service alone ([Signed caller](docs/signed-caller.md)). Postgres holds data (a schema per service), and Garage is the object store for apps' files ([App storage](docs/app-storage.md)). Each API is described in `contracts/<service>.openapi.yaml`, and its major version is its path prefix (`/v1`).

## Names that still say "platform"

AUGUR was codenamed "platform" until October 2026. Packages, page titles and everything people see now say AUGUR. A few names keep the old word on purpose:

- **`platform/` vs `apps/`** is the architecture, not the brand: what AUGUR itself owns against the apps that run on it. The boundary check and the build depend on it.
- **Running servers' identifiers** stay as they are, because changing them would sign everyone out or lose data: the Keycloak realm `platform` (it is in every token's issuer) and its clients (`platform-api`, `platform-identity`, …), the Postgres database and user `platform`, the Compose project `name: platform` (Docker names the data volumes after it), the `PLATFORM_*` keys in `.env`, and the default Tailscale name `platform`. See [upgrade.md](docs/upgrade.md#renamed-to-augur).
- The shell's import map also answers to `@platform/ui-kit`, so an app built before the rename still loads through SDK 1.x.

## Rules between parts

- Nothing in `platform/` imports an app, and no app imports another. `pnpm check:boundaries` enforces it.
- Apps reach the platform only through `@augur/*` packages, the gateway, the registry manifest and events. Micro frontends never import each other; they raise intents or use the bus.
- Only the gateway reads sign-in tokens. Services trust the caller and floor the gateway passes on, never what the browser claims.
- Each service and app signs in as itself (its own Keycloak client and secret) and can only do what the registry grants it on that floor.
- Services talk through their OpenAPI contracts or events, never another service's tables.
- Every visual comes from `@augur/ui-kit`.

## Working on it

```sh
corepack enable && pnpm install
pnpm build && pnpm test
pnpm check:boundaries
```

- One service with live reload: `pnpm --filter @augur/registry dev`. Without `DATABASE_URL`, registry and events keep data in memory.
- Full local stack: `docker compose -f infra/docker-compose.yml up --build`, then `pnpm --filter @augur/shell dev` and open http://localhost:5173. Sign in as `alex` (admin) or `sam`; see [infra/keycloak](infra/keycloak/README.md).
- New app: `pnpm create-app <id>`, then `pnpm dev:app <id>` runs it in a stand-in shell.
- Every PR needs a changeset: `pnpm changeset` (or `pnpm changeset --empty`).

## Guides

| Guide | Covers |
| --- | --- |
| [Artifacts](docs/folio.md) | Using Artifacts, the document libraries, and running it as an admin |
| [Build an app](docs/build-an-app.md) | From `create-app` to an app in the shell |
| [Ship an app](docs/ship-an-app.md) | From a pull request's preview to servers updating the app by themselves |
| [App previews](docs/app-previews.md) | Trying a pull request's build of an app on a real server |
| [Deploy](docs/deploy.md) | Running the stack on a server with Docker Compose and Tailscale |
| [Upgrade](docs/upgrade.md) | Updating a running server, backups and rollback |
| [Mirror](docs/mirror.md) | Releases and apps for servers that can't reach GitHub |
| [Agents and models](docs/agents.md) | Setting up the model behind Agents, and an app's service asking it |
| [Versioning](docs/versioning.md) | Changesets, releases, API and SDK versions |
| [apps/](apps/README.md) | How apps register and ask each other for things |
| [platform/contract](platform/contract/README.md) | The shell's promise to apps and the frozen SDK builds |
