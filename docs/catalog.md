# The catalog

AUGUR describes itself in [Backstage](https://backstage.io)'s catalog format, so a developer portal can show every part, who owns it, what it calls and what it stands on. Nobody writes it: `pnpm catalog` makes it from what the repository already says, and CI fails when it's out of date (`pnpm check:catalog`). After a change to a `package.json`, a manifest, a contract, `infra/deploy/compose.yml` or a guide in `docs/`, run `pnpm catalog` and commit what it writes.

The portal is one for the whole company, above every AUGUR deployment, and lives in its own repository. AUGUR never depends on it.

## What it writes

| File | What's in it |
| --- | --- |
| `catalog/all.yaml` | One Location listing the rest. Register this file in Backstage, at `main`. |
| `catalog/augur.yaml` | The AUGUR domain, the `augur-core` team, the `augur-platform` system with each frontend, package and service, the APIs from `contracts/`, and the third-party parts of the stack (Postgres, Garage, Keycloak, Tailscale, backups, the Docker proxy). |
| `catalog/apps/<id>.yaml` | Each app as a system: its frontend and service, the intents it handles as an API of type `augur-intent`, and its database and bucket. |
| `mkdocs.yml` | Every guide in `docs/` as one TechDocs site, on the platform system. |

## Where each fact comes from

| Fact | From |
| --- | --- |
| Components, their names, descriptions and versions | each workspace `package.json` |
| Apps, their floors, scopes, SDK range, route and intents | `apps/<id>/manifest.json` |
| APIs | `contracts/*.openapi.yaml` |
| What a service calls | the `*_URL` settings it gets in `infra/deploy/compose.yml`; for an app the runner installs, its scopes |
| What it stands on | `depends_on` in `infra/deploy/compose.yml`, and the manifest's `storage` |
| Release unit (`augur.dev/release-unit`) | `augur` for parts that ship in AUGUR's release (in `compose.yml`), `app/<id>` for apps the runner installs |
| Lifecycle | `experimental` below 1.0, `production` from 1.0 |

AUGUR's own facts are annotations under `augur.dev/`, so the portal can show them beside Backstage's: `release-unit`, `version`, `package`, `app-id`, `route`, `sdk-range`, `floors`, `scopes`, and `contract-version` on an API.
