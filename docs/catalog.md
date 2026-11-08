# The catalog

AUGUR describes itself in [Backstage](https://backstage.io)'s catalog format, so a developer portal can show every part, who owns it, what it calls and what it stands on. Nobody writes it: `pnpm catalog` makes it from what the repository already says, and CI fails when it's out of date (`pnpm check:catalog`). After a change to a `package.json`, a manifest, a contract, `infra/deploy/compose.yml` or a guide in `docs/`, run `pnpm catalog` and commit what it writes.

The portal is one for the whole company, above every AUGUR deployment, and lives in its own repository. AUGUR never depends on it.

## What it writes

| File | What's in it |
| --- | --- |
| `catalog/all.yaml` | One Location listing the rest. Register this file in Backstage, at `main`. |
| `catalog/augur.yaml` | The AUGUR domain, the `augur-core` team, the `augur-platform` system with each frontend, package and service, the APIs from `contracts/`, and the third-party parts of the stack (Postgres, Garage, Keycloak, Tailscale, backups, the Docker proxy). |
| `mkdocs.yml` | Every guide in `docs/` as one TechDocs site, on the platform system. |

## Where each fact comes from

| Fact | From |
| --- | --- |
| Components, their names, descriptions and versions | each workspace `package.json` |
| Apps, their kind, floors, scopes, SDK range, route and intents | each app's `manifest.json`, in its own repository (below) |
| APIs | `contracts/*.openapi.yaml` |
| What a service calls | the `*_URL` settings it gets in `infra/deploy/compose.yml`; for an app the runner installs, its scopes |
| What it stands on | `depends_on` in `infra/deploy/compose.yml`, and the manifest's `storage` |
| Release unit (`augur.dev/release-unit`) | `augur` for parts that ship in AUGUR's release (in `compose.yml`), `app/<id>` for an app, which releases from its own repository |
| Lifecycle | `experimental` below 1.0, `production` from 1.0 |

AUGUR's own facts are annotations under `augur.dev/`, so the portal can show them beside Backstage's: `release-unit`, `version`, `package`, `app-id`, `route`, `sdk-range`, `category` (`platform` or `pillar`, when the app says), `floors`, `scopes`, and `contract-version` on an API.

## Apps

Each app lives in its own repository (ADR 0047) and keeps its own entry there: `catalog-info.yaml` at the repository's root, Backstage's usual place. Nobody writes it either. `augur-app catalog` (from `@augur/app-tools`) makes it from the app's `manifest.json` and its parts' `package.json` files: the app as a system, its frontend and service, the intents it handles as an API of type `augur-intent`, and its database and bucket. `augur-app catalog --check` fails when it's out of date, so the app's CI can hold it. The repository it names comes from `GITHUB_REPOSITORY`, or the checkout's GitHub remote.

No app ships with AUGUR (ADR 0075), so `catalog/all.yaml` names no app. Register each app's entry in Backstage yourself (**Register existing component**, with the address of its `catalog-info.yaml`).
